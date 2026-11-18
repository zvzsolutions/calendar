# Calendar

A scheduling calendar that runs in your web browser. There is nothing to
install, no account to create, and no monthly fee.

- Day, week, month, two-month, year, per-person and timeline views
- People and color-coded categories that you set up yourself
- Search and filters
- Backup to a file, and export to Google Calendar, Outlook or Apple Calendar

**Try it:** https://zvzsolutions.com/rabs/calendar/

---

## Contents

1. [Using the calendar](#1-using-the-calendar)
2. [Where your information is kept](#2-where-your-information-is-kept)
3. [Putting it on your own domain](#3-putting-it-on-your-own-domain)
4. [Connecting it to the calendar you already use](#4-connecting-it-to-the-calendar-you-already-use)
5. [For developers](#5-for-developers)

---

## 1. Using the calendar

The first time you open it, it shows a few made-up people and entries so you
can see how it looks. Click **Clear sample data** in the bar near the top when
you are ready to start with your own.

- **Add someone:** click **Manage**, type a name under *People*, click
  **Add person**.
- **Add an entry:** click **Add Entry**, choose the person, a category, and
  the dates. Times and a note are optional.
- **Change or delete an entry:** click it.
- **Change the categories or their colors:** **Manage → Categories**.
- **Change the title or accent color:** **Manage → Appearance**.

## 2. Where your information is kept

Everything you enter is saved **inside the web browser you are using, on that
one device**. It is not sent anywhere. That has three consequences:

- Your phone and your computer each have their own separate calendar.
- If you clear your browser's saved site data, the calendar is erased.
- There is no password. Anyone who uses that browser can see and change it.

**Make a backup every so often:** **Manage → Download backup**. It saves a
small file. **Restore from backup** loads that file back in, replacing whatever
is there.

## 3. Putting it on your own domain

The calendar is 12 small files. Putting it on your domain means copying those
files into a folder on your website. There is no database or program to set up.

### Step 1 — Get the files

On this page, click the green **Code** button, then **Download ZIP**. Unzip it.
You need these 12 files, kept together in one folder:

```
index.html
styles.css
calendar-api.js        calendar-main.js      calendar-render.js
calendar-detail.js     calendar-manage.js    calendar-roster.js
calendar-editor.js     calendar-panels.js    calendar-state.js
calendar-filters.js
```

The `tests` folder and this README do not need to go on your website.

### Step 2 — Upload them

Log in to wherever your website is hosted and open its file manager. Common
names for it are *File Manager* (cPanel, GoDaddy, Bluehost, Hostinger) or
*Files*. Then:

1. Open the folder your website is served from. It is usually called
   `public_html`, `www`, or `htdocs`.
2. Make a new folder inside it for the calendar, for example `calendar`.
3. Upload all 12 files into that new folder.

Your calendar is now at `https://your-domain.com/calendar/`.

To make it the front page of the domain instead, upload the 12 files straight
into `public_html` rather than a sub-folder. Only do this if there is no
website there already, because `index.html` would replace its home page.

### If you do not have web hosting yet

You only need hosting for plain files, which is often free:

- **Netlify** — at app.netlify.com/drop, drag the unzipped folder onto the
  page. It gives you a web address right away, and you can attach your own
  domain in its settings.
- **GitHub Pages** or **Cloudflare Pages** — also free, a few more steps.

### Step 3 — Move your entries over

Because entries are kept by the browser **per web address**, the calendar on
your own domain starts empty, even in the same browser where you used the
sample. To bring your entries with you:

1. On the old address: **Manage → Download backup**.
2. On your new address: **Manage → Restore from backup**, and pick that file.

### Updating later

To install a newer version, upload the new files over the old ones. Your
entries are not in those files, so they are not affected.

### Showing it inside an existing web page

If you would rather have the calendar appear inside a page of your current
website, upload it as above and add this to the page:

```html
<iframe src="/calendar/" title="Calendar"
        style="width:100%; height:900px; border:0;"></iframe>
```

## 4. Connecting it to the calendar you already use

You can copy every entry into Google Calendar, Outlook or Apple Calendar.

**In this calendar:** click **Manage → Export for Google / Outlook / Apple**.
It downloads a file whose name ends in `.ics`. Then import that file:

**Google Calendar** (on a computer)
1. Open calendar.google.com.
2. Click the gear icon, then **Settings**.
3. In the left column click **Import & export**.
4. Choose the `.ics` file, pick which of your calendars to add it to, and
   click **Import**.

**Outlook**
- *Outlook.com or the new Outlook:* **Add calendar → Upload from file**, choose
  the `.ics` file, pick a calendar, **Import**.
- *Classic Outlook for Windows:* **File → Open & Export → Import/Export →
  Import an iCalendar (.ics) file**, choose the file, then **Import**.

**Apple Calendar**
- *Mac:* open the Calendar app, then **File → Import**, and choose the file.
- *iPhone or iPad:* email the file to yourself, tap the attachment, then
  **Add All**.

Tip: in Google or Outlook, create a new calendar called something like
"Schedule" first and import into that. You can then show, hide or delete all
of the imported entries at once.

### What to expect

- **It is a copy, not a live connection.** Entries you add here later do not
  appear in Google, Outlook or Apple on their own. Export and import again
  when you want to bring them up to date. Most calendar apps recognize entries
  they already have and will not duplicate them; importing into a separate
  calendar (see the tip above) keeps things tidy if yours does.
- **It goes one way.** Appointments you create in Google, Outlook or Apple do
  not come back into this calendar.
- **Each entry is titled with its note and the person**, for example
  `Dentist (Jordan)`. Entries with no times arrive as all-day events.

A live, two-way connection is possible, but it needs a small always-on service
and a sign-in with Google or Microsoft, which this version deliberately avoids.
If you find you need that, ask.

## 5. For developers

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

```sh
python3 -m http.server 8000     # then open http://localhost:8000
node --test tests/*.test.js     # storage-layer tests, Node 20+
```

All paths are relative, so the app works from any folder. `index.html`
redirects a folder address that is missing its trailing slash.

Data is one JSON document in `localStorage` under the key `calendar.v1`.
`calendar-api.js` is the only file that reads or writes it, and every method on
`window.CalendarApi` returns a Promise. To share one calendar between devices,
reimplement these methods against a server and leave the other files alone:

| Method | Purpose |
|---|---|
| `getMe()` | Who is using the page (currently a fixed local user) |
| `getUserDirectory()`, `savePerson(person)`, `deletePerson(id)` | People |
| `getStatuses()`, `saveStatus(status)`, `deleteStatus(id)` | Categories |
| `getEntries({ start_date, end_date })`, `createEntry(entry)`, `updateEntry(id, entry)`, `deleteEntry(id)` | Entries |
| `getSettings()`, `saveSettings(partial)` | Title and accent color |
| `exportData()`, `importData(json)` | Backup and restore |
| `exportIcs()` | Calendar file for Google, Outlook and Apple |
| `clearAll()`, `sampleDataSummary()`, `clearSampleData()`, `isSampleData()`, `storageOk()` | Housekeeping |

| File | What it does |
|---|---|
| `calendar-api.js` | Storage and export |
| `calendar-state.js` | Date helpers and page state |
| `calendar-filters.js` | Which entries are visible |
| `calendar-render.js` | Page shell: header, toolbar, summary |
| `calendar-roster.js` | The calendar views |
| `calendar-panels.js` | Day drawer and search results |
| `calendar-detail.js` | Selected-day side panel |
| `calendar-editor.js` | Add / edit entry dialog |
| `calendar-manage.js` | People, categories, appearance, backup, export |
| `calendar-main.js` | Wires everything together |
