# WorldMark Scheduler — Requirements Document

## 1. Project Overview

WorldMark Scheduler is a **server-side automation system** with a **lightweight iOS companion app** that helps the owner monetize ~50,000 unused WorldMark by Wyndham timeshare credits by:

1. Discovering upcoming high-demand events near WorldMark/Club Wyndham resort locations.
2. Checking room availability on the WorldMark owner portal around those event dates.
3. Ranking opportunities by estimated resale profit (market hotel rate vs. credit cost).
4. Sending SMS + push notifications with specific booking recommendations.

The owner then manually books the recommended rooms and resells them to third parties.

> **Constraint**: The system will NEVER automatically book rooms or trigger any payment. It is **advisory only**.

---

## 2. Functional Requirements

### FR-1: Resort Registry

- **FR-1.1**: Maintain a local database of all WorldMark by Wyndham resorts (90+ locations) with:
  - Resort name, address, GPS coordinates (lat/lng)
  - Credit cost chart per unit type, season, and day-of-week (Red/White/Blue seasons)
  - Unit types available (Studio, 1BR, 2BR, 3BR, etc.)
  - Booking windows and rules
- **FR-1.2**: Maintain a secondary list of Club Wyndham resorts accessible via exchange.
- **FR-1.3**: Refresh the resort list periodically (quarterly) by scraping the WorldMark website.

### FR-2: Event Discovery

- **FR-2.1**: For each resort location, search for events within a configurable radius (default: 30 miles) in the 13-month booking window.
- **FR-2.2**: Event source:
  - **Ticketmaster Discovery API** (free) — concerts, sports, festivals, theater
  > *Note: SeatGeek and PredictHQ were considered but excluded — if an event isn't on Ticketmaster, it's unlikely to generate enough hotel demand to be worth the credit spend.*
- **FR-2.3**: Categorize events by type and estimated attendance/demand impact.
- **FR-2.4**: De-duplicate events across sources.
- **FR-2.5**: Store discovered events with metadata:
  - Event name, date/time, venue, category
  - Estimated attendance (if available)
  - Distance from nearest resort

### FR-3: Opportunity Ranking

- **FR-3.1**: Score each resort+event combination by estimated profit:
  - `Estimated Profit = Estimated Nightly Market Rate − (Credit Cost × Credit Value)`
  - Where `Credit Value` is the owner's effective cost per credit (configurable).
- **FR-3.2**: Boost scores for:
  - Large-attendance events (>10,000 estimated attendees)
  - Multi-day events (festivals, conventions)
  - Events in resort-dense areas with low supply (e.g., beach towns)
  - Weekend events (Fri/Sat nights)
  - Events during Red Season (highest regular hotel prices)
- **FR-3.3**: Penalize scores for:
  - Events far from any resort (>30 miles)
  - Low-demand event categories
  - Resorts with historically low resale demand
- **FR-3.4**: Persist ranked opportunities in the database for display in the companion app.

### FR-4: Availability Checking

- **FR-4.1**: Log into the WorldMark owner portal using stored credentials (via Playwright browser automation).
- **FR-4.2**: For the top N ranked opportunities (configurable, default: 50), check room availability for:
  - The event date itself
  - 1 day before the event
  - 2 days before the event
  - 1 day after the event
  - 2 days after the event
- **FR-4.3**: Record available room types, credit costs, and dates.
- **FR-4.4**: Run availability checks on a configurable schedule (default: weekly for high-priority, monthly for others).

### FR-5: Notifications

- **FR-5.1**: When availability is found for a ranked opportunity, send an **SMS** via email-to-SMS gateway (free, using Nodemailer + carrier gateway like `vtext.com`) containing:
  - Resort name and location
  - Event name and date
  - Available room type(s)
  - Credit cost for the stay
  - Estimated resale value
  - Recommended action (e.g., "Book 2BR at WorldMark Anaheim for Oct 10–12, costs 4,400 credits, est. resale $450–600")
