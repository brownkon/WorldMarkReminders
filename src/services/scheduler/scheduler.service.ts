import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { createChildLogger } from '../../utils/logger';
import { ResortRow, ResortService } from '../resort/resort.service';
import { EventService } from '../event/event.service';
import { RankingService } from '../ranking/ranking.service';
import { NotificationService } from '../notification/notification.service';
import { ApnsService } from '../notification/apns.service';
// Removed playwright based availability service
import { GeminiService } from '../ai/gemini.service';
import { OpportunityWithDetailsRow } from '../ranking/ranking.service';
import { Config } from '../../config';
import { distanceMiles } from '../../utils/geo';

const log = createChildLogger('scheduler');

export interface PipelineRunRow {
    id: string;
    stage: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    items_processed: number;
    error_message: string | null;
}

export class SchedulerService {
    private resortService: ResortService;
    private eventService: EventService;
    private rankingService: RankingService;
    private notificationService: NotificationService;
    private apnsService: ApnsService;
    // removed availabilityService

    constructor(
        private db: Database.Database,
        private config: Config,
    ) {
        this.resortService = new ResortService(db);
        this.eventService = new EventService(db, config.ticketmasterApiKey);
        this.rankingService = new RankingService(db, config.creditValueCents, config.eventSearchRadiusMiles);
        this.apnsService = new ApnsService(db, {
            keyId: config.apnsKeyId,
            teamId: config.apnsTeamId,
            keyPath: config.apnsKeyPath,
            bundleId: config.apnsBundleId,
            production: config.nodeEnv === 'production',
        });
        this.notificationService = new NotificationService(db, {
            ntfyTopic: config.ntfyTopic,
            ntfyServer: config.ntfyServer,
            dailyLimit: config.notificationDailyLimit,
        }, this.apnsService);
        // removed availabilityService instantiation
    }

    /**
     * Legacy method if anything calls it. Calls both to replicate old behavior.
     */
    async runFullPipeline(): Promise<void> {
        log.info('Running full pipeline');
        await this.runAIEventDiscovery();
        await this.runDailyBookingCheck();
    }

    async runAIEventDiscoveryAndNotify(): Promise<PipelineRunRow> {
        return this.runAIEventDiscovery();
    }

