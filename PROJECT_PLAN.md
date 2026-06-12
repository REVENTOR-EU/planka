# Project Plan: Enhanced Time Tracking with Per-User Records & ODS Export

## Overview

Transform Planka's existing flat stopwatch (`{ startedAt, total }`) into a full per-user time tracking system. Each start/stop action creates an individual time log record tied to the user who performed it. List headers show aggregated total time. List actions include an ODS export with per-card, per-user time breakdowns.

## Current State

- Cards have a `stopwatch` JSONB field: `{ startedAt: datetime|null, total: number (seconds) }`
- No per-user tracking — any board editor can start/stop, but no record of **who** worked on the card
- No export functionality exists
- `papaparse` is available on client but unused; no ODS library yet

## Target State

- Every start/stop creates a `time_entry` row: who, when, duration
- List header displays total accumulated time across all cards in that list
- List actions menu includes "Export Time Report" that generates an ODS file
- ODS contains: task name, person name, date, start time, end time, duration
- Per-person totals summarized at the bottom

---

## Phase 1: Database & Server Model — Time Entries

### 1.1 Create Migration: `time_entry` table

**File:** `server/db/migrations/YYYYMMDDHHMMSS_add_time_entries.js`

```sql
CREATE TABLE time_entry (
  id BIGINT PRIMARY KEY DEFAULT next_id(),
  card_id BIGINT NOT NULL REFERENCES card(id),
  user_id BIGINT NOT NULL REFERENCES user_account(id),
  started_at TIMESTAMP NOT NULL,
  stopped_at TIMESTAMP,          -- NULL means currently running
  duration BIGINT,               -- seconds, set on stop
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_time_entry_card_id ON time_entry(card_id);
CREATE INDEX idx_time_entry_user_id ON time_entry(user_id);
CREATE INDEX idx_time_entry_stopped_at ON time_entry(stopped_at) WHERE stopped_at IS NOT NULL;
```

- Snowflake ID via `next_id()` (follows project convention)
- `stopped_at IS NULL` = running entry
- `duration` in seconds, populated when stopwatch is stopped

### 1.2 Create Server Model: `TimeEntry`

**File:** `server/api/models/TimeEntry.js`

- Waterline model with attributes: `cardId`, `userId`, `startedAt`, `stoppedAt`, `duration`
- Add Query Manager (`qm`) methods: `getOneById`, `getByCardId`, `getRunningByCardId`, `getByUserId`

### 1.3 Update Card Model

**File:** `server/api/models/Card.js`

- Keep existing `stopwatch` field for backwards compatibility and quick display
- Add virtual/computed aggregation methods to sum time entries
- Add `timeEntries` collection relationship

### 1.4 Migrate Existing Stopwatch Data

- Write a migration step or seed script that converts existing `stopwatch.total` values into a single `time_entry` row per card (attributed to the card creator or a system user)
- This preserves existing time data

---

## Phase 2: Server API — Time Entry CRUD

### 2.1 Time Entry Controller & Helper

**Files:**
- `server/api/controllers/time-entries/start.js` — `POST /api/cards/:cardId/time-entries/start`
- `server/api/controllers/time-entries/stop.js` — `POST /api/time-entries/:id/stop`
- `server/api/controllers/time-entries/index.js` — `GET /api/cards/:cardId/time-entries`
- `server/api/helpers/time-entries/create-one.js`
- `server/api/helpers/time-entries/update-one.js`

**Start flow:**
1. Check board membership (editor role required)
2. Stop any currently running time entry for this user (auto-stop previous)
3. Create new `time_entry` with `startedAt = now()`, `stoppedAt = null`, `userId = currentUser.id`
4. Update card's `stopwatch.startedAt` and `stopwatch.total` (denormalized for quick display)
5. Broadcast `cardUpdate` via socket (stopwatch display refreshes)
6. Broadcast `timeEntryCreate` via socket (time log updates)

