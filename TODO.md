# WorldMark Scheduler — TODO

> **Last updated:** 2026-02-18
> Legend: ✅ Done | 🔲 Not started | 🟡 Partial

---

## Phase 1 — Foundation

- ✅ Project scaffolding (Node.js + TypeScript)
- ✅ Database schema (`resorts`, `credit_charts`, `events`, `opportunities`, `availability`, `notifications`, `pipeline_runs`)
- ✅ Resort registry — 58 WorldMark resorts seeded with GPS, unit types, URLs
- ✅ Configuration management (Zod-validated env config)
- ✅ Pino logger with child loggers
- ✅ Express API with API key auth
- ✅ Vitest test setup with path aliases
- ✅ Unit tests for: geo utils, database schema, resort service, ranking service, notifications

### Remaining

- 🔲 Expand resort list from 58 → 90+ (requirements say 90+, we have 58)
- 🔲 Add Club Wyndham exchange resorts (FR-1.2)
- 🔲 Populate `credit_charts` table with real per-resort/season/unit credit costs
- 🔲 Scrape WorldMark website for resort data enrichment (address, unit details)

---

## Phase 2 — Event Discovery

- ✅ Ticketmaster Discovery API integration (`event.service.ts`)
- ✅ Bounding box + Haversine distance filtering
- ✅ Event upsert with de-duplication (`UNIQUE(external_id, source)`)
- ✅ Resort-to-event proximity matching

### Remaining

- 🔲 **Test the Ticketmaster integration end-to-end** with a real API key
- 🔲 Add `event.service.test.ts` — currently no unit tests for EventService
- 🔲 Handle Ticketmaster API rate limits more robustly (429 backoff)
- 🔲 Add event pagination for high-density resort areas (>200 events)

---

## Phase 3 — Ranking Engine

- ✅ Profit scoring algorithm (`ranking.service.ts`)
- ✅ Market rate heuristics (category multipliers, attendance, weekend boost)
- ✅ Opportunity upsert and rank assignment
- ✅ Unit tests for ranking service

### Remaining

- 🔲 **Incorporate real credit chart data** into profit calculation (currently uses flat credit cost)
- 🔲 Improve `estimatedNightlyRate` — consider integrating a hotel price API or seasonal lookup table
- 🔲 Add Red/White/Blue season detection for score boosting (FR-3.2)
- 🔲 Add historical resale demand data per resort (FR-3.3)

---

## Phase 4 — Availability Automation ✅

- ✅ Create `src/services/availability/availability.service.ts`
- ✅ Create `src/services/availability/portal.page.ts` (Page Object pattern)
- ✅ Create `src/services/availability/types.ts` (config, result, summary interfaces)
- ✅ Implement Playwright-based WorldMark portal login
- ✅ Navigate to availability search for a given resort + date range
- ✅ Parse available room types and credit costs from search results
- ✅ Store results in the `availability` table (upsert strategy)
- ✅ Handle session expiration / re-login
- ✅ Rate-limit portal requests (respect WorldMark ToS — TC-3)
- ✅ Check ±2 days around each event date (FR-4.2)
- ✅ Write tests with mocked Playwright pages (15 tests)
- ✅ Add availability checking to the scheduler pipeline
- ✅ API endpoints: `GET /availability/:opportunityId`, `POST /pipeline/availability`

### Remaining

- 🔲 **Manual integration test against live WorldMark portal** (selectors may need updating)
- 🔲 Update CSS selectors in `portal.page.ts` once live portal structure is confirmed
- 🔲 Add Playwright browser installation to deployment (e.g., `npx playwright install chromium`)

---

## Phase 5 — Notifications ✅

- ✅ ntfy.sh push notification integration (`notification.service.ts`)
- ✅ Booking alert message formatting
- ✅ Rate limiting (configurable via `NOTIFICATION_DAILY_LIMIT`) and de-duplication (7-day window)
- ✅ Test notification endpoint (`POST /api/test-notification`)
- ✅ Unit tests for notification service
- ✅ **Notifications wired to availability pipeline** — `runNotifications` now reads availability data before sending alerts
- ✅ Apple Push Notification Service (APNs) integration (`apns.service.ts`)
- ✅ Dual delivery: ntfy.sh + APNs — failure in one channel doesn't block the other
- ✅ Device token management (register, remove, list) for iOS devices

### Remaining

- 🔲 Email-to-SMS fallback (Nodemailer + carrier gateway) per requirements

---

## Phase 6 — Flutter Companion App 🟡 IN PROGRESS

- ✅ **Scaffold Flutter project** (`companion_app`)
- ✅ Material 3 Dark Theme with Google Fonts (Outfit)
- ✅ **API Client** (`services/api_client.dart`) connecting to all backend endpoints
- ✅ **Data Models** (`models/models.dart`) using `fromJson` factories
- ✅ **Dashboard Screen** — Stats overview & top opportunities
- ✅ **Opportunities Screen** — Full list with pull-to-refresh
- ✅ **Notifications Screen** — Alerts list with read status toggle
- ✅ **Settings Screen** — Config view & manual pipeline triggers
- ✅ **Detail Screen** — Rich opportunity view with profit breakdown

### Remaining

- 🔲 **Push Notifications** — integrate `flutter_local_notifications` or `firebase_messaging` (or just native APNs handling via a plugin) specific to Flutter
- 🔲 **State Management** — Refactor `setState` to `Provider` or `Riverpod` if complexity grows (optional for MVP)
- 🔲 **App Icon** — Generate app icons
- 🔲 **Build & Run** — Verify on iOS Simulator

---

## Phase 7 — Deployment & Operations ⚠️ NOT STARTED

- 🔲 Create `Dockerfile` and `docker-compose.yml`
- 🔲 Set up health check monitoring
- 🔲 Deploy to VPS (DigitalOcean / Railway / Render)
- 🔲 Set up HTTPS (Let's Encrypt or reverse proxy)
- 🔲 Add structured log aggregation
- 🔲 Pipeline failure alerting (notify on cron job errors)

---

## Code Quality & Testing

- ✅ 89 tests passing across 8 test files
- 🔲 Add `event.service.test.ts` (missing — only service without tests)
- 🔲 Add `scheduler.service.test.ts`
- 🔲 Reach ≥80% test coverage target (SC-8)
- 🔲 Set up CI pipeline (GitHub Actions)
- 🔲 Add ESLint + Prettier configuration

---

## Priority Order (Recommended)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Add `event.service.test.ts` | Testing gap | Low |
| 2 | Test Ticketmaster integration e2e | Validates core pipeline | Low |
| 3 | Run Flutter app on Simulator | UI Verification | Medium |
| 4 | Populate credit chart data | Accurate profit scoring | Medium |
| 5 | Docker + deployment | Go live | Medium |
