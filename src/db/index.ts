import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('database');

let _db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (_db) return _db;

  const resolvedPath = dbPath || process.env.DATABASE_PATH || './data/worldmark.db';
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info({ dir }, 'Created database directory');
  }

  _db = new Database(resolvedPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  log.info({ path: resolvedPath }, 'Database connected');
  return _db;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    log.info('Database closed');
  }
}

export function initializeDatabase(db: Database.Database): void {
  log.info('Initializing database schema');

  db.exec(`
    CREATE TABLE IF NOT EXISTS resorts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL CHECK(brand IN ('worldmark', 'club_wyndham')),
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      unit_types TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_charts (
      id TEXT PRIMARY KEY,
      resort_id TEXT NOT NULL,
      unit_type TEXT NOT NULL,
      season TEXT NOT NULL CHECK(season IN ('red', 'white', 'blue')),
      day_type TEXT NOT NULL CHECK(day_type IN ('weekday', 'weekend', 'sunday')),
      credits_per_night INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('ticketmaster')),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      venue_name TEXT NOT NULL DEFAULT '',
      venue_city TEXT NOT NULL DEFAULT '',
      venue_state TEXT NOT NULL DEFAULT '',
      venue_latitude REAL NOT NULL,
      venue_longitude REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      estimated_attendance INTEGER,
      url TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(external_id, source)
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      resort_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      distance_miles REAL NOT NULL,
      profit_score REAL NOT NULL DEFAULT 0,
      estimated_nightly_rate REAL NOT NULL DEFAULT 0,
      estimated_credit_cost REAL NOT NULL DEFAULT 0,
      estimated_profit REAL NOT NULL DEFAULT 0,
      rank INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'available', 'unavailable', 'booked', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE(resort_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS availability (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL,
      resort_id TEXT NOT NULL,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      unit_type TEXT NOT NULL,
      credits_required INTEGER NOT NULL DEFAULT 0,
      is_available INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
      FOREIGN KEY (resort_id) REFERENCES resorts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('sms', 'push')),
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('sent', 'failed', 'pending')),
      error_message TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'ios' CHECK(platform IN ('ios', 'android')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL CHECK(stage IN ('resort_refresh', 'event_discovery', 'ranking', 'availability_check', 'notification')),
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      items_processed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
    CREATE INDEX IF NOT EXISTS idx_events_location ON events(venue_latitude, venue_longitude);
    CREATE INDEX IF NOT EXISTS idx_opportunities_rank ON opportunities(rank);
    CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
    CREATE INDEX IF NOT EXISTS idx_opportunities_resort ON opportunities(resort_id);
    CREATE INDEX IF NOT EXISTS idx_opportunities_event ON opportunities(event_id);
    CREATE INDEX IF NOT EXISTS idx_availability_opportunity ON availability(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(check_in_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_opportunity ON notifications(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_stage ON pipeline_runs(stage);
    CREATE INDEX IF NOT EXISTS idx_credit_charts_resort ON credit_charts(resort_id);
    CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
  `);

  log.info('Database schema initialized');
}