**Stop flow:**
1. Set `stoppedAt = now()`, `duration = stoppedAt - startedAt`
2. Update card's `stopwatch.startedAt = null`, `stopwatch.total += duration`
3. Broadcast `cardUpdate` and `timeEntryUpdate` via socket

**Index flow:**
1. Return all time entries for a card, including user name/email in `included`
2. Support filtering by date range

### 2.2 Update Card Update Controller

**File:** `server/api/controllers/cards/update.js`

- When `stopwatch` is updated directly (start/stop via existing UI), also create/stop a time entry
- This maintains backwards compatibility with the existing stopwatch toggle

### 2.3 Register Routes

**File:** `server/config/routes.js`

```javascript
'POST /api/cards/:cardId/time-entries/start': 'time-entries/start',
'POST /api/time-entries/:id/stop': 'time-entries/stop',
'GET /api/cards/:cardId/time-entries': 'time-entries/index',
```

### 2.4 List Time Aggregation Endpoint

**File:** `server/api/controllers/lists/export-time-report.js` — `GET /api/lists/:id/time-report`

- Returns aggregated time data for all cards in a list:
  - Per-card total time
  - Per-card per-user time breakdown
  - Per-user total time across all cards
- Used both for list header display and ODS export

---

## Phase 3: Server API — ODS Export

### 3.1 Add ODS Generation Library

**Server dependency:** Add `simple-ods` or build a lightweight ODS generator using `jszip` (already compatible with Node.js). ODS is a ZIP of XML files — we can generate it without heavy dependencies.

**Recommended approach:** Create a server helper that builds the ODS XML structure:

**File:** `server/api/helpers/utils/generate-ods.js`

- Takes structured data (rows, columns, headers, sheet name)
- Returns a Buffer of the ODS file
- Uses `jszip` for ZIP packaging + manual `content.xml` and `META-INF/manifest.xml` generation

**Alternative:** Use the `xlsx` (SheetJS) npm package which supports ODS output. Add to `server/package.json` dependencies.

### 3.2 Export Controller

**File:** `server/api/controllers/lists/export-time-report.js`

- `GET /api/lists/:id/export-time-report?format=ods`
- Queries all cards in list with their time entries and associated users
- Generates ODS with the following structure:

#### ODS Sheet Structure: "Time Report"

| Column | Content |
|--------|---------|
| A | Task/Card Name |
| B | Person Name |
| C | Date (YYYY-MM-DD) |
| D | Start Time (HH:MM) |
| E | End Time (HH:MM) |
| F | Duration (hours:minutes) |

**Per-card grouping:**
- Each card gets rows for every time entry
- Subtotal row per card: "Total for [Card Name]" with summed duration

**Summary section at bottom:**

| Column | Content |
|--------|---------|
| A | "Summary by Person" |
| A | Person Name | B | Total Time (h:m) |
| ... | ... |
| A | "Grand Total" | B | Total Time (h:m) |

### 3.3 Register Export Route

**File:** `server/config/routes.js`

```javascript
'GET /api/lists/:id/export-time-report': 'lists/export-time-report',
```

The response sets headers for file download:
```
Content-Type: application/vnd.oasis.opendocument.spreadsheet
Content-Disposition: attachment; filename="time-report-<list-name>-<date>.ods"
```

---

## Phase 4: Client — Time Entry Display & Management

### 4.1 Client Model: TimeEntry

**File:** `client/src/models/TimeEntry.js`

- redux-orm model: `id`, `cardId` (fk), `userId` (fk), `startedAt`, `stoppedAt`, `duration`, `createdAt`, `updatedAt`
- Register in `client/src/models/index.js` (orm registry)

### 4.2 Redux Actions & Selectors

**Actions:** `client/src/actions/time-entries.js`
- `TIME_ENTRY_CREATE`, `TIME_ENTRY_UPDATE`, `TIME_ENTRIES_FETCH`

**Selectors:** `client/src/selectors/time-entries.js`
- `selectTimeEntriesByCardId` — all entries for a card
- `makeSelectTotalTimeByListId` — aggregated time across all cards in a list
- `selectRunningTimeEntryForCurrentUser` — currently running entry

