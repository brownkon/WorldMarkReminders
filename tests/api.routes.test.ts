import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';
import { createApiRouter } from '../src/api/routes';
import { SchedulerService } from '../src/services/scheduler/scheduler.service';
import { v4 as uuidv4 } from 'uuid';

// Minimal config for testing
function makeTestConfig() {
    return {
        worldmarkUsername: 'test',
        worldmarkPassword: 'test',
        ticketmasterApiKey: 'test-key',
        ntfyTopic: '',
        ntfyServer: 'https://ntfy.sh',
        notificationDailyLimit: 20,
        apnsKeyId: '',
        apnsTeamId: '',
        apnsKeyPath: './certs/AuthKey.p8',
        apnsBundleId: '',
        port: 3001,
        apiKey: 'test-api-key',
        nodeEnv: 'test' as const,
        resortRefreshCron: '0 0 1 */3 *',
        eventDiscoveryCron: '0 0 * * 1',
        availabilityCheckCron: '0 6 * * *',
        creditValueCents: 10,
        minProfitThreshold: 60,
        eventSearchRadiusMiles: 30,
        topOpportunitiesCount: 50,
        databasePath: ':memory:',
        availabilityRequestDelayMs: 2000,
    };
}

/**
 * Helper to make HTTP-like requests to Express router without a running server.
 * Uses supertest-like approach with express directly.
 */
async function makeRequest(
    app: express.Express,
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body?: any,
): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
        const req = {
            method: method.toUpperCase(),
            url: path,
            headers: { 'x-api-key': 'test-api-key' } as Record<string, string>,
            query: {} as Record<string, string>,
            params: {} as Record<string, string>,
            body: body || {},
        };

        // Parse query string
        const [pathname, queryString] = path.split('?');
        if (queryString) {
            const params = new URLSearchParams(queryString);
            req.query = Object.fromEntries(params.entries());
            req.url = pathname;
        }

        // Parse path params (simplified)
        const pathParts = pathname.split('/');
        req.url = pathname;

        const res = {
            statusCode: 200,
            _body: null as any,
            status(code: number) { this.statusCode = code; return this; },
            json(data: any) { this._body = data; resolve({ status: this.statusCode, body: this._body }); },
        };

        // We'll use a simpler approach - just test the service layer directly
        resolve({ status: 200, body: {} });
    });
}

describe('API Routes - Service Layer', () => {
    let db: Database.Database;
    let scheduler: SchedulerService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initializeDatabase(db);

        const config = makeTestConfig();
        scheduler = new SchedulerService(db, config);

        // Seed test data
        db.prepare(`
            INSERT INTO resorts (id, name, brand, city, state, latitude, longitude)
            VALUES ('r1', 'Test Resort', 'worldmark', 'Las Vegas', 'NV', 36.0, -115.0)
        `).run();

        db.prepare(`
            INSERT INTO events (id, external_id, source, name, category, venue_name, venue_city, venue_state, venue_latitude, venue_longitude, start_date, url, image_url)
            VALUES ('e1', 'ext1', 'ticketmaster', 'Test Concert', 'Music', 'Test Venue', 'Las Vegas', 'NV', 36.1, -115.1, '2027-06-15', 'https://example.com', 'https://example.com/img.jpg')
        `).run();

        db.prepare(`
            INSERT INTO opportunities (id, resort_id, event_id, distance_miles, profit_score, estimated_nightly_rate, estimated_credit_cost, estimated_profit, rank, status)
            VALUES ('opp1', 'r1', 'e1', 5.0, 100, 200, 50, 150, 1, 'available')
        `).run();
    });

    afterEach(() => {
        db.close();
    });

    describe('NotificationService integration', () => {
        it('should expose notification service methods', () => {
            const notifService = scheduler.getNotificationService();
            expect(notifService).toBeDefined();
            expect(notifService.getDailyLimit()).toBe(20);
            expect(notifService.getDailyNotificationCount()).toBe(0);
        });

        it('should return recent notifications', () => {
            const notifService = scheduler.getNotificationService();
            const notifications = notifService.getRecentNotifications();
            expect(notifications).toEqual([]);
        });

        it('should return unread notifications', () => {
            const notifService = scheduler.getNotificationService();
            const unread = notifService.getUnreadNotifications();
            expect(unread).toEqual([]);
        });
    });

    describe('ApnsService integration', () => {
        it('should expose APNs service', () => {
            const apnsService = scheduler.getApnsService();
            expect(apnsService).toBeDefined();
            expect(apnsService.isConfigured()).toBe(false);
        });

        it('should register and list device tokens', () => {
            const apnsService = scheduler.getApnsService();
            apnsService.registerDeviceToken('test-device-token-123', 'ios');

            const devices = apnsService.getDeviceTokens();
            expect(devices).toHaveLength(1);
            expect(devices[0].token).toBe('test-device-token-123');
        });

        it('should remove device tokens', () => {
            const apnsService = scheduler.getApnsService();
            apnsService.registerDeviceToken('test-device-token-123', 'ios');

            const removed = apnsService.removeDeviceToken('test-device-token-123');
            expect(removed).toBe(true);

            const devices = apnsService.getDeviceTokens();
            expect(devices).toHaveLength(0);
        });
    });

    describe('Notification read/unread via SchedulerService', () => {
        it('should mark notification as read', () => {
            const notifId = uuidv4();
            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                VALUES (?, 'opp1', 'push', 'test', 'Test alert', 'sent', datetime('now'), 0)
            `).run(notifId);

            const notifService = scheduler.getNotificationService();
            const result = notifService.markAsRead(notifId);
            expect(result).toBe(true);

            const notif = notifService.getNotificationById(notifId);
            expect(notif?.is_read).toBe(1);
        });

        it('should mark all as read', () => {
            for (let i = 0; i < 3; i++) {
                db.prepare(`
                    INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                    VALUES (?, 'opp1', 'push', 'test', 'Alert ${i}', 'sent', datetime('now'), 0)
                `).run(uuidv4());
            }

            const notifService = scheduler.getNotificationService();
            const count = notifService.markAllAsRead();
            expect(count).toBe(3);
        });
    });

    describe('Settings', () => {
        it('should return daily limit from notification service', () => {
            const notifService = scheduler.getNotificationService();
            expect(notifService.getDailyLimit()).toBe(20);
        });
    });

    describe('Database schema', () => {
        it('should have device_tokens table', () => {
            const tables = db.prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='device_tokens'`
            ).all();
            expect(tables).toHaveLength(1);
        });

        it('should have settings table', () => {
            const tables = db.prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`
            ).all();
            expect(tables).toHaveLength(1);
        });

        it('should have is_read column in notifications', () => {
            const notifId = uuidv4();
            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, is_read)
                VALUES (?, 'opp1', 'push', 'test', 'Test', 'sent', 0)
            `).run(notifId);

            const row = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notifId) as any;
            expect(row.is_read).toBe(0);
        });
    });
});
