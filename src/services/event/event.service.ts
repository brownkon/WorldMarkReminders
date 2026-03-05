import axios, { AxiosInstance } from 'axios';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../utils/logger';
import { ResortRow } from '../resort/resort.service';
import { distanceMiles } from '../../utils/geo';

const log = createChildLogger('event-service');

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export interface TicketmasterEvent {
    id: string;
    name: string;
    type: string;
    url: string;
    dates: {
        start: { localDate: string; localTime?: string };
        end?: { localDate?: string };
    };
    classifications?: Array<{
        segment?: { name: string };
        genre?: { name: string };
        subGenre?: { name: string };
    }>;
    _embedded?: {
        venues?: Array<{
            name: string;
            city?: { name: string };
            state?: { stateCode: string };
            location?: { latitude: string; longitude: string };
        }>;
    };
    images?: Array<{ url: string; ratio?: string; width?: number }>;
    priceRanges?: Array<{ min: number; max: number }>;
}

export interface TicketmasterResponse {
    _embedded?: {
        events: TicketmasterEvent[];
    };
    page: {
        size: number;
        totalElements: number;
        totalPages: number;
        number: number;
    };
}

export interface EventRow {
    id: string;
    external_id: string;
    source: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    venue_name: string;
    venue_city: string;
    venue_state: string;
    venue_latitude: number;
    venue_longitude: number;
    start_date: string;
    end_date: string | null;
    estimated_attendance: number | null;
    url: string;
    image_url: string;
    created_at: string;
    updated_at: string;
}

export class EventService {
    private client: AxiosInstance;

    constructor(
        private db: Database.Database,
        private apiKey: string,
    ) {
        this.client = axios.create({
            baseURL: TICKETMASTER_BASE_URL,
            timeout: 15000,
        });
    }

    /**
     * Discover events near a resort within the given radius and date range.
     */
    async discoverEventsForResort(
        resort: ResortRow,
        radiusMiles: number = 30,
        monthsAhead: number = 13,
    ): Promise<number> {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + monthsAhead);

        const startDateStr = startDate.toISOString().split('T')[0] + 'T00:00:00Z';
        const endDateStr = endDate.toISOString().split('T')[0] + 'T23:59:59Z';

        let page = 0;
        let totalInserted = 0;
        let hasMore = true;

        while (hasMore && page < 5) { // Cap at 5 pages (1000 events) per resort
            try {
                const response = await this.client.get<TicketmasterResponse>('/events.json', {
                    params: {
                        apikey: this.apiKey,
                        latlong: `${resort.latitude},${resort.longitude}`,
                        radius: radiusMiles.toString(),
                        unit: 'miles',
                        startDateTime: startDateStr,
                        endDateTime: endDateStr,
                        size: 200,
                        page,
                        sort: 'relevance,desc',
                        classificationName: 'Music,Sports', // Focus on major categories
                    },
                });

                const events = response.data._embedded?.events || [];
                if (events.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const event of events) {
                    const nameLower = event.name.toLowerCase();
                    const venueName = event._embedded?.venues?.[0]?.name?.toLowerCase() || '';

                    // 1. Exclude "Small" event keywords
                    if (
                        nameLower.includes('parking') ||
                        nameLower.includes('shuttle') ||
                        nameLower.includes('package') ||
                        nameLower.includes('tribute') ||
                        nameLower.includes('cover band') ||
                        nameLower.includes('open mic') ||
                        nameLower.includes('jam session')
                    ) {
                        continue;
                    }

                    // 2. Exclude "Small" venue keywords
                    // If it's a "Pub", "Cafe", "Library", "High School", it's likely too small
                    if (
                        venueName.includes('pub') ||
                        venueName.includes('cafe') ||
                        venueName.includes('coffee') ||
                        venueName.includes('high school') ||
                        venueName.includes('library') ||
                        (venueName.includes('bar') && !venueName.includes('arena') && !venueName.includes('bclive'))
                    ) {
                        continue;
                    }

                    const inserted = this.upsertEvent(event);
                    if (inserted) totalInserted++;
                }

                hasMore = page < response.data.page.totalPages - 1;
                page++;

                // Rate limiting: Ticketmaster allows 5 requests/sec
                await this.sleep(250);
            } catch (error: any) {
                if (error.response?.status === 429) {
                    log.warn({ resort: resort.name }, 'Rate limited by Ticketmaster, backing off');
                    await this.sleep(2000);
                    continue;
                }
                log.error({ error: error.message, resort: resort.name }, 'Failed to fetch events from Ticketmaster');
                hasMore = false;
            }
        }

