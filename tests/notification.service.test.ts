import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';
import { NotificationService } from '../src/services/notification/notification.service';
import { v4 as uuidv4 } from 'uuid';

describe('NotificationService', () => {
    let db: Database.Database;
    let service: NotificationService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initializeDatabase(db);

        service = new NotificationService(db, {
            ntfyTopic: 'test-worldmark',
            ntfyServer: 'https://ntfy.sh',
            dailyLimit: 20,
        });

        db.prepare(`
      INSERT INTO resorts (id, name, brand, latitude, longitude)
      VALUES ('r1', 'Test Resort', 'worldmark', 36.0, -115.0)
    `).run();

        db.prepare(`
      INSERT INTO events (id, external_id, source, name, venue_latitude, venue_longitude, start_date)
      VALUES ('e1', 'ext1', 'ticketmaster', 'Test Event', 36.0, -115.0, '2027-01-01')
    `).run();

        db.prepare(`
      INSERT INTO opportunities (id, resort_id, event_id, distance_miles, status)
      VALUES ('opp1', 'r1', 'e1', 5.0, 'pending')
    `).run();
    });

    afterEach(() => {
        db.close();
    });

    describe('formatBookingMessage', () => {
        it('should format a readable booking alert', () => {
            const message = NotificationService.formatBookingMessage({
                resortName: 'WorldMark Las Vegas Boulevard',
                resortCity: 'Las Vegas',
                resortState: 'NV',
                eventName: 'Bruno Mars Concert',
                eventDate: '2027-06-15',
                unitType: '2BR',
                checkIn: '2027-06-14',
                checkOut: '2027-06-16',
                creditsRequired: 4400,
                estimatedResaleValue: 450,
            });

            expect(message).toContain('Las Vegas Boulevard');
            expect(message).toContain('Bruno Mars Concert');
            expect(message).toContain('2BR');
            expect(message).toContain('4,400');
            expect(message).toContain('$450');
        });

        it('should format large credit numbers with commas', () => {
            const message = NotificationService.formatBookingMessage({
                resortName: 'Test',
                resortCity: 'Test',
                resortState: 'TS',
                eventName: 'Test',
                eventDate: '2027-01-01',
                unitType: 'Studio',
                checkIn: '2027-01-01',
                checkOut: '2027-01-02',
                creditsRequired: 12500,
                estimatedResaleValue: 200,
            });

            expect(message).toContain('12,500');
        });
    });

    describe('sendNotification', () => {
        it('should return false when no channels are configured', async () => {
            const emptyService = new NotificationService(db, {
                ntfyTopic: '',
                ntfyServer: 'https://ntfy.sh',
                dailyLimit: 20,
            });
            const result = await emptyService.sendNotification('opp1', 'Test');
            expect(result).toBe(false);
        });

        it('should return false when duplicate notification within 7 days', async () => {
            // Insert a "sent" notification for this opportunity within last 7 days
            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                VALUES (?, 'opp1', 'push', 'test-topic', 'Existing', 'sent', datetime('now'), 0)
            `).run(uuidv4());

            const result = await service.sendNotification('opp1', 'Test');
            expect(result).toBe(false);
        });

        it('should return false when daily limit is reached', async () => {
            const limitedService = new NotificationService(db, {
                ntfyTopic: 'test-worldmark',
                ntfyServer: 'https://ntfy.sh',
                dailyLimit: 2,
            });

            // Insert 2 "sent" notifications for today
            for (let i = 0; i < 2; i++) {
                db.prepare(`
                    INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                    VALUES (?, 'opp1', 'push', 'test-topic', 'Fill ${i}', 'sent', datetime('now'), 0)
                `).run(uuidv4());
            }

            const result = await limitedService.sendNotification('opp1', 'Test');
            expect(result).toBe(false);
        });
    });

    describe('configurable daily limit', () => {
        it('should use custom daily limit from config', () => {
            const customService = new NotificationService(db, {
                ntfyTopic: 'test',
                ntfyServer: 'https://ntfy.sh',
                dailyLimit: 5,
            });
            expect(customService.getDailyLimit()).toBe(5);
        });

        it('should default to 20 notifications per day', () => {
            expect(service.getDailyLimit()).toBe(20);
        });
    });

    describe('notification history', () => {
        it('should return empty array when no notifications exist', () => {
            expect(service.getRecentNotifications()).toEqual([]);
        });

        it('should return notifications in descending order', () => {
            db.prepare(`
        INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
        VALUES (?, 'opp1', 'push', 'test-topic', 'First', 'sent', '2027-01-01 10:00:00', 0)
      `).run(uuidv4());

            db.prepare(`
        INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
        VALUES (?, 'opp1', 'push', 'test-topic', 'Second', 'sent', '2027-01-02 10:00:00', 0)
      `).run(uuidv4());

            const notifications = service.getRecentNotifications();
            expect(notifications).toHaveLength(2);
            expect(notifications[0].body).toBe('Second');
            expect(notifications[1].body).toBe('First');
        });

        it('should include is_read field', () => {
            db.prepare(`
        INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
        VALUES (?, 'opp1', 'push', 'test-topic', 'Test', 'sent', '2027-01-01 10:00:00', 0)
      `).run(uuidv4());

            const notifications = service.getRecentNotifications();
            expect(notifications[0].is_read).toBe(0);
        });
    });

    describe('read/unread management', () => {
        it('should mark a notification as read', () => {
            const notifId = uuidv4();
            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                VALUES (?, 'opp1', 'push', 'test-topic', 'Test', 'sent', '2027-01-01 10:00:00', 0)
            `).run(notifId);

            const result = service.markAsRead(notifId);
            expect(result).toBe(true);

            const notif = service.getNotificationById(notifId);
            expect(notif?.is_read).toBe(1);
        });

        it('should return false for non-existent notification', () => {
            const result = service.markAsRead('non-existent');
            expect(result).toBe(false);
        });

        it('should mark all notifications as read', () => {
            for (let i = 0; i < 3; i++) {
                db.prepare(`
                    INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                    VALUES (?, 'opp1', 'push', 'test-topic', 'Notif ${i}', 'sent', '2027-01-01 10:00:00', 0)
                `).run(uuidv4());
            }

            const count = service.markAllAsRead();
            expect(count).toBe(3);

            const unread = service.getUnreadNotifications();
            expect(unread).toHaveLength(0);
        });

        it('should get only unread notifications', () => {
            const readId = uuidv4();
            const unreadId = uuidv4();

            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                VALUES (?, 'opp1', 'push', 'test', 'Read one', 'sent', '2027-01-01 10:00:00', 1)
            `).run(readId);

            db.prepare(`
                INSERT INTO notifications (id, opportunity_id, type, recipient, body, status, sent_at, is_read)
                VALUES (?, 'opp1', 'push', 'test', 'Unread one', 'sent', '2027-01-02 10:00:00', 0)
            `).run(unreadId);

            const unread = service.getUnreadNotifications();
            expect(unread).toHaveLength(1);
            expect(unread[0].body).toBe('Unread one');
        });
    });
});
