# Phase 5 Remainders + Phase 6 Backend Support — Requirements

> **Scope**: Configurable notification rate limit, APNs integration (server-side), and iOS companion app API support.

---

## 1. Configurable Notification Rate Limit (Phase 5)

### REQ-5.1: Environment Variable
- Add `NOTIFICATION_DAILY_LIMIT` to config schema (default: `20`, matching current hardcoded value).
- The `NotificationService` must read this value from config instead of using a hardcoded `20`.

### REQ-5.2: Config Propagation
- `NotificationConfig` interface must include `dailyLimit: number`.
- `SchedulerService` passes the value from `Config` → `NotificationConfig`.

### REQ-5.3: Backward Compatibility
- If `NOTIFICATION_DAILY_LIMIT` is not set, the default (`20`) applies — existing behavior preserved.

---

## 2. APNs Integration (Phase 5 — Server-Side)

### REQ-5.4: APNs Service
- Create `src/services/notification/apns.service.ts`.
- Implement JWT-based APNs authentication using existing `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_PATH` config values.
- Send push notifications to registered device tokens stored in a new `device_tokens` table.

### REQ-5.5: Device Token Registration
- New `device_tokens` table: `id`, `token`, `platform` ('ios'), `created_at`, `updated_at`.
- API endpoint: `POST /api/devices` — register a device token.
- API endpoint: `DELETE /api/devices/:token` — unregister a device token.

### REQ-5.6: Dual Notification Delivery
- `NotificationService.sendNotification()` sends to **both** ntfy.sh and APNs.
- Either channel failing does not block the other.
- Notification record stores which channels succeeded.

---

## 3. iOS Companion App API Support (Phase 6 Backend)

### REQ-6.1: Enhanced Dashboard Endpoint
- `GET /api/dashboard` — already exists, add:
  - `notifications` with `read`/`unread` status
  - Filter options: `?minProfit=N`, `?resortId=X`

### REQ-6.2: Notification History with Read/Unread
- Add `is_read` column (INTEGER DEFAULT 0) to `notifications` table.
- `GET /api/notifications` — returns notifications with `is_read` status.
- `PATCH /api/notifications/:id/read` — mark notification as read.
- `PATCH /api/notifications/read-all` — mark all as read.

### REQ-6.3: Opportunity Detail Endpoint
- `GET /api/opportunities/:id` — return full opportunity with:
  - Resort details (name, city, state, lat, lng, unit types)
  - Event details (name, date, category, venue, attendance, URL, image)
  - Availability windows (all check results)
  - Estimated profit breakdown

### REQ-6.4: Settings Endpoint
- `GET /api/settings` — returns current configurable settings.
- `PATCH /api/settings` — update settings at runtime (persisted to a `settings` table):
  - `creditValueCents`, `minProfitThreshold`, `notificationDailyLimit`
  - Notification preferences: `ntfyEnabled`, `apnsEnabled`

### REQ-6.5: API Response Format
- All endpoints return consistent JSON envelope: `{ data: ..., meta: { timestamp, count? } }`
- Error responses: `{ error: { code, message } }`

---

## 4. Database Changes

### New Tables
- `device_tokens` — APNs device registration
- `settings` — runtime-configurable user preferences

### Altered Tables  
- `notifications` — add `is_read INTEGER NOT NULL DEFAULT 0`

---

## 5. File Structure

```
src/services/notification/
├── notification.service.ts   # Modified: configurable rate limit, dual delivery
└── apns.service.ts           # New: APNs JWT auth + push

src/api/
└── routes.ts                 # Modified: new endpoints

src/db/
└── index.ts                  # Modified: new tables + migration

src/config/
└── index.ts                  # Modified: NOTIFICATION_DAILY_LIMIT env var

tests/
├── notification.service.test.ts  # Modified: test configurable limit
├── apns.service.test.ts          # New
└── api.routes.test.ts            # New: test new endpoints
```

---

## 6. Out of Scope (iOS Native)
- Xcode project creation → requires Xcode IDE
- SwiftUI views → native development
- iOS Keychain integration → native development
- These items remain on the TODO for native iOS development