        log.info({ resort: resort.name, eventsFound: totalInserted }, 'Discovered events for resort');
        return totalInserted;
    }

    /**
     * Discover events for all resorts in the database.
     */
    async discoverEventsForAllResorts(radiusMiles: number = 30): Promise<number> {
        const resorts = this.db.prepare('SELECT * FROM resorts').all() as ResortRow[];
        let totalEvents = 0;

        for (const resort of resorts) {
            const count = await this.discoverEventsForResort(resort, radiusMiles);
            totalEvents += count;
            // Brief pause between resorts
            await this.sleep(500);
        }

        log.info({ totalEvents, resortCount: resorts.length }, 'Event discovery complete');
        return totalEvents;
    }

    /**
     * Discover events by querying specific high-level keywords (from AI).
     */
    async discoverEventsByKeywords(keywords: string[]): Promise<number> {
        let totalInserted = 0;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 13);
        const startDateStr = startDate.toISOString().split('T')[0] + 'T00:00:00Z';
        const endDateStr = endDate.toISOString().split('T')[0] + 'T23:59:59Z';

        log.info({ keywordsCount: keywords.length }, 'Starting event discovery via keywords');

        for (const keyword of keywords) {
            let page = 0;
            let hasMore = true;

            while (hasMore && page < 2) { // Just get the top 2 pages per keyword
                try {
                    const response = await this.client.get<TicketmasterResponse>('/events.json', {
                        params: {
                            apikey: this.apiKey,
                            keyword: keyword,
                            countryCode: 'US', // Focus on US for now
                            startDateTime: startDateStr,
                            endDateTime: endDateStr,
                            size: 100,
                            page,
                            sort: 'relevance,desc',
                        },
                    });

                    const events = response.data._embedded?.events || [];
                    if (events.length === 0) {
                        break;
                    }

                    for (const event of events) {
                        // Ticketmaster keyword search is often too broad and includes unrelated recommendations.
                        // We ONLY want events that literally match the exact keyword we requested.
                        const nameLower = event.name.toLowerCase();
                        const keyLower = keyword.toLowerCase();

                        // Strict check: if the keyword isn't in the title of the event, skip it.
                        if (!nameLower.includes(keyLower)) {
                            continue;
                        }

                        const inserted = this.upsertEvent(event);
                        if (inserted) totalInserted++;
                    }

                    hasMore = page < response.data.page.totalPages - 1;
                    page++;

                    await this.sleep(250);
                } catch (error: any) {
                    if (error.response?.status === 429) {
                        log.warn({ keyword }, 'Rate limited by Ticketmaster on keywords, backing off');
                        await this.sleep(2000);
                        continue;
                    }
                    log.error({ error: error.message, keyword }, 'Failed to fetch events by keyword');
                    break;
                }
            }
        }

        log.info({ totalEvents: totalInserted }, 'Keyword event discovery complete');
        return totalInserted;
    }

    /**
     * Get events near a specific location.
     */
    getEventsNearLocation(lat: number, lng: number, radiusMiles: number = 30): EventRow[] {
        // SQLite doesn't have geospatial functions, so we use a bounding box + Haversine
        const latDelta = radiusMiles / 69.0; // ~69 miles per degree latitude
        const lngDelta = radiusMiles / (69.0 * Math.cos(lat * Math.PI / 180));

        const rows = this.db.prepare(`
      SELECT * FROM events
      WHERE venue_latitude BETWEEN ? AND ?
        AND venue_longitude BETWEEN ? AND ?
        AND start_date >= date('now')
      ORDER BY start_date ASC
    `).all(
            lat - latDelta, lat + latDelta,
            lng - lngDelta, lng + lngDelta,
        ) as EventRow[];

        // Filter by actual Haversine distance
        return rows.filter(event =>
            distanceMiles(lat, lng, event.venue_latitude, event.venue_longitude) <= radiusMiles
        );
    }

    /**
     * Get all upcoming events.
     */
    getUpcomingEvents(limit: number = 100): EventRow[] {
        return this.db.prepare(`
      SELECT * FROM events
      WHERE start_date >= date('now')
      ORDER BY start_date ASC
      LIMIT ?
    `).all(limit) as EventRow[];
    }

    getEventCount(): number {
        const row = this.db.prepare("SELECT COUNT(*) as count FROM events WHERE start_date >= date('now')").get() as { count: number };
        return row.count;
    }

    private upsertEvent(tmEvent: TicketmasterEvent): boolean {
        const venue = tmEvent._embedded?.venues?.[0];
        const classification = tmEvent.classifications?.[0];
        const image = tmEvent.images?.find(i => i.ratio === '16_9') || tmEvent.images?.[0];

        if (!venue?.location?.latitude || !venue?.location?.longitude) {
            return false; // Skip events without coordinates
        }

        const existing = this.db.prepare(
            'SELECT id FROM events WHERE external_id = ? AND source = ?'
        ).get(tmEvent.id, 'ticketmaster');

        if (existing) return false; // Already stored

        try {
            this.db.prepare(`
        INSERT INTO events (id, external_id, source, name, description, category, subcategory,
          venue_name, venue_city, venue_state, venue_latitude, venue_longitude,
          start_date, end_date, estimated_attendance, url, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                uuidv4(),
                tmEvent.id,
                'ticketmaster',
                tmEvent.name,
                '', // description
                classification?.segment?.name || '',
                classification?.genre?.name || '',
                venue.name || '',
                venue.city?.name || '',
                venue.state?.stateCode || '',
                parseFloat(venue.location.latitude),
                parseFloat(venue.location.longitude),
                tmEvent.dates.start.localDate,
                tmEvent.dates.end?.localDate || null,
                null, // estimated attendance
                tmEvent.url || '',
                image?.url || '',
            );
            return true;
        } catch (error: any) {
            log.debug({ error: error.message, event: tmEvent.name }, 'Event upsert failed');
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
