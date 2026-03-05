# Phase 4 — Availability Automation: Requirements

> **Author:** Architect | **Date:** 2026-02-18

---

## 1. Overview

Phase 4 implements Playwright-based browser automation to check room availability on the
WorldMark owner portal (https://owner.wyndhamdestinations.com). For the top N ranked
opportunities, the system logs into the portal, searches for availability at the target
resort and date range (±2 days around each event), parses the results, and stores them
in the `availability` table.

**Hard constraint (TC-5):** The system NEVER books rooms or triggers payments.
It is read-only scraping.

---

## 2. Components

### 2.1 `AvailabilityService` — `src/services/availability/availability.service.ts`

**Responsibilities:**
- Manage Playwright browser lifecycle (launch, close)
- Log into the WorldMark owner portal
- Navigate to availability search
- Execute search for a given resort name + check-in/check-out dates
- Parse search results (room types, credit costs, availability status)
- Persist results to the `availability` table
- Handle session expiration and re-login
- Rate-limit portal requests

**Constructor dependencies:**
- `db: Database.Database` — for persisting availability results
- `config: AvailabilityConfig` — portal credentials and rate limit settings

**Key interfaces:**

```typescript
interface AvailabilityConfig {
  username: string;
  password: string;
  /** Milliseconds to wait between portal requests (default: 5000) */
  requestDelayMs: number;
  /** Max concurrent browser pages (default: 1 — serial only) */
  maxConcurrency: number;
  /** Headless mode (default: true) */  
  headless: boolean;
  /** Navigation timeout ms (default: 30000) */
  navigationTimeoutMs: number;
}

interface AvailabilityResult {
  resortId: string;
  opportunityId: string;
  checkInDate: string;   // YYYY-MM-DD
  checkOutDate: string;  // YYYY-MM-DD
  unitType: string;      // e.g. 'Studio', '1BR', '2BR'
  creditsRequired: number;
  isAvailable: boolean;
}

interface AvailabilityCheckSummary {
  opportunitiesChecked: number;
  totalSearches: number;
  availableResults: number;
  errors: number;
}
```

### 2.2 Portal Automation Flow

1. **Launch browser** — Chromium, headless by default
2. **Login** — Navigate to login page, fill credentials, submit, wait for dashboard
3. **For each opportunity:**
   a. Navigate to availability search page
   b. Enter resort name
   c. For each date offset (-2, -1, 0, +1, +2 days from event):
       - Set check-in date
       - Set check-out date (check-in + 1 night)
       - Submit search
       - Parse results table for room types and credit costs
       - Store each result row in the `availability` table
   d. Rate-limit: wait `requestDelayMs` between searches
4. **Handle errors:**
   - Session expired → re-login, retry
   - Element not found → log & skip, continue
   - Timeout → log & skip, continue
   - Portal down → abort and report

### 2.3 Portal Page Objects (Internal)

Encapsulate Playwright selectors/interactions in a `WorldMarkPortalPage` helper class
(private to the service, not exported). This follows the Page Object pattern
for maintainability when the portal HTML changes.

```typescript
class WorldMarkPortalPage {
  constructor(private page: Page) {}
  
  async login(username: string, password: string): Promise<boolean>
  async isLoggedIn(): Promise<boolean>
  async searchAvailability(resortName: string, checkIn: string, checkOut: string): Promise<AvailabilityResult[]>
  async close(): Promise<void>
}
```

---

## 3. Database Usage

Uses the existing `availability` table:

```sql
availability (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  resort_id TEXT NOT NULL,
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  credits_required INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id),
  FOREIGN KEY (resort_id) REFERENCES resorts(id)
)
```

**Upsert strategy:** For each (opportunity_id, check_in_date, unit_type) combination,
update the existing row or insert a new one. This prevents duplicate entries
for repeated checks.

---

## 4. Integration Points

### 4.1 SchedulerService

Add a new method `runAvailabilityCheck()` that:
1. Creates a pipeline run with stage `'availability_check'`
2. Gets top N opportunities from RankingService
3. Calls AvailabilityService to check each
4. Updates opportunity status to `'available'` or `'unavailable'`
5. Completes the pipeline run

### 4.2 API Routes

Add endpoints:
- `POST /api/pipeline/availability` — Manual trigger for availability check
- `GET /api/availability/:opportunityId` — Get availability results for an opportunity

### 4.3 Cron Integration

Wire `runAvailabilityCheck()` into the existing `availabilityCheckCron` schedule
(currently running `runNotifications()`). The new flow:
availability check → notifications.

### 4.4 Full Pipeline Update

Update `runFullPipeline()`: resorts → events → ranking → **availability** → notifications.

---

## 5. Rate Limiting & Portal Etiquette (TC-3)

- **Minimum 5 seconds between searches** (configurable via `requestDelayMs`)
- **Serial execution only** — one page, one search at a time
- **Max 100 searches per session** — close browser and re-open after 100 searches
- **Respect robots.txt** — log a warning if portal has restrictive robots.txt
- **User-Agent** — use a standard browser user agent (Playwright default is fine)
- **No booking actions** — never click "Book" or "Reserve" buttons

---

## 6. Error Handling

| Scenario | Action |
|---|---|
| Login failure (bad credentials) | Throw, abort all checks |
| Login failure (portal down / timeout) | Retry once, then throw |
| Session expired mid-check | Re-login, retry current search |
| Search returns no results | Store as unavailable, continue |
| Unexpected page structure | Log warning, skip, continue |
| Rate limit / captcha detected | Log error, abort session |
| Browser crash | Log error, relaunch browser, retry |

---

## 7. Configuration

Add to `.env.example`:

```bash
# Availability Check Settings
AVAILABILITY_REQUEST_DELAY_MS=5000
AVAILABILITY_HEADLESS=true
AVAILABILITY_NAV_TIMEOUT_MS=30000
```

These are optional — the service will use sensible defaults.

---

## 8. Testing Strategy

### 8.1 Unit Tests (`tests/availability.service.test.ts`)

- **Mock Playwright** entirely — no real browser needed
- Test: login flow (success / failure / session expired)
- Test: search flow (results found / no results / parse error)
- Test: date offset calculation (±2 days)
- Test: availability upsert (new record / update existing)
- Test: rate limiting (delay between requests)
- Test: opportunity status update after check
- Test: error recovery (re-login on session expiry)

### 8.2 Integration (manual, not automated)

- Run against the real portal with real credentials (manual only)
- Verify login, search, parse cycle end-to-end

---

## 9. File Structure

```
src/services/availability/
├── availability.service.ts    # Main service class
├── portal.page.ts             # Page Object for WorldMark portal
└── types.ts                   # Shared interfaces
```

---

## 10. Acceptance Criteria

1. ✅ `AvailabilityService` can launch Playwright, login, and search
2. ✅ Search parses room types and credit costs from results
3. ✅ Results stored in `availability` table with correct foreign keys
4. ✅ ±2 day window around event date is checked (5 searches per opportunity)
5. ✅ Opportunity status updated to `available` / `unavailable`
6. ✅ Rate limiting: ≥5 second gap between requests
7. ✅ Session expiration handled with automatic re-login
8. ✅ All unit tests pass with mocked Playwright
9. ✅ Pipeline integration: availability stage in `runFullPipeline()`
10. ✅ API endpoints for manual trigger and result retrieval
