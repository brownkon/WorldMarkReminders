import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';
import { ResortService, WORLDMARK_RESORTS } from '../src/services/resort/resort.service';

describe('ResortService', () => {
    let db: Database.Database;
    let service: ResortService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initializeDatabase(db);
        service = new ResortService(db);
    });

    afterEach(() => {
        db.close();
    });

    describe('seedResorts', () => {
        it('should seed all known resorts', () => {
            const count = service.seedResorts();
            expect(count).toBe(WORLDMARK_RESORTS.length);
            expect(count).toBeGreaterThan(50); // We have 50+ resorts defined
        });

        it('should be idempotent — re-seeding should not duplicate', () => {
            service.seedResorts();
            service.seedResorts();
            const allResorts = service.getAllResorts();
            expect(allResorts.length).toBe(WORLDMARK_RESORTS.length);
        });
    });

    describe('getAllResorts', () => {
        it('should return all seeded resorts', () => {
            service.seedResorts();
            const resorts = service.getAllResorts();
            expect(resorts.length).toBe(WORLDMARK_RESORTS.length);
        });

        it('should return resorts sorted by state then city', () => {
            service.seedResorts();
            const resorts = service.getAllResorts();
            // Verify that resorts are ordered by state, then city (using SQL default collation)
            for (let i = 1; i < resorts.length; i++) {
                const prev = resorts[i - 1];
                const curr = resorts[i];
                const cmp = prev.state.localeCompare(curr.state);
                if (cmp === 0) {
                    // Same state: city should be non-decreasing
                    expect(prev.city.localeCompare(curr.city)).toBeLessThanOrEqual(0);
                } else {
                    // State should be non-decreasing
                    expect(cmp).toBeLessThanOrEqual(0);
                }
            }
        });
    });

    describe('getResortById', () => {
        it('should return a resort by its ID', () => {
            service.seedResorts();
            const all = service.getAllResorts();
            const first = all[0];
            const found = service.getResortById(first.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(first.name);
        });

        it('should return undefined for non-existent ID', () => {
            const found = service.getResortById('non-existent-id');
            expect(found).toBeUndefined();
        });
    });

    describe('getResortsByBrand', () => {
        it('should filter by brand', () => {
            service.seedResorts();
            const worldmark = service.getResortsByBrand('worldmark');
            expect(worldmark.length).toBeGreaterThan(0);
            worldmark.forEach(r => expect(r.brand).toBe('worldmark'));
        });
    });

    describe('getResortCount', () => {
        it('should return 0 for empty database', () => {
            expect(service.getResortCount()).toBe(0);
        });

        it('should return correct count after seeding', () => {
            service.seedResorts();
            expect(service.getResortCount()).toBe(WORLDMARK_RESORTS.length);
        });
    });

    describe('resort data integrity', () => {
        it('every resort should have valid GPS coordinates', () => {
            for (const resort of WORLDMARK_RESORTS) {
                expect(resort.latitude).toBeGreaterThan(-90);
                expect(resort.latitude).toBeLessThan(90);
                expect(resort.longitude).toBeGreaterThan(-180);
                expect(resort.longitude).toBeLessThan(180);
            }
        });

        it('every resort should have at least one unit type', () => {
            for (const resort of WORLDMARK_RESORTS) {
                expect(resort.unitTypes.length).toBeGreaterThan(0);
            }
        });

        it('every resort should have a non-empty name', () => {
            for (const resort of WORLDMARK_RESORTS) {
                expect(resort.name.length).toBeGreaterThan(0);
            }
        });
    });
});
