import express, { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '../utils/logger';
import { SchedulerService } from '../services/scheduler/scheduler.service';

const log = createChildLogger('api');

export function createApiRouter(
    scheduler: SchedulerService,
    apiKey: string,
): express.Router {
    const router = express.Router();

    // API Key auth middleware
    const authenticate = (req: Request, res: Response, next: NextFunction): void => {
        const key = req.headers['x-api-key'] || req.query.apiKey;
        if (key !== apiKey) {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
            return;
        }
        next();
    };

    router.use(authenticate);

    // ===============================
    // Dashboard
    // ===============================

    router.get('/dashboard', (req: Request, res: Response) => {
        try {
            const resortService = scheduler.getResortService();
            const eventService = scheduler.getEventService();
            const rankingService = scheduler.getRankingService();
            const notificationService = scheduler.getNotificationService();

            const minProfit = parseFloat(req.query.minProfit as string) || 0;
            const limit = parseInt(req.query.limit as string) || 20;

            let topOpportunities = rankingService.getTopOpportunities(limit);
            if (minProfit > 0) {
                topOpportunities = topOpportunities.filter(o => o.estimated_profit >= minProfit);
            }

            const recentAlerts = notificationService.getRecentNotifications(10);
            const unreadCount = notificationService.getUnreadNotifications().length;
            const upcomingEvents = eventService.getUpcomingEvents(20);
            const pipelineRuns = scheduler.getLastPipelineRuns();

            res.json({
                data: {
                    topOpportunities,
                    recentAlerts,
                    unreadNotificationCount: unreadCount,
                    upcomingEvents,
                    lastPipelineRuns: pipelineRuns,
                    stats: {
                        totalResorts: resortService.getResortCount(),
                        totalEvents: eventService.getEventCount(),
                        totalOpportunities: rankingService.getOpportunityCount(),
                    },
                },
                meta: { timestamp: new Date().toISOString() },
            });
        } catch (error: any) {
            log.error({ error: error.message }, 'Dashboard request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Resorts
    // ===============================

    router.get('/resorts', (req: Request, res: Response) => {
        try {
            const brand = req.query.brand as string | undefined;
            const resortService = scheduler.getResortService();

            const resorts = brand
                ? resortService.getResortsByBrand(brand as 'worldmark' | 'club_wyndham')
                : resortService.getAllResorts();

            res.json({ data: resorts, meta: { timestamp: new Date().toISOString(), count: resorts.length } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Resorts request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.get('/resorts/:id', (req: Request, res: Response) => {
        try {
            const resortId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const resort = scheduler.getResortService().getResortById(resortId);
            if (!resort) {
                res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resort not found' } });
                return;
            }
            res.json({ data: resort, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Resort detail request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Events
    // ===============================

    router.get('/events', (req: Request, res: Response) => {
        try {
            const limit = parseInt(req.query.limit as string) || 100;
            const events = scheduler.getEventService().getUpcomingEvents(limit);
            res.json({ data: events, meta: { timestamp: new Date().toISOString(), count: events.length } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Events request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Opportunities
    // ===============================

    router.get('/opportunities', (req: Request, res: Response) => {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const minProfit = parseFloat(req.query.minProfit as string) || 0;

            let opportunities = scheduler.getRankingService().getTopOpportunities(limit);
            if (minProfit > 0) {
                opportunities = opportunities.filter(o => o.estimated_profit >= minProfit);
            }

            res.json({ data: opportunities, meta: { timestamp: new Date().toISOString(), count: opportunities.length } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Opportunities request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.get('/opportunities/:id', (req: Request, res: Response) => {
        try {
            const opportunityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const rankingService = scheduler.getRankingService();
            // removed availabilityService

            // Get the opportunity with details (resort + event)
            const allOpps = rankingService.getTopOpportunities(1000);
            const opportunity = allOpps.find(o => o.id === opportunityId);

            if (!opportunity) {
                res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Opportunity not found' } });
                return;
            }

            res.json({
                data: {
                    ...opportunity,
                },
                meta: { timestamp: new Date().toISOString() },
            });
        } catch (error: any) {
            log.error({ error: error.message }, 'Opportunity detail request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // Availability route removed

    // ===============================
    // Notifications
    // ===============================

    router.get('/notifications', (req: Request, res: Response) => {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const unreadOnly = req.query.unreadOnly === 'true';

            const notificationService = scheduler.getNotificationService();
            const notifications = unreadOnly
                ? notificationService.getUnreadNotifications()
                : notificationService.getRecentNotifications(limit);

            res.json({
                data: notifications,
                meta: {
                    timestamp: new Date().toISOString(),
                    count: notifications.length,
                    dailyCount: notificationService.getDailyNotificationCount(),
                    dailyLimit: notificationService.getDailyLimit(),
                },
            });
        } catch (error: any) {
            log.error({ error: error.message }, 'Notifications request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.patch('/notifications/:id/read', (req: Request, res: Response) => {
        try {
            const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const notificationService = scheduler.getNotificationService();
            const updated = notificationService.markAsRead(notificationId);

            if (!updated) {
                res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
                return;
            }

            res.json({ data: { id: notificationId, is_read: 1 }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Mark notification read failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.patch('/notifications/read-all', (req: Request, res: Response) => {
        try {
            const notificationService = scheduler.getNotificationService();
            const count = notificationService.markAllAsRead();
            res.json({ data: { markedRead: count }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Mark all notifications read failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Device Tokens (APNs)
    // ===============================

    router.post('/devices', (req: Request, res: Response) => {
        try {
            const { token, platform } = req.body || {};
            if (!token || typeof token !== 'string') {
                res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'token is required' } });
                return;
            }

            const apnsService = scheduler.getApnsService();
            const device = apnsService.registerDeviceToken(token, platform || 'ios');
            res.status(201).json({ data: device, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Device registration failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.delete('/devices/:token', (req: Request, res: Response) => {
        try {
            const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
            const apnsService = scheduler.getApnsService();
            const removed = apnsService.removeDeviceToken(token);

            if (!removed) {
                res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Device token not found' } });
                return;
            }

            res.json({ data: { removed: true }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Device removal failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.get('/devices', (req: Request, res: Response) => {
        try {
            const apnsService = scheduler.getApnsService();
            const devices = apnsService.getDeviceTokens();
            res.json({ data: devices, meta: { timestamp: new Date().toISOString(), count: devices.length } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Device list failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Settings
    // ===============================

    router.get('/settings', (req: Request, res: Response) => {
        try {
            const notificationService = scheduler.getNotificationService();
            const apnsService = scheduler.getApnsService();

            res.json({
                data: {
                    notificationDailyLimit: notificationService.getDailyLimit(),
                    ntfyEnabled: !!scheduler.getNotificationService(),
                    apnsConfigured: apnsService.isConfigured(),
                    registeredDevices: apnsService.getDeviceTokens().length,
                },
                meta: { timestamp: new Date().toISOString() },
            });
        } catch (error: any) {
            log.error({ error: error.message }, 'Settings request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Pipeline Triggers (Manual)
    // ===============================

    router.post('/pipeline/daily-check', async (req: Request, res: Response) => {
        try {
            log.info('Manual daily booking check triggered');
            scheduler.runDailyBookingCheck().catch(err =>
                log.error({ error: err.message }, 'Daily booking check failed')
            );
            res.json({ data: { message: 'Daily booking check started', status: 'running' }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Daily booking trigger failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.post('/pipeline/run', async (req: Request, res: Response) => {
        try {
            log.info('Manual full pipeline run triggered');
            scheduler.runFullPipeline().catch(err =>
                log.error({ error: err.message }, 'Pipeline run failed')
            );
            res.json({ data: { message: 'Pipeline started', status: 'running' }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Pipeline trigger failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    router.post('/pipeline/events', async (req: Request, res: Response) => {
        try {
            log.info('Manual event discovery triggered');
            scheduler.runAIEventDiscoveryAndNotify().catch((err: any) =>
                log.error({ error: err.message }, 'Event discovery failed')
            );
            res.json({ data: { message: 'Event discovery started', status: 'running' }, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Event discovery trigger failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Pipeline Status
    // ===============================

    router.get('/pipeline/status', (req: Request, res: Response) => {
        try {
            const runs = scheduler.getLastPipelineRuns();
            res.json({ data: runs, meta: { timestamp: new Date().toISOString() } });
        } catch (error: any) {
            log.error({ error: error.message }, 'Pipeline status request failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    });

    // ===============================
    // Test Notifications
    // ===============================

    router.post('/test-notification', async (req: Request, res: Response) => {
        try {
            const notificationService = scheduler.getNotificationService();
            const message = (req.body?.message as string) || 'WorldMark Scheduler is connected and working!';

            const result = await notificationService.sendTestNotification(message);

            if (result) {
                res.json({ data: { success: true, message: 'Notification sent' }, meta: { timestamp: new Date().toISOString() } });
            } else {
                res.json({ data: { success: false, message: 'Failed — check notification config' }, meta: { timestamp: new Date().toISOString() } });
            }
        } catch (error: any) {
            log.error({ error: error.message }, 'Test notification failed');
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
        }
    });

    // ===============================
    // Health Check
    // ===============================

    router.get('/health', (_req: Request, res: Response) => {
        res.json({ data: { status: 'ok' }, meta: { timestamp: new Date().toISOString() } });
    });

    return router;
}