**Entry Actions:** `client/src/entry-actions/time-entries.js`
- `startTimeEntry(cardId)` — calls API, dispatches actions
- `stopTimeEntry(timeEntryId)` — calls API, dispatches actions
- `fetchTimeEntriesForCard(cardId)` — load history

### 4.3 API Layer

**File:** `client/src/api/time-entries.js`

```javascript
const startTimeEntry = (cardId) => socket.post(`/cards/${cardId}/time-entries/start`);
const stopTimeEntry = (timeEntryId) => socket.post(`/time-entries/${timeEntryId}/stop`);
const getTimeEntries = (cardId) => socket.get(`/cards/${cardId}/time-entries`);
```

### 4.4 Socket Event Handling

**File:** `client/src/sagas/core/watchers/socket.js`

- Handle `timeEntryCreate`, `timeEntryUpdate` events
- Dispatch corresponding Redux actions to update store

### 4.5 Update Stopwatch Components

**Files to modify:**
- `client/src/components/cards/StopwatchChip/StopwatchChip.jsx` — Add user avatar indicator when running (shows who is tracking)
- `client/src/components/cards/EditStopwatchStep/EditStopwatchStep.jsx` — Show "Start tracking" with current user context
- `client/src/components/cards/CardModal/ProjectContent.jsx` — Display time log in card modal

### 4.6 New Component: TimeEntryLog

**File:** `client/src/components/cards/TimeEntryLog/TimeEntryLog.jsx`

- Displays list of time entries for a card
- Each entry shows: user avatar + name, start time, end time, duration
- Entries grouped by date
- Shown inside the card modal (below description or in a dedicated tab)

### 4.7 New Component: UserStopwatchIndicator

**File:** `client/src/components/cards/UserStopwatchIndicator/UserStopwatchIndicator.jsx`

- Small avatar badge on the StopwatchChip showing which user is currently tracking
- Visible on the card front in the board view

---

## Phase 5: Client — List Total Time Display

### 5.1 List Header Total Time

**File:** `client/src/components/lists/List/List.jsx`

- Add a `ListTimeTotal` sub-component in the list header area
- Shows formatted total time (e.g., "12h 34m") next to the list name or below it
- Auto-updates when time entries change (via Redux selectors)
- Uses `makeSelectTotalTimeByListId` selector

**New component:** `client/src/components/lists/List/ListTimeTotal.jsx`

```jsx
const ListTimeTotal = React.memo(({ listId }) => {
  const totalTime = useSelector(state => selectTotalTimeByListId(state, listId));
  if (!totalTime || totalTime === 0) return null;
  return <span className={styles.listTimeTotal}>{formatDuration(totalTime)}</span>;
});
```

### 5.2 Selector: Total Time Per List

**File:** `client/src/selectors/time-entries.js`

```javascript
export const makeSelectTotalTimeByListId = () => {
  const selectListById = makeSelectListById();
  const selectFilteredCardIdsByListId = makeSelectFilteredCardIdsByListId();

  return createSelector(
    [selectListById, selectFilteredCardIdsByListId, (state) => state.orm.TimeEntry],
    (list, cardIds, timeEntries) => {
      // Sum all time entries for all cards in this list
      return cardIds.reduce((total, cardId) => {
        const entries = timeEntries.filter({ cardId });
        return total + entries.reduce((sum, e) => sum + (e.duration || 0), 0);
      }, 0);
    }
  );
};
```

---

## Phase 6: Client — ODS Export UI

### 6.1 Export Action in List Actions Menu

**File:** `client/src/components/lists/List/ActionsStep.jsx`

- Add new menu item: "Export Time Report" with download icon
- New step type: `EXPORT_TIME_REPORT`

```jsx
<Menu.Item className={styles.menuItem} onClick={handleExportTimeReport}>
  <Icon name="file excel outline" className={styles.menuItemIcon} />
  {t('action.exportTimeReport')}
</Menu.Item>
```

### 6.2 Export Implementation

**Two approaches (server-side recommended):**

