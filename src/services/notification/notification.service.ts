import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../utils/logger';
import { ApnsService } from './apns.service';

const log = createChildLogger('notification-service');

export interface NotificationConfig {
    ntfyTopic: string;
    ntfyServer: string;
    dailyLimit: number;
}

export interface NotificationRow {
    id: string;
    opportunity_id: string;
    type: string;
    recipient: string;
    body: string;
    sent_at: string;
    status: string;
    error_message: string | null;
    is_read: number;
}

export class NotificationService {
    private ntfyUrl: string;

    constructor(
        private db: Database.Database,
        private config: NotificationConfig,
        private apnsService?: ApnsService,
    ) {
        this.ntfyUrl = `${this.config.ntfyServer}/${this.config.ntfyTopic}`;

        if (config.ntfyTopic) {
            log.info({ topic: config.ntfyTopic }, 'ntfy notifications enabled');
        } else {
            log.warn('ntfy topic not configured — notifications disabled');
        }

        log.info({ dailyLimit: config.dailyLimit }, 'Notification rate limit set');
    }

    /**
     * Send a push notification via ntfy.sh AND APNs for a booking opportunity.
     */
    async sendNotification(opportunityId: string, message: string, title?: string): Promise<boolean> {
        if (!this.config.ntfyTopic && !this.apnsService?.isConfigured()) {
            log.warn('No notification channels configured, skipping');
            return false;
        }

        if (this.hasRecentNotification(opportunityId)) {
            log.info({ opportunityId }, 'Notification already sent recently');
            return false;
        }

        if (this.getDailyNotificationCount() >= this.config.dailyLimit) {
            log.warn({ limit: this.config.dailyLimit }, 'Daily notification limit reached');
            return false;
        }

        const notificationId = uuidv4();
        const resolvedTitle = title || 'WorldMark Alert';
        let ntfyOk = false;
        let apnsOk = false;
        const errors: string[] = [];

        // Channel 1: ntfy.sh
        if (this.config.ntfyTopic) {
            try {
                const response = await fetch(this.ntfyUrl, {
                    method: 'POST',
                    headers: {
                        'Title': resolvedTitle,
                        'Priority': '4',
                        'Tags': 'hotel,money_with_wings',
                    },
                    body: message,
                });

                if (!response.ok) {
                    throw new Error(`ntfy responded with ${response.status}: ${response.statusText}`);
                }
                ntfyOk = true;
            } catch (error: any) {
                errors.push(`ntfy: ${error.message}`);
                log.error({ error: error.message, opportunityId }, 'ntfy push failed');
            }
        }

        // Channel 2: APNs
        if (this.apnsService?.isConfigured()) {
            try {
                const result = await this.apnsService.sendToAllDevices(resolvedTitle, message, opportunityId);
                apnsOk = result.sent > 0;
            } catch (error: any) {
                errors.push(`apns: ${error.message}`);
                log.error({ error: error.message, opportunityId }, 'APNs push failed');
            }
        }

        const anySuccess = ntfyOk || apnsOk;
        const status = anySuccess ? 'sent' : 'failed';
        const errorMessage = errors.length > 0 ? errors.join('; ') : null;
        const recipient = [
            this.config.ntfyTopic ? `ntfy:${this.config.ntfyTopic}` : null,
            apnsOk ? 'apns' : null,
        ].filter(Boolean).join(',') || 'none';

        this.db.prepare(`
            INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, error_message, is_read)
            VALUES (?, ?, 'push', ?, ?, ?, ?, 0)
        `).run(notificationId, opportunityId, recipient, message, status, errorMessage);

        log.info({ opportunityId, notificationId, ntfyOk, apnsOk }, 'Notification processed');
        return anySuccess;
    }

