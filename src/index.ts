
import express from 'express';
import { getConfig } from './config';
import { getDatabase, initializeDatabase, closeDatabase } from './db';
import { createApiRouter } from './api/routes';
import { SchedulerService } from './services/scheduler/scheduler.service';
import { logger, createChildLogger } from './utils/logger';

const log = createChildLogger('main');

async function main(): Promise<void> {
    log.info('WorldMark Scheduler starting up');

    // Load config
    const config = getConfig();
    log.info({ port: config.port, env: config.nodeEnv }, 'Configuration loaded');

    // Initialize database
    const db = getDatabase(config.databasePath);
    initializeDatabase(db);

    // Create services
    const scheduler = new SchedulerService(db, config);

    // Seed resorts on startup
    const resortService = scheduler.getResortService();
    const resortCount = resortService.getResortCount();
    if (resortCount === 0) {
        log.info('No resorts found, seeding initial data');
        resortService.seedResorts();
    } else {
        log.info({ count: resortCount }, 'Resorts already seeded');
    }

    // Create Express app
    const app = express();
    app.use(express.json());

    // Mount API routes
    app.use('/api', createApiRouter(scheduler, config.apiKey));

    // Root health check (no auth required)
    app.get('/', (_req, res) => {
        res.json({
            name: 'WorldMark Scheduler',
            version: '1.0.0',
            status: 'running',
            timestamp: new Date().toISOString(),
        });
    });

    // Removed internal cron jobs - these are now triggered via external HTTP calls (e.g. GitHub Actions)

    // Start server
    const server = app.listen(config.port, () => {
        log.info({ port: config.port }, 'Server listening');
        log.info('API available at http://localhost:%d/api', config.port);
        log.info('Dashboard at http://localhost:%d/api/dashboard?apiKey=%s', config.port, config.apiKey);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
        log.info({ signal }, 'Shutting down');
        server.close(() => {
            closeDatabase();
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
    logger.fatal({ error: error.message }, 'Failed to start server');
    process.exit(1);
});