**Option A: Server-side generation (recommended)**
- Client triggers a download via `window.open()` or `<a>` link to the export endpoint
- Server generates ODS and returns as download
- Pros: ODS libraries are more mature on Node.js, handles large datasets, no client-side dependency

**Option B: Client-side generation**
- Fetch time report data via API
- Generate ODS client-side using a library like `xlsx` or `simple-ods`
- Pros: No server round-trip for file generation

**Recommended: Option A** — Server generates the ODS file. Client calls:
```javascript
window.open(`/api/lists/${listId}/export-time-report?accessToken=${token}`, '_blank');
```

### 6.3 i18n Strings

**Files to update:**
- `client/public/locales/en/translation.json` (and other languages)

Add keys:
```json
{
  "action": {
    "exportTimeReport": "Export time report"
  },
  "common": {
    "totalTime": "Total time",
    "timeEntry": "Time entry",
    "timeEntries": "Time entries",
    "noTimeEntries": "No time entries yet",
    "duration": "Duration",
    "startedAt": "Started at",
    "stoppedAt": "Stopped at",
    "person": "Person",
    "summaryByPerson": "Summary by person",
    "grandTotal": "Grand total"
  }
}
```

---

## Implementation Order

| Step | Phase | Description | Files |
|------|-------|-------------|-------|
| 1 | 1.1 | Create `time_entry` migration | `server/db/migrations/` |
| 2 | 1.2 | Create `TimeEntry` model | `server/api/models/TimeEntry.js` |
| 3 | 1.4 | Migrate existing stopwatch data | Migration script |
| 4 | 2.1 | Time entry controller + helpers | `server/api/controllers/time-entries/`, `server/api/helpers/time-entries/` |
| 5 | 2.2 | Update card update controller | `server/api/controllers/cards/update.js` |
| 6 | 2.3 | Register routes | `server/config/routes.js` |
| 7 | 2.4 | List time aggregation endpoint | `server/api/controllers/lists/` |
| 8 | 3.1 | Add ODS generation helper | `server/api/helpers/utils/generate-ods.js`, `server/package.json` |
| 9 | 3.2 | Export controller | `server/api/controllers/lists/export-time-report.js` |
| 10 | 4.1 | Client TimeEntry model | `client/src/models/TimeEntry.js` |
| 11 | 4.2 | Redux actions + selectors | `client/src/actions/`, `client/src/selectors/` |
| 12 | 4.3 | API layer | `client/src/api/time-entries.js` |
| 13 | 4.4 | Socket event handling | `client/src/sagas/core/watchers/socket.js` |
| 14 | 4.5 | Update stopwatch components | Existing stopwatch files |
| 15 | 4.6 | TimeEntryLog component | `client/src/components/cards/TimeEntryLog/` |
| 16 | 4.7 | UserStopwatchIndicator component | `client/src/components/cards/UserStopwatchIndicator/` |
| 17 | 5.1 | List header total time | `client/src/components/lists/List/ListTimeTotal.jsx` |
| 18 | 5.2 | List time selector | `client/src/selectors/time-entries.js` |
| 19 | 6.1 | Export action in list menu | `client/src/components/lists/List/ActionsStep.jsx` |
| 20 | 6.3 | i18n strings | `client/public/locales/` |

---

## Data Flow Diagram

