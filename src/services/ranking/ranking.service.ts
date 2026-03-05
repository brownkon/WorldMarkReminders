import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../utils/logger';
import { distanceMiles } from '../../utils/geo';
import { ResortRow } from '../resort/resort.service';
import { EventRow } from '../event/event.service';

const log = createChildLogger('ranking-service');

export interface OpportunityRow {
    id: string;
    resort_id: string;
    event_id: string;
    distance_miles: number;
    profit_score: number;
    estimated_nightly_rate: number;
    estimated_credit_cost: number;
    estimated_profit: number;
    rank: number;
    status: string;
    created_at: string;
    updated_at: string;
}

// Approximate market rates by city/region type (conservative estimates for resale)
const MARKET_RATE_MULTIPLIERS: Record<string, number> = {
    // Major cities & tourist spots get highest base rates
    'Las Vegas': 180,
    'Orlando': 160,
    'Anaheim': 200,
    'San Diego': 190,
    'Scottsdale': 170,
    'Palm Springs': 150,
    'Branson': 120,
    'Austin': 160,
    'Portland': 140,
    'Sedona': 180,
    'Park City': 220,
    // Hawaii premium
    'Kailua-Kona': 250,
    'Kapaa': 240,
    'Lahaina': 260,
    // International
    'Denarau Island': 280,
    'San José del Cabo': 200,
    'Canmore': 190,
};

const DEFAULT_MARKET_RATE = 130; // Base nightly rate for less popular areas

// Event category demand multipliers
const EVENT_CATEGORY_MULTIPLIERS: Record<string, number> = {
    'Music': 2.0,
    'Sports': 1.8,
    'Arts & Theatre': 1.3,
    'Film': 1.2,
    'Miscellaneous': 1.1,
};

export class RankingService {
    constructor(
        private db: Database.Database,
        private creditValueCents: number = 0.5,
        private searchRadiusMiles: number = 30,
    ) { }

    /**
     * Generate and rank opportunities by pairing resorts with nearby events.
     */
    rankOpportunities(): number {
        const resorts = this.db.prepare('SELECT * FROM resorts').all() as ResortRow[];
        const events = this.db.prepare(
            "SELECT * FROM events WHERE start_date >= date('now') ORDER BY start_date ASC"
        ).all() as EventRow[];

        log.info({ resorts: resorts.length, events: events.length }, 'Starting opportunity ranking');

        let created = 0;

        for (const resort of resorts) {
            for (const event of events) {
                const distance = distanceMiles(
                    resort.latitude, resort.longitude,
                    event.venue_latitude, event.venue_longitude,
                );

                if (distance > this.searchRadiusMiles) continue;

                const score = this.calculateProfitScore(resort, event, distance);
                if (score.profitScore <= 0) continue;

                this.upsertOpportunity(resort, event, distance, score);
                created++;
            }
        }

        // Assign ranks based on profit score
        this.assignRanks();

        log.info({ opportunitiesCreated: created }, 'Opportunity ranking complete');
        return created;
    }

