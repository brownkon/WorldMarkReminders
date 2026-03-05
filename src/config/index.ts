import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
    // WorldMark Portal
    worldmarkUsername: z.string().min(1, 'WORLDMARK_USERNAME is required'),
    worldmarkPassword: z.string().min(1, 'WORLDMARK_PASSWORD is required'),

    // Ticketmaster
    ticketmasterApiKey: z.string().min(1, 'TICKETMASTER_API_KEY is required'),



    // Notifications (ntfy.sh)
    ntfyTopic: z.string().default(''),
    ntfyServer: z.string().default('https://ntfy.sh'),

    // Notification settings
    notificationDailyLimit: z.coerce.number().default(20),

    // APNs
    apnsKeyId: z.string().default(''),
    apnsTeamId: z.string().default(''),
    apnsBundleId: z.string().default(''),
    apnsKeyPath: z.string().default('./certs/AuthKey.p8'),

    // Server
    port: z.coerce.number().default(3000),
    apiKey: z.string().default('dev-api-key'),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

    // Scheduling
    resortRefreshCron: z.string().default('0 0 1 */3 *'),
    eventDiscoveryCron: z.string().default('0 0 1 */3 *'),
    availabilityCheckCron: z.string().default('0 6 * * *'),

    // Ranking
    creditValueCents: z.coerce.number().default(10),
    minProfitThreshold: z.coerce.number().default(60),
    eventSearchRadiusMiles: z.coerce.number().default(30),
    topOpportunitiesCount: z.coerce.number().default(50),
    availabilityRequestDelayMs: z.coerce.number().default(1000),

    // AI
    geminiApiKey: z.string().optional(),

    // Database
    databasePath: z.string().default('./data/worldmark.db'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
    const raw = {
        worldmarkUsername: process.env.WORLDMARK_USERNAME,
        worldmarkPassword: process.env.WORLDMARK_PASSWORD,
        ticketmasterApiKey: process.env.TICKETMASTER_API_KEY,

        ntfyTopic: process.env.NTFY_TOPIC,
        ntfyServer: process.env.NTFY_SERVER,
        notificationDailyLimit: process.env.NOTIFICATION_DAILY_LIMIT,
        apnsKeyId: process.env.APNS_KEY_ID,
        apnsTeamId: process.env.APNS_TEAM_ID,
        apnsKeyPath: process.env.APNS_KEY_PATH,
        apnsBundleId: process.env.APNS_BUNDLE_ID,
        port: process.env.PORT,
        apiKey: process.env.API_KEY,
        nodeEnv: process.env.NODE_ENV,
        resortRefreshCron: process.env.RESORT_REFRESH_CRON,
        eventDiscoveryCron: process.env.EVENT_DISCOVERY_CRON,
        availabilityCheckCron: process.env.AVAILABILITY_CHECK_CRON,
        creditValueCents: process.env.CREDIT_VALUE_CENTS,
        minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD,
        eventSearchRadiusMiles: process.env.EVENT_SEARCH_RADIUS_MILES,
        topOpportunitiesCount: process.env.TOP_OPPORTUNITIES_COUNT,
        availabilityRequestDelayMs: process.env.AVAILABILITY_REQUEST_DELAY_MS,
        geminiApiKey: process.env.GEMINI_API_KEY,
        databasePath: process.env.DATABASE_PATH,
    };

    return configSchema.parse(raw);
}

let _config: Config | null = null;

export function getConfig(): Config {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

export function getConfigSafe(): Config | null {
    try {
        return getConfig();
    } catch {
        return null;
    }
}

export function resetConfig(): void {
    _config = null;
}