- **FR-5.2**: Send a **push notification** to the companion iOS app with the same information.
- **FR-5.3**: Rate-limit notifications to avoid spam (max 5 per day, configurable).
- **FR-5.4**: Track which notifications have been sent to avoid duplicates.

### FR-6: iOS Companion App

- **FR-6.1**: Display a dashboard showing:
  - Top ranked opportunities (sorted by profit score)
  - Upcoming events near resorts
  - Recent availability alerts
- **FR-6.2**: Allow viewing detailed info for each opportunity:
  - Resort details, event details, availability windows
  - Estimated credit cost vs. market value
- **FR-6.3**: Settings screen for:
  - Notification preferences (SMS, push, both)
  - Phone number for SMS
  - Credit value per credit (for profit calculations)
  - Minimum profit threshold for alerts
- **FR-6.4**: Notification history with read/unread status.
- **FR-6.5**: Pull-to-refresh to sync latest data from server.

### FR-7: Scheduling & Orchestration

- **FR-7.1**: Run the full pipeline on a cron schedule:
  - **Resort list refresh**: Every 3 months
  - **Event discovery**: Weekly
  - **Opportunity ranking**: After each event discovery run
  - **Availability checking**: Weekly for top 50, monthly for rest
- **FR-7.2**: Support manual trigger of any pipeline stage via API.
- **FR-7.3**: Log all pipeline runs with timestamps, results, and errors.

---

## 3. Technical Architecture

### 3.1 Backend Server (Node.js/TypeScript)

```
server/
├── src/
│   ├── config/           # Environment config, constants
│   ├── db/               # Database schema, migrations, queries
│   ├── services/
│   │   ├── resort/       # Resort scraping & management
│   │   ├── event/        # Event API integrations
│   │   ├── ranking/      # Opportunity scoring engine
│   │   ├── availability/ # WorldMark portal automation
│   │   ├── notification/ # Email-to-SMS gateway + push notifications
│   │   └── scheduler/    # Cron job orchestration
│   ├── api/              # REST API for companion app
│   ├── utils/            # Shared utilities
│   └── index.ts          # Entry point
├── tests/                # Test suite
├── .env.example          # Environment variable template
├── package.json
└── tsconfig.json
```

### 3.2 iOS Companion App (Swift/SwiftUI)

```
ios/
├── WorldMarkScheduler/
│   ├── App/              # App entry, configuration
│   ├── Models/           # Data models
│   ├── Views/            # SwiftUI views
│   ├── ViewModels/       # MVVM view models
│   ├── Services/         # API client, push notification handler
│   └── Resources/        # Assets, fonts
├── WorldMarkSchedulerTests/
└── WorldMarkScheduler.xcodeproj
```

### 3.3 Database (SQLite via better-sqlite3)

Tables:
- `resorts` — Resort registry with coordinates and metadata
- `credit_charts` — Credit costs per resort/season/unit/day
- `events` — Discovered events with metadata
- `opportunities` — Ranked resort+event combinations
- `availability` — Availability check results
- `notifications` — Sent notification log
- `pipeline_runs` — Execution history

### 3.4 External Services

| Service | Purpose | Auth |
|---------|---------|------|
| WorldMark Portal | Availability checking | Username/password (env vars) |
| Ticketmaster Discovery API | Event data | Free API key |
| SMTP (Email-to-SMS) | SMS notifications via carrier gateway | Gmail App Password |
| APNs (Apple Push) | Push notifications | APNs key |

---

## 4. Technical Constraints

- **TC-1**: Server must run on a standard VPS (e.g., DigitalOcean, Railway, Render) or locally on a Mac.
- **TC-2**: WorldMark portal access requires headless browser automation (Playwright) — no public API exists.
- **TC-3**: Respect WorldMark ToS — rate-limit scraping, don't hammer the portal.
- **TC-4**: All credentials stored in environment variables, never in code.
- **TC-5**: No automatic booking or payment actions — advisory only.
- **TC-6**: iOS app requires Xcode 15+ and iOS 16+ target.
- **TC-7**: Server should be deployable via Docker for portability.