    /**
     * Calculate the profit score for a resort+event combo.
     */
    private calculateProfitScore(
        resort: ResortRow,
        event: EventRow,
        distance: number,
    ): { profitScore: number; estimatedNightlyRate: number; estimatedCreditCost: number; estimatedProfit: number } {
        // Base market rate for the resort's city
        const baseRate = MARKET_RATE_MULTIPLIERS[resort.city] || DEFAULT_MARKET_RATE;

        // Event demand multiplier
        const categoryMultiplier = EVENT_CATEGORY_MULTIPLIERS[event.category] || 1.0;

        // Attendance multiplier (bigger events = more demand = higher rates)
        let attendanceMultiplier = 1.0;
        if (event.estimated_attendance) {
            if (event.estimated_attendance > 50000) attendanceMultiplier = 2.5;
            else if (event.estimated_attendance > 20000) attendanceMultiplier = 2.0;
            else if (event.estimated_attendance > 10000) attendanceMultiplier = 1.7;
            else if (event.estimated_attendance > 5000) attendanceMultiplier = 1.4;
            else if (event.estimated_attendance > 1000) attendanceMultiplier = 1.2;
        }

        // Weekend bonus (Fri/Sat events are more valuable)
        const eventDate = new Date(event.start_date);
        const dayOfWeek = eventDate.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri or Sat
        const weekendMultiplier = isWeekend ? 1.3 : 1.0;

        // Distance penalty (closer is better)
        const distancePenalty = Math.max(0.5, 1.0 - (distance / (this.searchRadiusMiles * 2)));

        // Estimated nightly market rate during the event
        const estimatedNightlyRate = Math.round(
            baseRate * categoryMultiplier * attendanceMultiplier * weekendMultiplier * distancePenalty
        );

        // Average credit cost (use 2BR weekday as a middle estimate — ~1000 credits)
        const averageCreditsPerNight = 1000;
        const estimatedCreditCost = averageCreditsPerNight * (this.creditValueCents / 100);

        // Estimated profit per night
        const estimatedProfit = estimatedNightlyRate - estimatedCreditCost;

        // Compound profit score
        const profitScore = estimatedProfit * distancePenalty * categoryMultiplier;

        return {
            profitScore: Math.round(profitScore * 100) / 100,
            estimatedNightlyRate,
            estimatedCreditCost: Math.round(estimatedCreditCost * 100) / 100,
            estimatedProfit: Math.round(estimatedProfit * 100) / 100,
        };
    }

    private upsertOpportunity(
        resort: ResortRow,
        event: EventRow,
        distance: number,
        score: { profitScore: number; estimatedNightlyRate: number; estimatedCreditCost: number; estimatedProfit: number },
    ): void {
        const existing = this.db.prepare(
            'SELECT id FROM opportunities WHERE resort_id = ? AND event_id = ?'
        ).get(resort.id, event.id) as { id: string } | undefined;

        if (existing) {
            this.db.prepare(`
        UPDATE opportunities SET
          distance_miles = ?, profit_score = ?, estimated_nightly_rate = ?,
          estimated_credit_cost = ?, estimated_profit = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(distance, score.profitScore, score.estimatedNightlyRate, score.estimatedCreditCost, score.estimatedProfit, existing.id);
        } else {
            this.db.prepare(`
        INSERT INTO opportunities (id, resort_id, event_id, distance_miles, profit_score,
          estimated_nightly_rate, estimated_credit_cost, estimated_profit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
                uuidv4(), resort.id, event.id, distance, score.profitScore,
                score.estimatedNightlyRate, score.estimatedCreditCost, score.estimatedProfit,
            );
        }
    }

    private assignRanks(): void {
        this.db.exec(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY profit_score DESC) as new_rank
        FROM opportunities
        WHERE status IN ('pending', 'available')
      )
      UPDATE opportunities SET rank = (
        SELECT new_rank FROM ranked WHERE ranked.id = opportunities.id
      )
      WHERE id IN (SELECT id FROM ranked)
    `);
    }

    getTopOpportunities(limit: number = 50): OpportunityWithDetailsRow[] {
        return this.db.prepare(`
      SELECT o.*, r.name as resort_name, r.city as resort_city, r.state as resort_state,
             r.latitude as resort_lat, r.longitude as resort_lng,
             e.name as event_name, e.start_date as event_date, e.category as event_category,
             e.venue_name, e.url as event_url, e.image_url as event_image
      FROM opportunities o
      JOIN resorts r ON o.resort_id = r.id
      JOIN events e ON o.event_id = e.id
      WHERE o.status IN ('pending', 'available')
        AND e.start_date >= date('now')
      ORDER BY o.rank ASC
      LIMIT ?
    `).all(limit) as OpportunityWithDetailsRow[];
    }

    getOpportunityCount(): number {
        const row = this.db.prepare(
            "SELECT COUNT(*) as count FROM opportunities WHERE status IN ('pending', 'available')"
        ).get() as { count: number };
        return row.count;
    }
}

export interface OpportunityWithDetailsRow extends OpportunityRow {
    resort_name: string;
    resort_city: string;
    resort_state: string;
    resort_lat: number;
    resort_lng: number;
    event_name: string;
    event_date: string;
    event_category: string;
    venue_name: string;
    event_url: string;
    event_image: string;
}
