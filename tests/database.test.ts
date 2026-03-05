import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';

describe('Database', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
    });

    afterEach(() => {
        db.close();
    });

    describe('initializeDatabase', () => {
        it('should create all required tables', () => {
            initializeDatabase(db);

            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .all() as { name: string }[];

            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('resorts');
            expect(tableNames).toContain('credit_charts');
            expect(tableNames).toContain('events');
            expect(tableNames).toContain('opportunities');
            expect(tableNames).toContain('availability');
            expect(tableNames).toContain('notifications');
            expect(tableNames).toContain('pipeline_runs');
        });

        it('should be idempotent — double init should not fail', () => {
            initializeDatabase(db);
            expect(() => initializeDatabase(db)).not.toThrow();
        });

        it('should create indexes', () => {
            initializeDatabase(db);

            const indexes = db
                .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
                .all() as { name: string }[];

            expect(indexes.length).toBeGreaterThan(5);
        });
    });

    describe('table constraints', () => {
        beforeEach(() => {
            initializeDatabase(db);
        });

        it('should enforce unique external_id+source for events', () => {
            db.prepare(`
        INSERT INTO events (id, external_id, source, name, venue_latitude, venue_longitude, start_date)
        VALUES ('id1', 'ext1', 'ticketmaster', 'Event 1', 36.0, -115.0, '2027-01-01')
      `).run();

            expect(() => {
                db.prepare(`
          INSERT INTO events (id, external_id, source, name, venue_latitude, venue_longitude, start_date)
          VALUES ('id2', 'ext1', 'ticketmaster', 'Event 2', 36.0, -115.0, '2027-01-02')
        `).run();
            }).toThrow();
        });

        it('should enforce valid brand values in resorts', () => {
            expect(() => {
                db.prepare(`
          INSERT INTO resorts (id, name, brand, latitude, longitude)
          VALUES ('id1', 'Test', 'invalid_brand', 36.0, -115.0)
        `).run();
            }).toThrow();
        });

        it('should enforce valid status values in opportunities', () => {
            // First insert a resort and event
            db.prepare(`
        INSERT INTO resorts (id, name, brand, latitude, longitude)
        VALUES ('r1', 'Test Resort', 'worldmark', 36.0, -115.0)
      `).run();

            db.prepare(`
        INSERT INTO events (id, external_id, source, name, venue_latitude, venue_longitude, start_date)
        VALUES ('e1', 'ext1', 'ticketmaster', 'Test Event', 36.0, -115.0, '2027-01-01')
      `).run();

            expect(() => {
                db.prepare(`
          INSERT INTO opportunities (id, resort_id, event_id, distance_miles, status)
          VALUES ('o1', 'r1', 'e1', 5.0, 'invalid_status')
        `).run();
            }).toThrow();
        });

        it('should cascade delete from resorts to opportunities', () => {
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
        VALUES ('o1', 'r1', 'e1', 5.0, 'pending')
      `).run();

            // Delete resort should cascade
            db.prepare('DELETE FROM resorts WHERE id = ?').run('r1');
            const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get('o1');
            expect(opp).toBeUndefined();
        });
    });
});
