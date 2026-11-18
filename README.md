# Calendar

A simple shared-view scheduling calendar that runs entirely in the browser.
No login, no server, no build step.

- Day, week, month, two-month, year, per-person and timeline views
- People and color-coded categories you manage yourself
- Keyword search and filters
- Backup and restore to a file

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Host it

Upload these files to any static host (S3, Netlify, GitHub Pages, a plain web
server). All paths are relative, so it works from a subfolder too.

```
index.html
styles.css
calendar-*.js
```

`docs/` and `tests/` do not need to be uploaded.

## Where the data lives

Everything is saved in **the browser you are using, on that device only**
(`localStorage`, key `calendar.v1`). That means:

- Another browser, phone or computer starts with its own empty calendar.
- Clearing the browser's site data erases the calendar.
- There is no login, so anyone using that browser can change anything.

Use **Manage → Backup → Download backup** regularly. **Restore from backup**
loads a backup file, replacing what is there — this is also how you move the
calendar to another browser.

The first time it opens, the calendar shows sample people and entries. Use
**Clear sample data** to remove them; anything you added yourself stays.

## Making it shared later

`calendar-api.js` is the only file that reads or writes data. Every method on
`window.CalendarApi` returns a Promise. To let several devices share one
calendar, reimplement those methods against a server and leave the other files
alone:

| Method | Purpose |
|---|---|
| `getMe()` | Who is using the page (currently a fixed local user) |
| `getUserDirectory()`, `savePerson(person)`, `deletePerson(id)` | People |
| `getStatuses()`, `saveStatus(status)`, `deleteStatus(id)` | Categories |
| `getEntries({ start_date, end_date })`, `createEntry(entry)`, `updateEntry(id, entry)`, `deleteEntry(id)` | Entries |
| `getSettings()`, `saveSettings(partial)` | Title and accent color |
| `exportData()`, `importData(json)` | Backup and restore |
| `clearAll()`, `clearSampleData()`, `isSampleData()`, `storageOk()` | Housekeeping |

## Files

| File | What it does |
|---|---|
| `calendar-api.js` | Storage |
| `calendar-state.js` | Date helpers and page state |
| `calendar-filters.js` | Which entries are visible |
| `calendar-render.js` | Page shell: header, toolbar, summary |
| `calendar-roster.js` | The calendar views |
| `calendar-panels.js` | Day drawer and search results |
| `calendar-detail.js` | Selected-day side panel |
| `calendar-editor.js` | Add / edit entry dialog |
| `calendar-manage.js` | People, categories, appearance, backup |
| `calendar-main.js` | Wires everything together |

## Tests

```sh
node --test tests/*.test.js
```

Covers the storage layer. Requires Node 20 or newer; nothing to install.