    /**
     * Discover top 30 AI events and save them to the database.
     */
    async runAIEventDiscovery(): Promise<PipelineRunRow> {
        const runId = this.startPipelineRun('event_discovery');
        const gemini = this.config.geminiApiKey ? new GeminiService(this.config.geminiApiKey) : null;

        try {
            if (!gemini) {
                log.warn('No Gemini API key provided. Cannot run simplified AI pipeline.');
                return this.failPipelineRun(runId, 'No Gemini API Key');
            }

            log.info('Using Gemini AI to discover top 30 upcoming events...');
            const events = await gemini.getTopUpcomingEventsWithDetails();

            log.info('Clearing expired active events...');
            this.db.prepare("DELETE FROM events WHERE start_date < date('now') AND source = 'ticketmaster'").run();

            const resorts = this.db.prepare('SELECT * FROM resorts').all() as ResortRow[];
            let itemsProcessed = 0;

            for (const aiEvent of events) {
                const externalId = `ai-${aiEvent.name.replace(/\s+/g, '-').toLowerCase()}-${aiEvent.startDate}`;

                const existingEvent = this.db.prepare(`
                    SELECT id FROM events WHERE external_id = ? AND source = 'ticketmaster'
                `).get(externalId) as { id: string } | undefined;

                if (existingEvent) {
                    continue; // Already processed this AI event exactly
                }

                // Check for geographic duplicates on the same date (e.g. 'Lollapalooza 2026' vs 'Lollapalooza Chicago 2026')
                const sameDayEvents = this.db.prepare(`
                    SELECT venue_latitude, venue_longitude FROM events WHERE start_date = ? AND source = 'ticketmaster'
                `).all(aiEvent.startDate) as { venue_latitude: number, venue_longitude: number }[];

                const isGeoDuplicate = sameDayEvents.some(existing => {
                    return distanceMiles(aiEvent.latitude, aiEvent.longitude, existing.venue_latitude, existing.venue_longitude) <= 15;
                });

                if (isGeoDuplicate) {
                    continue; // Likely the exact same event just named slightly differently by the AI
                }

                const eventId = uuidv4();
                this.db.prepare(`
                    INSERT INTO events (id, external_id, source, name, venue_city, venue_state, venue_latitude, venue_longitude, start_date, end_date, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    eventId,
                    externalId,
                    'ticketmaster',
                    aiEvent.name,
                    aiEvent.city || '',
                    aiEvent.state || '',
                    aiEvent.latitude || 0,
                    aiEvent.longitude || 0,
                    aiEvent.startDate,
                    aiEvent.endDate || aiEvent.startDate,
                    'AI Discovered'
                );

                let nearestResort: ResortRow | null = null;
                let minDistance = Infinity;

                for (const resort of resorts) {
                    const dist = distanceMiles(aiEvent.latitude, aiEvent.longitude, resort.latitude, resort.longitude);
                    if (dist < minDistance && dist <= 60) {
                        minDistance = dist;
                        nearestResort = resort;
                    }
                }

                if (!nearestResort) {
                    continue;
                }

                const oppId = uuidv4();
                this.db.prepare(`
                    INSERT INTO opportunities (id, resort_id, event_id, distance_miles, profit_score, estimated_nightly_rate, estimated_credit_cost, estimated_profit, rank, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(oppId, nearestResort.id, eventId, Math.round(minDistance), 100, 200, 10000, 100, 1, 'pending');

                itemsProcessed++;
            }

            // Save active tracked list to JSON file for user inspection (Properly weeded)
            const eventsPath = path.join(path.dirname(this.config.databasePath), 'latest_ai_events.json');
            const activeEvents = this.db.prepare("SELECT * FROM events WHERE source = 'ticketmaster' ORDER BY start_date ASC").all();
            fs.writeFileSync(eventsPath, JSON.stringify(activeEvents, null, 2));
            log.info({ path: eventsPath, count: activeEvents.length }, 'Saved active, weeded out AI events list to local JSON file');

            return this.completePipelineRun(runId, itemsProcessed);
        } catch (error: any) {
            log.error({ err: error.message }, 'AI discovery failed');
            return this.failPipelineRun(runId, error.message);
        }
    }

    /**
     * Check stored AI events to see if booking window is open, send notifications
     */
    async runDailyBookingCheck(): Promise<PipelineRunRow> {
        const runId = this.startPipelineRun('availability_check');
        let sentCount = 0;

        try {
            log.info('Running daily booking check for stored opportunities...');

            const opportunities = this.db.prepare(`
                SELECT o.id as oppId, o.distance_miles, e.name as event_name, e.venue_city as city, 
                       e.venue_state as state, e.start_date as start_date, r.name as resort_name
                FROM opportunities o
                JOIN events e ON o.event_id = e.id
                JOIN resorts r ON o.resort_id = r.id
            `).all() as any[];

            const now = new Date();

            for (const opp of opportunities) {
                const eventDateMs = new Date(opp.start_date).getTime();
                const thirteenMonthsMs = 13 * 30.44 * 24 * 60 * 60 * 1000;
                const bookingOpenDateMs = eventDateMs - thirteenMonthsMs;

                const openDate = new Date(bookingOpenDateMs);

                // Extract YYYY-MM-DD from the UTC openDate (since start_date was parsed as UTC midnight)
                const openDateStr = `${openDate.getUTCFullYear()}-${String(openDate.getUTCMonth() + 1).padStart(2, '0')}-${String(openDate.getUTCDate()).padStart(2, '0')}`;

                // Get today's local date in YYYY-MM-DD
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                // Check if notification already sent for this exact opportunity
                const pastNotification = this.db.prepare("SELECT id FROM notifications WHERE opportunity_id = ? AND status = 'sent' LIMIT 1").get(opp.oppId);

                // Send if window is open and we haven't sent previously
                if (!pastNotification && now.getTime() >= bookingOpenDateMs) {
                    const isRetroactive = now.getTime() - bookingOpenDateMs > 24 * 60 * 60 * 1000;
                    const suffixMsg = isRetroactive ? `is already OPEN! Book now before rooms fill.` : `opens TODAY (${openDateStr})!`;

                    const msg = `🚨 WorldMark Booking Alert!\n\nEvent: ${opp.event_name} in ${opp.city}, ${opp.state} (${opp.start_date})\nClosest Resort: ${opp.resort_name} (${Math.round(opp.distance_miles)} miles away)\n\nThe 13-month out booking window ${suffixMsg}`;
                    await this.notificationService.sendNotification(opp.oppId, msg);
                    sentCount++;
                }
            }

            return this.completePipelineRun(runId, sentCount);
        } catch (error: any) {
            log.error({ err: error.message }, 'Daily booking check failed');
            return this.failPipelineRun(runId, error.message);
        }
    }

    getLastPipelineRuns(): PipelineRunRow[] {
        return this.db.prepare(`
            SELECT * FROM pipeline_runs
            WHERE id IN (
                SELECT id FROM pipeline_runs p2
                WHERE p2.stage = pipeline_runs.stage
                ORDER BY started_at DESC
                LIMIT 1
            )
            ORDER BY started_at DESC
        `).all() as PipelineRunRow[];
    }

    getResortService(): ResortService { return this.resortService; }
    getEventService(): EventService { return this.eventService; }
    getRankingService(): RankingService { return this.rankingService; }
    getNotificationService(): NotificationService { return this.notificationService; }
    getApnsService(): ApnsService { return this.apnsService; }
    // removed getAvailabilityService()

    private startPipelineRun(stage: string): string {
        const id = uuidv4();
        this.db.prepare(`
            INSERT INTO pipeline_runs (id, stage, status) VALUES (?, ?, 'running')
        `).run(id, stage);
        log.info({ stage, runId: id }, 'Pipeline stage started');
        return id;
    }

    private completePipelineRun(id: string, itemsProcessed: number): PipelineRunRow {
        this.db.prepare(`
            UPDATE pipeline_runs SET status = 'completed', completed_at = datetime('now'), items_processed = ?
            WHERE id = ?
        `).run(itemsProcessed, id);

        const run = this.db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRunRow;
        log.info({ runId: id, stage: run.stage, itemsProcessed }, 'Pipeline stage completed');
        return run;
    }

    private failPipelineRun(id: string, errorMessage: string): PipelineRunRow {
        this.db.prepare(`
            UPDATE pipeline_runs SET status = 'failed', completed_at = datetime('now'), error_message = ?
            WHERE id = ?
        `).run(errorMessage, id);

        const run = this.db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRunRow;
        log.error({ runId: id, stage: run.stage, error: errorMessage }, 'Pipeline stage failed');
        return run;
    }
}