---

## 5. Security Requirements

- **SR-1**: WorldMark credentials stored ONLY in environment variables / `.env` file.
- **SR-2**: `.env` file in `.gitignore` — never committed.
- **SR-3**: API keys for Ticketmaster stored as env vars. SMTP credentials stored as env vars.
- **SR-4**: Server API endpoints authenticated with API key or JWT for companion app.
- **SR-5**: HTTPS for all server communication.
- **SR-6**: iOS keychain for storing server API credentials on device.

---

## 6. Success Criteria

- **SC-1**: System can discover 90+ WorldMark resorts and persist them.
- **SC-2**: System can find events within 30 miles of each resort for the next 13 months.
- **SC-3**: Opportunities are scored and ranked — top opportunities make intuitive sense (big events near popular resorts score highest).
- **SC-4**: System can log into WorldMark portal and check availability for specific resort/date combinations.
- **SC-5**: SMS and push notifications are sent when availability matches a ranked opportunity.
- **SC-6**: iOS companion app displays opportunities, events, and alerts.
- **SC-7**: Full pipeline can run unattended on a schedule.
- **SC-8**: All components have test coverage ≥ 80%.

---

## 7. Configuration (.env)

```bash
# WorldMark Portal
WORLDMARK_USERNAME=your_username
WORLDMARK_PASSWORD=your_password

# Ticketmaster API
TICKETMASTER_API_KEY=your_key

# SMS via Email-to-SMS Gateway (Free)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMS_GATEWAY_DOMAIN=vtext.com
OWNER_PHONE_NUMBER=+1XXXXXXXXXX

# Push Notifications
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id

# Server
PORT=3000
API_KEY=your_api_key_for_companion_app
NODE_ENV=production

# Scheduling
RESORT_REFRESH_CRON=0 0 1 */3 *   # Every 3 months
EVENT_DISCOVERY_CRON=0 0 * * 1     # Every Monday
AVAILABILITY_CHECK_CRON=0 6 * * *  # Daily at 6 AM

# Ranking
CREDIT_VALUE_CENTS=0.5             # Owner's cost per credit in cents
MIN_PROFIT_THRESHOLD=100           # Minimum estimated profit to alert
EVENT_SEARCH_RADIUS_MILES=30
TOP_OPPORTUNITIES_COUNT=50
```

---

## 8. Phase Plan

### Phase 1 — Foundation (Current)
- [ ] Project scaffolding (Node.js server + iOS app skeleton)
- [ ] Database schema and migrations
- [ ] Resort registry seeding (scrape or manual entry)
- [ ] Configuration management

### Phase 2 — Event Discovery
- [ ] Ticketmaster API integration
- [ ] Event storage and de-duplication
- [ ] Resort-to-event proximity matching

### Phase 3 — Ranking Engine
- [ ] Profit scoring algorithm
- [ ] Market rate estimation (via hotel price APIs or heuristics)
- [ ] Opportunity ranking and persistence

### Phase 4 — Availability Automation
- [ ] Playwright-based WorldMark portal login
- [ ] Availability checking workflow
- [ ] Result parsing and storage

### Phase 5 — Notifications
- [ ] Email-to-SMS gateway integration (Nodemailer + carrier gateway)
- [ ] Apple Push Notification integration
- [ ] Notification templates and rate limiting

### Phase 6 — iOS Companion App
- [ ] API client connecting to server
- [ ] Dashboard / opportunity list view
- [ ] Detail view for each opportunity
- [ ] Settings and notification preferences
- [ ] Push notification handling

### Phase 7 — Scheduling & Deployment
- [ ] Cron job orchestration
- [ ] Docker containerization
- [ ] Deployment to VPS
- [ ] Monitoring and alerting
