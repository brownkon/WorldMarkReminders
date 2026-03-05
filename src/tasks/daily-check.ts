import { getConfig } from '../config';
import { getDatabase, initializeDatabase, closeDatabase } from '../db';
import { SchedulerService } from '../services/scheduler/scheduler.service';
import { logger } from '../utils/logger';

async function run() {
    try {
        logger.info('Starting manual daily booking check task');
        const config = getConfig();
        const db = getDatabase(config.databasePath);
        initializeDatabase(db);

        const scheduler = new SchedulerService(db, config);

        // Run the daily task
        await scheduler.runDailyBookingCheck();

        logger.info('Daily booking check completed successfully');
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to complete daily booking check');
        process.exit(1);
    } finally {
        closeDatabase();
        process.exit(0);
    }
}

run();
