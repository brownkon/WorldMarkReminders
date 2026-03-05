# WorldMark Scheduler

This service periodically fetches major upcoming events, finds nearby WorldMark resorts with availability within 60 miles, and checks if their booking windows are opening soon. If a 13-month booking window is about to open, you will be notified so you can snag a reservation!

## API Usage

You can manually trigger actions on the server via its API endpoints. Make sure to pass the `apiKey` query parameter.

**Your API Key**: `generate_a_random_api_key_here`

### Manually Discovering Top 30 AI Events

Normally, the scheduler runs the AI event discovery on a quarterly basis. However, you can manually trigger it at any time using the following web request:

```bash
curl -X POST "http://localhost:3000/api/pipeline/events?apiKey=generate_a_random_api_key_here"
```

When you trigger this command:
1. The backend pings the **Google Gemini (1.5 Flash)** AI API.
2. It fetches a structured list of the top 30 major upcoming events happening across the US along with location data.
3. The original events/opportunities are cleared.
4. The backend attempts to find a WorldMark resort within 60 miles of each event.
5. All newly found events will be loaded into the SQLite database.
6. **Data Inspection**: The raw JSON list of these events will be instantly saved to **`data/latest_ai_events.json`** on your computer for easy manual viewing.

### Manually Running the Full Pipeline

If you want to trigger both the event discovery AND the daily availability booking checks simultaneously, you can run the full pipeline:

```bash
curl -X POST "http://localhost:3000/api/pipeline/run?apiKey=generate_a_random_api_key_here"
```

## Viewing Information Manually

While the mobile companion app provides an easy way to check the status, you can also look under the hood natively simply by reading the saved outputs manually:

- **AI Event JSON Dump**: Open `data/latest_ai_events.json` with a text editor to see a formatted list of the events discovered by the AI.
- **SQL Database**: Use a SQLite viewer (e.g., DB Browser for SQLite) to open up `data/worldmark.db` and query the `events` and `opportunities` tables.
