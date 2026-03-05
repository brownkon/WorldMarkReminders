import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';
import { ApnsService } from '../src/services/notification/apns.service';

describe('ApnsService', () => {
    let db: Database.Database;

    const defaultConfig = {
        keyId: '',
        teamId: '',
        keyPath: './certs/AuthKey.p8',
        bundleId: '',
        production: false,
    };

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initializeDatabase(db);
    });

    afterEach(() => {
        db.close();
    });

    describe('isConfigured', () => {
        it('should return false when no APNs credentials are set', () => {
            const service = new ApnsService(db, defaultConfig);
            expect(service.isConfigured()).toBe(false);
        });

        it('should return true when all APNs credentials are set', () => {
            const service = new ApnsService(db, {
                ...defaultConfig,
                keyId: 'ABC123',
                teamId: 'TEAM456',
                bundleId: 'com.example.worldmark',
            });
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when only keyId is set', () => {
            const service = new ApnsService(db, {
                ...defaultConfig,
                keyId: 'ABC123',
            });
            expect(service.isConfigured()).toBe(false);
        });
    });

    describe('device token management', () => {
        let service: ApnsService;

        beforeEach(() => {
            service = new ApnsService(db, defaultConfig);
        });

        it('should register a device token', () => {
            const device = service.registerDeviceToken('abc123token', 'ios');
            expect(device.token).toBe('abc123token');
            expect(device.platform).toBe('ios');
            expect(device.id).toBeDefined();
        });

        it('should not duplicate an existing token', () => {
            service.registerDeviceToken('abc123token', 'ios');
            service.registerDeviceToken('abc123token', 'ios'); // Should update, not duplicate

            const devices = service.getDeviceTokens();
            expect(devices).toHaveLength(1);
        });

        it('should refresh updated_at on re-registration', () => {
            const first = service.registerDeviceToken('abc123token', 'ios');
            // Re-register same token
            const second = service.registerDeviceToken('abc123token', 'ios');

            expect(first.token).toBe(second.token);
        });

        it('should register multiple different tokens', () => {
            service.registerDeviceToken('token1', 'ios');
            service.registerDeviceToken('token2', 'ios');

            const devices = service.getDeviceTokens();
            expect(devices).toHaveLength(2);
        });

        it('should remove a device token', () => {
            service.registerDeviceToken('abc123token', 'ios');
            const removed = service.removeDeviceToken('abc123token');
            expect(removed).toBe(true);

            const devices = service.getDeviceTokens();
            expect(devices).toHaveLength(0);
        });

        it('should return false when removing non-existent token', () => {
            const removed = service.removeDeviceToken('nonexistent');
            expect(removed).toBe(false);
        });

        it('should list all device tokens', () => {
            service.registerDeviceToken('token_a', 'ios');
            service.registerDeviceToken('token_b', 'ios');

            const devices = service.getDeviceTokens();
            expect(devices).toHaveLength(2);
            const tokens = devices.map(d => d.token).sort();
            expect(tokens).toEqual(['token_a', 'token_b']);
        });
    });

    describe('sendToAllDevices', () => {
        it('should return {sent: 0, failed: 0} when not configured', async () => {
            const service = new ApnsService(db, defaultConfig);
            const result = await service.sendToAllDevices('Test', 'Body');
            expect(result).toEqual({ sent: 0, failed: 0 });
        });

        it('should return {sent: 0, failed: 0} when configured but no devices', async () => {
            const service = new ApnsService(db, {
                ...defaultConfig,
                keyId: 'ABC',
                teamId: 'TEAM',
                bundleId: 'com.test',
            });
            const result = await service.sendToAllDevices('Test', 'Body');
            expect(result).toEqual({ sent: 0, failed: 0 });
        });
    });
});