```
User clicks "Start" on card stopwatch
  → Client: dispatch(startTimeEntry(cardId))
  → API: POST /api/cards/:cardId/time-entries/start
  → Server: 
    1. Auto-stop any running entry for this user
    2. Create time_entry (startedAt=now, userId=currentUser)
    3. Update card.stopwatch = { startedAt: now, total: previousTotal }
    4. Broadcast socket events:
       - board:${boardId} → cardUpdate (stopwatch tick)
       - board:${boardId} → timeEntryCreate (new log entry)
  → Client: Redux store updates
    - StopwatchChip shows running timer
    - TimeEntryLog shows new entry
    - ListTimeTotal recalculates (if entry completed)

User clicks "Stop" on card stopwatch
  → Client: dispatch(stopTimeEntry(entryId))
  → API: POST /api/time-entries/:id/stop
  → Server:
    1. Set time_entry.stoppedAt = now, duration = stoppedAt - startedAt
    2. Update card.stopwatch = { startedAt: null, total: previousTotal + duration }
    3. Broadcast socket events
  → Client: Redux store updates
    - StopwatchChip shows stopped state with new total
    - TimeEntryLog shows completed entry with duration
    - ListTimeTotal updates to include new duration

User clicks "Export Time Report" in list actions
  → Client: window.open(/api/lists/:id/export-time-report)
  → Server:
    1. Query all cards in list
    2. Query all time entries for those cards
    3. Query user info for each entry
    4. Generate ODS file with structured data
    5. Return file download response
  → Browser downloads .ods file
```

---

## ODS File Layout (Detailed)

### Sheet 1: "Time Report"

```
Row 1:  [Card Name] [Person] [Date] [Start Time] [End Time] [Duration]
Row 2:  [Card A]    [Alice]  [2026-06-10] [09:00] [11:30]   [2h 30m]
Row 3:  [Card A]    [Bob]    [2026-06-10] [14:00] [16:00]   [2h 00m]
Row 4:  [Card A]    [Alice]  [2026-06-11] [10:00] [12:15]   [2h 15m]
Row 5:  [TOTAL: Card A]                          [6h 45m]
Row 6:  (empty)
Row 7:  [Card B]    [Alice]  [2026-06-09] [08:00] [10:00]   [2h 00m]
Row 8:  [Card B]    [Charlie][2026-06-09] [13:00] [15:30]   [2h 30m]
Row 9:  [TOTAL: Card B]                          [4h 30m]
Row 10: (empty)
Row 11: [SUMMARY BY PERSON]
Row 12: [Person]    [Total Time]
Row 13: [Alice]     [6h 45m]
Row 14: [Bob]       [2h 00m]
Row 15: [Charlie]   [2h 30m]
Row 16: (empty)
Row 17: [GRAND TOTAL]          [11h 15m]
```

### Column Widths
- A (Card Name): 30 chars
- B (Person): 20 chars
- C (Date): 12 chars
- D (Start Time): 10 chars
- E (End Time): 10 chars
- F (Duration): 12 chars

### Formatting
- Header row: bold, background color
- Total rows: bold, light background
- Duration cells: right-aligned
- Date cells: ISO format (YYYY-MM-DD)

---

## Database Performance Considerations

- Index on `time_entry(card_id)` for card-level queries
- Index on `time_entry(user_id)` for user-level queries  
- Index on `time_entry(stopped_at)` with `WHERE stopped_at IS NOT NULL` for completed entries
- The denormalized `card.stopwatch` field remains the primary read path for display
- Time entries are queried in bulk only for export and detailed views
- Consider adding a `list_id` denormalized column to `time_entry` for faster list-level aggregation if performance becomes an issue with large boards

## Edge Cases

- **Multiple users on same card**: Each user has their own time entries. The card's `stopwatch` shows the aggregate total. When user A starts, it doesn't affect user B's running timer.
- **Auto-stop**: When a user starts a new timer, any currently running timer for that user is automatically stopped.
- **Card moved to another list**: Time entries remain associated with the card. The list total dynamically recalculates based on which list the card is currently in.
- **Card deleted**: Time entries are cascade-deleted with the card (foreign key constraint).
- **Concurrent start/stop**: The currently running entry check uses `stopped_at IS NULL` with user scoping to prevent duplicates.
- **Server restart with running timers**: On server start, any running entries should be detected and their elapsed time reflected in the stopwatch display (the `startedAt` timestamp handles this naturally).

## Dependencies to Add

| Package | Location | Purpose |
|---------|----------|---------|
| `xlsx` (SheetJS community edition) | server | ODS file generation |
| Or: `jszip` + manual XML | server | Lightweight ODS generation |

No new client-side dependencies required — all ODS generation happens server-side.
