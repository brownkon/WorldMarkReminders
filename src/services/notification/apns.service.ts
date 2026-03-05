import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http2 from 'http2';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('apns-service');

export interface ApnsConfig {
    keyId: string;
    teamId: string;
    keyPath: string;
    bundleId: string;
    production: boolean;
}

interface DeviceTokenRow {
    id: string;
    token: string;
    platform: string;
    created_at: string;
    updated_at: string;
}

interface ApnsPayload {
    aps: {
        alert: {
            title: string;
            body: string;
        };
        sound?: string;
        badge?: number;
        'content-available'?: number;
    };
    opportunityId?: string;
}

/**
 * Apple Push Notification Service client.
 * Uses HTTP/2 + JWT authentication per Apple's spec.
 */
export class ApnsService {
    private jwtToken: string | null = null;
    private jwtIssuedAt: number = 0;
    private privateKey: string | null = null;
    private readonly host: string;

    // JWT tokens are valid for 1 hour; we refresh at 50 minutes
    private static readonly JWT_TTL_MS = 50 * 60 * 1000;

    constructor(
        private db: Database.Database,
        private config: ApnsConfig,
    ) {
        this.host = config.production
            ? 'https://api.push.apple.com'
            : 'https://api.sandbox.push.apple.com';

        if (this.isConfigured()) {
            this.loadPrivateKey();
            log.info({ keyId: config.keyId, teamId: config.teamId }, 'APNs configured');
        } else {
            log.info('APNs not configured — push to iOS disabled');
        }
    }

    /**
     * Check if APNs is properly configured.
     */
    isConfigured(): boolean {
        return !!(this.config.keyId && this.config.teamId && this.config.bundleId);
    }

    /**
     * Send a push notification to all registered iOS devices.
     */
    async sendToAllDevices(
        title: string,
        body: string,
        opportunityId?: string,
    ): Promise<{ sent: number; failed: number }> {
        if (!this.isConfigured()) {
            log.debug('APNs not configured, skipping');
            return { sent: 0, failed: 0 };
        }

        const devices = this.getDeviceTokens();
        if (devices.length === 0) {
            log.debug('No registered devices');
            return { sent: 0, failed: 0 };
        }

        const payload: ApnsPayload = {
            aps: {
                alert: { title, body },
                sound: 'default',
                'content-available': 1,
            },
            opportunityId,
        };

        let sent = 0;
        let failed = 0;

        for (const device of devices) {
            try {
                await this.sendPush(device.token, payload);
                sent++;
            } catch (error: any) {
                failed++;
                log.error({ error: error.message, token: device.token.slice(0, 8) + '...' }, 'APNs push failed');

                // Remove invalid tokens (gone or unregistered)
                if (error.statusCode === 410 || error.reason === 'Unregistered') {
                    this.removeDeviceToken(device.token);
                }
            }
        }

        log.info({ sent, failed, total: devices.length }, 'APNs push batch complete');
        return { sent, failed };
    }

    /**
     * Send a push notification to a single device.
     */
    private async sendPush(deviceToken: string, payload: ApnsPayload): Promise<void> {
        const jwt = this.getJwt();
        const payloadStr = JSON.stringify(payload);

        return new Promise((resolve, reject) => {
            const client = http2.connect(this.host);

            client.on('error', (err) => {
                client.close();
                reject(err);
            });

            const headers = {
                ':method': 'POST',
                ':path': `/3/device/${deviceToken}`,
                'authorization': `bearer ${jwt}`,
                'apns-topic': this.config.bundleId,
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-id': uuidv4(),
            };

            const req = client.request(headers);
            let responseData = '';

            req.on('response', (headers) => {
                const status = headers[':status'] as number;
                if (status === 200) {
                    client.close();
                    resolve();
                } else {
                    req.on('data', (chunk) => { responseData += chunk; });
                    req.on('end', () => {
                        client.close();
                        const body = responseData ? JSON.parse(responseData) : {};
                        const error: any = new Error(`APNs error: ${status} ${body.reason || ''}`);
                        error.statusCode = status;
                        error.reason = body.reason;
                        reject(error);
                    });
                }
            });

            req.write(payloadStr);
            req.end();
        });
    }

    // ===========================
    // Device Token Management
    // ===========================

    registerDeviceToken(token: string, platform: string = 'ios'): DeviceTokenRow {
        const existing = this.db.prepare(
            'SELECT * FROM device_tokens WHERE token = ?'
        ).get(token) as DeviceTokenRow | undefined;

        if (existing) {
            this.db.prepare(
                `UPDATE device_tokens SET updated_at = datetime('now') WHERE token = ?`
            ).run(token);
            log.info({ token: token.slice(0, 8) + '...' }, 'Device token refreshed');
            return this.db.prepare('SELECT * FROM device_tokens WHERE token = ?').get(token) as DeviceTokenRow;
        }

        const id = uuidv4();
        this.db.prepare(
            'INSERT INTO device_tokens (id, token, platform) VALUES (?, ?, ?)'
        ).run(id, token, platform);

        log.info({ token: token.slice(0, 8) + '...', platform }, 'Device token registered');
        return this.db.prepare('SELECT * FROM device_tokens WHERE id = ?').get(id) as DeviceTokenRow;
    }

    removeDeviceToken(token: string): boolean {
        const result = this.db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
        if (result.changes > 0) {
            log.info({ token: token.slice(0, 8) + '...' }, 'Device token removed');
            return true;
        }
        return false;
    }

    getDeviceTokens(): DeviceTokenRow[] {
        return this.db.prepare('SELECT * FROM device_tokens ORDER BY created_at DESC').all() as DeviceTokenRow[];
    }

    // ===========================
    // JWT Management
    // ===========================

    private getJwt(): string {
        const now = Date.now();
        if (this.jwtToken && (now - this.jwtIssuedAt) < ApnsService.JWT_TTL_MS) {
            return this.jwtToken;
        }

        this.jwtToken = this.createJwt();
        this.jwtIssuedAt = now;
        return this.jwtToken;
    }

    private createJwt(): string {
        if (!this.privateKey) {
            throw new Error('APNs private key not loaded');
        }

        const header = {
            alg: 'ES256',
            kid: this.config.keyId,
        };

        const claims = {
            iss: this.config.teamId,
            iat: Math.floor(Date.now() / 1000),
        };

        const encodedHeader = this.base64url(JSON.stringify(header));
        const encodedClaims = this.base64url(JSON.stringify(claims));
        const signingInput = `${encodedHeader}.${encodedClaims}`;

        const sign = crypto.createSign('SHA256');
        sign.update(signingInput);
        const signature = sign.sign(this.privateKey, 'base64url');

        return `${signingInput}.${signature}`;
    }

    private base64url(str: string): string {
        return Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    private loadPrivateKey(): void {
        try {
            if (fs.existsSync(this.config.keyPath)) {
                this.privateKey = fs.readFileSync(this.config.keyPath, 'utf8');
                log.debug('APNs private key loaded');
            } else {
                log.warn({ path: this.config.keyPath }, 'APNs key file not found');
            }
        } catch (error: any) {
            log.error({ error: error.message }, 'Failed to load APNs key');
        }
    }
}
