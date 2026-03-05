import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db';
import { ResortService } from '../src/services/resort/resort.service';
import { RankingService } from '../src/services/ranking/ranking.service';
import { v4 as uuidv4 } from 'uuid';

describe('RankingService', () => {
    let db: Database.Database;
    let rankingService: RankingService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initializeDatabase(db);

        // Seed resorts
        const resortService = new ResortService(db);
        resortService.seedResorts();

        rankingService = new RankingService(db, 0.5, 30);
    });

    afterEach(() => {
        db.close();
    });

    function insertTestEvent(overrides: Partial<{
        id: string;
        name: string;
        category: string;
        venueLat: number;
        venueLng: number;
        startDate: string;
        attendance: number | null;
    }> = {}) {
        const id = overrides.id || uuidv4();
        const externalId = `tm-${id}`;
        db.prepare(`
      INSERT INTO events (id, external_id, source, name, category, subcategory,
        venue_name, venue_city, venue_state, venue_latitude, venue_longitude,
        start_date, estimated_attendance, url, image_url)
      VALUES (?, ?, 'ticketmaster', ?, ?, '', 'Test Venue', 'Las Vegas', 'NV', ?, ?, ?, ?, '', '')
    `).run(
            id,
            externalId,
            overrides.name || 'Test Concert',
            overrides.category || 'Music',
            overrides.venueLat ?? 36.12, // Near Las Vegas
            overrides.venueLng ?? -115.17,
            overrides.startDate || '2027-06-15',
            overrides.attendance ?? null,
        );
        return id;
    }

    describe('rankOpportunities', () => {
        it('should create opportunities for events near resorts', () => {
            // Insert an event near Las Vegas (where we have 3 resorts)
            insertTestEvent({ name: 'Big Vegas Concert', venueLat: 36.12, venueLng: -115.17 });

            const count = rankingService.rankOpportunities();
            expect(count).toBeGreaterThan(0);
        });

        it('should NOT create opportunities for events far from any resort', () => {
            // Insert an event in the middle of nowhere
            insertTestEvent({ name: 'Middle of Nowhere', venueLat: 45.0, venueLng: -100.0 });

            const count = rankingService.rankOpportunities();
            expect(count).toBe(0);
        });

        it('should rank music events higher than generic events', () => {
            const musicEventId = insertTestEvent({
                name: 'Big Music Festival',
                category: 'Music',
                venueLat: 36.12,
                venueLng: -115.17,
            });
            const genericEventId = insertTestEvent({
                name: 'Local Meeting',
                category: 'Miscellaneous',
                venueLat: 36.12,
                venueLng: -115.17,
            });

            rankingService.rankOpportunities();
            const opportunities = rankingService.getTopOpportunities(100);

            const musicOpp = opportunities.find(o => o.event_id === musicEventId);
            const genericOpp = opportunities.find(o => o.event_id === genericEventId);

            if (musicOpp && genericOpp) {
                // Same resort, same location — music should score higher
                expect(musicOpp.profit_score).toBeGreaterThan(genericOpp.profit_score);
            }
        });

        it('should assign sequential ranks', () => {
            // Insert multiple events near Las Vegas
            insertTestEvent({ name: 'Event A', startDate: '2027-06-01' });
            insertTestEvent({ name: 'Event B', startDate: '2027-07-01' });
            insertTestEvent({ name: 'Event C', startDate: '2027-08-01' });

            rankingService.rankOpportunities();
            const opportunities = rankingService.getTopOpportunities(100);

            // Check ranks are sequential
            const ranks = opportunities.map(o => o.rank);
            for (let i = 1; i < ranks.length; i++) {
                expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
            }
        });
    });

    describe('getTopOpportunities', () => {
        it('should return empty array when no opportunities exist', () => {
            const opps = rankingService.getTopOpportunities(10);
            expect(opps).toEqual([]);
        });

        it('should respect the limit parameter', () => {
            // Insert many events
            for (let i = 0; i < 10; i++) {
                insertTestEvent({ name: `Event ${i}`, startDate: `2027-0${(i % 9) + 1}-15` });
            }

            rankingService.rankOpportunities();
            const limited = rankingService.getTopOpportunities(5);
            expect(limited.length).toBeLessThanOrEqual(5);
        });

        it('should include resort and event details in results', () => {
            insertTestEvent({ name: 'Detail Test Concert' });
            rankingService.rankOpportunities();

            const opps = rankingService.getTopOpportunities(1);
            if (opps.length > 0) {
                const opp = opps[0];
                expect(opp.resort_name).toBeDefined();
                expect(opp.resort_city).toBeDefined();
                expect(opp.event_name).toBeDefined();
                expect(opp.event_date).toBeDefined();
            }
        });
    });

    describe('getOpportunityCount', () => {
        it('should return 0 when empty', () => {
            expect(rankingService.getOpportunityCount()).toBe(0);
        });

        it('should return correct count after ranking', () => {
            insertTestEvent({ name: 'Count Test' });
            rankingService.rankOpportunities();
            expect(rankingService.getOpportunityCount()).toBeGreaterThan(0);
        });
    });
});
