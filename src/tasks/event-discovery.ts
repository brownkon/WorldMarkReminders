import { getConfig } from '../config';
import { getDatabase, initializeDatabase, closeDatabase } from '../db';
import { SchedulerService } from '../services/scheduler/scheduler.service';
import { logger } from '../utils/logger';

async function run() {
    try {
        logger.info('Starting manual event discovery task');
        const config = getConfig();
        const db = getDatabase(config.databasePath);
        initializeDatabase(db);

        const scheduler = new SchedulerService(db, config);

        // Run the quarterly event discovery AI task
        await scheduler.runAIEventDiscovery();

        logger.info('Event discovery completed successfully');
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to complete event discovery');
        process.exit(1);
    } finally {
        closeDatabase();
        process.exit(0);
    }
}

run();