    /**
     * Send a test notification (bypasses duplicate/rate-limit checks).
     */
    async sendTestNotification(message: string): Promise<boolean> {
        let ntfyOk = false;
        let apnsOk = false;

        // Try ntfy
        if (this.config.ntfyTopic) {
            try {
                const response = await fetch(this.ntfyUrl, {
                    method: 'POST',
                    headers: {
                        'Title': 'WorldMark Scheduler Test',
                        'Priority': '3',
                        'Tags': 'white_check_mark',
                    },
                    body: message,
                });

                if (!response.ok) {
                    throw new Error(`ntfy responded with ${response.status}: ${response.statusText}`);
                }
                ntfyOk = true;
                log.info({ topic: this.config.ntfyTopic }, 'Test notification sent via ntfy');
            } catch (error: any) {
                log.error({ error: error.message }, 'Failed to send test notification via ntfy');
            }
        }

        // Try APNs
        if (this.apnsService?.isConfigured()) {
            try {
                const result = await this.apnsService.sendToAllDevices(
                    'WorldMark Scheduler Test',
                    message,
                );
                apnsOk = result.sent > 0;
                if (apnsOk) {
                    log.info('Test notification sent via APNs');
                }
            } catch (error: any) {
                log.error({ error: error.message }, 'Failed to send test notification via APNs');
            }
        }

        return ntfyOk || apnsOk;
    }

    /**
     * Format a booking recommendation message.
     */
    static formatBookingMessage(data: {
        resortName: string;
        resortCity: string;
        resortState: string;
        eventName: string;
        eventDate: string;
        unitType: string;
        checkIn: string;
        checkOut: string;
        creditsRequired: number | string;
        estimatedResaleValue: number;
    }): string {
        return [
            `${data.resortName}`,
            `${data.resortCity}, ${data.resortState}`,
            ``,
            `Event: ${data.eventName}`,
            `Date: ${data.eventDate}`,
            ``,
            `Room: ${data.unitType}`,
            `${data.checkIn} - ${data.checkOut}`,
            `Credits: ${typeof data.creditsRequired === 'number' ? data.creditsRequired.toLocaleString() : data.creditsRequired}`,
            `Est. Value: $${data.estimatedResaleValue}`,
        ].join('\n');
    }

    // ===========================
    // Notification History
    // ===========================

    getRecentNotifications(limit: number = 20): NotificationRow[] {
        return this.db.prepare(`
            SELECT * FROM notifications
            ORDER BY sent_at DESC
            LIMIT ?
        `).all(limit) as NotificationRow[];
    }

    getUnreadNotifications(): NotificationRow[] {
        return this.db.prepare(`
            SELECT * FROM notifications
            WHERE is_read = 0
            ORDER BY sent_at DESC
        `).all() as NotificationRow[];
    }

    markAsRead(notificationId: string): boolean {
        const result = this.db.prepare(
            `UPDATE notifications SET is_read = 1 WHERE id = ?`
        ).run(notificationId);
        return result.changes > 0;
    }

    markAllAsRead(): number {
        const result = this.db.prepare(
            `UPDATE notifications SET is_read = 1 WHERE is_read = 0`
        ).run();
        return result.changes;
    }

    getNotificationById(id: string): NotificationRow | undefined {
        return this.db.prepare(
            'SELECT * FROM notifications WHERE id = ?'
        ).get(id) as NotificationRow | undefined;
    }

    // ===========================
    // Rate Limiting
    // ===========================

    private hasRecentNotification(opportunityId: string): boolean {
        const row = this.db.prepare(`
            SELECT COUNT(*) as count FROM notifications
            WHERE opportunity_id = ? AND status = 'sent'
            AND sent_at >= datetime('now', '-7 days')
        `).get(opportunityId) as { count: number };
        return row.count > 0;
    }

    getDailyNotificationCount(): number {
        const row = this.db.prepare(`
            SELECT COUNT(*) as count FROM notifications
            WHERE status = 'sent' AND sent_at >= date('now')
        `).get() as { count: number };
        return row.count;
    }

    getDailyLimit(): number {
        return this.config.dailyLimit;
    }
}
