/*
 * Storage layer. This is the ONLY file that knows where calendar data lives.
 *
 * Today everything is one JSON document in this browser's localStorage.
 * To share a calendar between devices, reimplement the methods on
 * window.CalendarApi against a server and leave every other file alone.
 * Every method returns a Promise so that swap needs no caller changes.
 */
(function() {
  'use strict';

  const KEY = 'calendar.v1';
  const UNREADABLE_KEY = `${KEY}.unreadable`;
  const VERSION = 1;
  const ME = { id: 'local', name: 'Local', role: 'admin' };
  const DEFAULT_SETTINGS = { title: 'Calendar', accent: '#2f6fb0' };
  const DEFAULT_STATUSES = [
    { id: 'away', label: 'Away', color: '#c0492f' },
    { id: 'appointment', label: 'Appointment', color: '#2f6fb0' },
    { id: 'travel', label: 'Travel', color: '#8254c9' },
    { id: 'event', label: 'Event', color: '#1f8a6d' },
    { id: 'busy', label: 'Busy', color: '#d08a2c' },
    { id: 'birthday', label: 'Birthday', color: '#d4578f' },
    { id: 'other', label: 'Other', color: '#6b7280' },
  ];

  const SAMPLE_NAMES = {
    'sample-alex': 'Alex Sample',
    'sample-jordan': 'Jordan Sample',
    'sample-riley': 'Riley Sample',
    'sample-sam': 'Sam Sample',
  };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^\d{2}:\d{2}$/;
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  let idCounter = 0;
  let writesOk = true;
  let doc = null;

  function newId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (err) { /* fall through */ }
    idCounter += 1;
    return `id-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function isRealDate(value) {
    if (!DATE_RE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  // ---- seed ---------------------------------------------------------------

  function seedDocument() {
    const today = new Date();
    const day = (offset) => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
    const people = Object.keys(SAMPLE_NAMES).map((id) => (
      { id, name: SAMPLE_NAMES[id], role: 'Sample person', email: '' }
    ));
    const entry = (n, user, status, from, to, note, start, end) => ({
      id: `sample-entry-${n}`,
      user_id: user,
      status,
      start_date: day(from),
      end_date: day(to),
      start_time: start || '',
      end_time: end || '',
      note,
      event_color: null,
    });
    return {
      version: VERSION,
      sample: true,
      settings: { ...DEFAULT_SETTINGS },
      people,
      statuses: clone(DEFAULT_STATUSES),
      entries: [
        entry(1, 'sample-alex', 'away', -2, 1, 'Out of town'),
        entry(2, 'sample-jordan', 'appointment', 0, 0, 'Dentist', '09:00', '10:00'),
        entry(3, 'sample-riley', 'travel', 2, 6, 'Trip to the coast'),
        entry(4, 'sample-sam', 'event', 1, 1, 'Family dinner', '18:00', '20:00'),
        entry(5, 'sample-alex', 'busy', 4, 4, 'Car service', '13:00', '15:00'),
        entry(6, 'sample-jordan', 'birthday', 7, 7, 'Birthday'),
        entry(7, 'sample-riley', 'other', -5, -5, 'Delivery window'),
        entry(8, 'sample-sam', 'away', 8, 10, 'Long weekend'),
      ],
    };
  }

  // ---- validation ---------------------------------------------------------

  function fail(message) {
    throw new Error(message);
  }

  function cleanPerson(input, fallbackId) {
    const name = text(input && input.name);
    if (!name) fail('A person needs a name.');
    return {
      id: text(input.id) || fallbackId || newId(),
      name,
      role: text(input.role),
      email: text(input.email),
    };
  }

  function cleanStatus(input, fallbackId) {
    const label = text(input && input.label);
    if (!label) fail('A category needs a name.');
    const color = text(input.color);
    if (!COLOR_RE.test(color)) fail('Pick a valid color for the category.');
    return { id: text(input.id) || fallbackId || newId(), label, color: color.toLowerCase() };
  }

  function cleanTime(value) {
    const time = text(value).slice(0, 5);
    return TIME_RE.test(time) ? time : '';
  }

  function cleanEntry(input, source, id) {
    const payload = input || {};
    const userId = text(payload.user_id);
    if (!userId || !source.people.some((p) => p.id === userId)) fail('Choose a person for this entry.');
    const status = text(payload.status);
    if (!status || !source.statuses.some((s) => s.id === status)) fail('Choose a category for this entry.');
    const start = text(payload.start_date).slice(0, 10);
    const end = text(payload.end_date).slice(0, 10) || start;
    if (!isRealDate(start)) fail('Enter a valid start date.');
    if (!isRealDate(end)) fail('Enter a valid end date.');
    if (end < start) fail('The end date cannot be before the start date.');
    const color = text(payload.event_color);
    return {
      id,
      user_id: userId,
      status,
      start_date: start,
      end_date: end,
      start_time: cleanTime(payload.start_time),
      end_time: cleanTime(payload.end_time),
      note: text(payload.note),
      event_color: COLOR_RE.test(color) ? color.toLowerCase() : null,
    };
  }

  // Turns anything parsed from storage or a backup file into a trustworthy
  // document, or throws. Entries that point at a missing person or category,
  // or that fail validation, are dropped rather than failing the whole load.
  function normalizeDocument(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Not a calendar document.');
    if (raw.version !== VERSION) fail('Unsupported calendar version.');
    if (!Array.isArray(raw.people) || !Array.isArray(raw.statuses) || !Array.isArray(raw.entries)) {
      fail('Calendar document is missing its lists.');
    }
    const seen = new Set();
    const unique = (item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    };
    const safely = (fn) => (item) => {
      try { return fn(item); } catch (err) { return null; }
    };

    const people = raw.people.map(safely((p) => cleanPerson(p))).filter(Boolean).filter(unique);
    seen.clear();
    const statuses = raw.statuses.map(safely((s) => cleanStatus(s))).filter(Boolean).filter(unique);
    seen.clear();
    const partial = { people, statuses };
    const entries = raw.entries
      .map(safely((e) => cleanEntry(e, partial, text(e && e.id) || newId())))
      .filter(Boolean)
      .filter(unique);

    const settings = { ...DEFAULT_SETTINGS };
    const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    if (text(rawSettings.title)) settings.title = text(rawSettings.title);
    if (COLOR_RE.test(text(rawSettings.accent))) settings.accent = text(rawSettings.accent).toLowerCase();

    return { version: VERSION, sample: raw.sample === true, settings, people, statuses, entries };
  }

  // ---- persistence --------------------------------------------------------

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
      writesOk = true;
    } catch (err) {
      writesOk = false;
    }
  }

  function loadDocument() {
    let stored = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch (err) {
      writesOk = false;
      return seedDocument();
    }
    if (stored === null) {
      const seeded = seedDocument();
      doc = seeded;
      persist();
      return seeded;
    }
    try {
      return normalizeDocument(JSON.parse(stored));
    } catch (err) {
      // Never silently destroy data we could not read: park it, then start fresh.
      try { localStorage.setItem(UNREADABLE_KEY, stored); } catch (ignored) { writesOk = false; }
      const seeded = seedDocument();
      doc = seeded;
      persist();
      return seeded;
    }
  }

  doc = loadDocument();

  // ---- helpers ------------------------------------------------------------

  function decorate(entry) {
    const person = doc.people.find((p) => p.id === entry.user_id);
    return {
      ...entry,
      user_name: person ? person.name : 'Unknown',
      user_role: person ? person.role : '',
      source: 'manual',
    };
  }

  function overlaps(entry, range) {
    const from = text(range && range.start_date).slice(0, 10) || '0000-00-00';
    const to = text(range && range.end_date).slice(0, 10) || '9999-99-99';
    return entry.start_date <= to && entry.end_date >= from;
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name);
  }

  // Wraps a synchronous operation so callers always get a Promise and thrown
  // validation errors become rejections.
  function op(fn) {
    return function(...args) {
      try {
        return Promise.resolve(fn(...args));
      } catch (err) {
        return Promise.reject(err);
      }
    };
  }

  function sampleRemovalPlan() {
    const people = new Set(
      doc.people
        .filter((person) => SAMPLE_NAMES[person.id] && person.name === SAMPLE_NAMES[person.id])
        .map((person) => person.id)
    );
    const entries = new Set(
      doc.entries
        .filter((entry) => people.has(entry.user_id) || String(entry.id).startsWith('sample-entry-'))
        .map((entry) => entry.id)
    );
    return { people, entries };
  }

  // ---- calendar file (.ics) export -----------------------------------------

  function icsText(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  // Calendar files limit lines to 75 characters; longer ones continue on the
  // next line after a leading space.
  function icsFold(line) {
    const parts = [];
    let rest = line;
    let limit = 75;
    while (rest.length > limit) {
      parts.push(rest.slice(0, limit));
      rest = rest.slice(limit);
      limit = 74;
    }
    parts.push(rest);
    return parts.join('\r\n ');
  }

  function icsDate(iso) {
    return iso.replace(/-/g, '');
  }

  function icsDateTime(date) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  function localDate(iso, time) {
    const [y, m, d] = iso.split('-').map(Number);
    const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
    return new Date(y, m - 1, d, hh, mm);
  }

  function icsEvent(entry, stamp) {
    const person = doc.people.find((p) => p.id === entry.user_id);
    const status = doc.statuses.find((s) => s.id === entry.status);
    const category = status ? status.label : 'Entry';
    const title = `${entry.note || category} (${person ? person.name : 'Unknown'})`;
    const lines = ['BEGIN:VEVENT', `UID:${entry.id}@calendar`, `DTSTAMP:${stamp}`];

    if (entry.start_time) {
      const start = localDate(entry.start_date, entry.start_time);
      let end = entry.end_time ? localDate(entry.end_date, entry.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
      if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
      lines.push(`DTSTART:${icsDateTime(start)}`, `DTEND:${icsDateTime(end)}`);
    } else {
      const last = localDate(entry.end_date);
      const dayAfter = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${icsDate(entry.start_date)}`, `DTEND;VALUE=DATE:${icsDate(isoDate(dayAfter))}`);
    }

    lines.push(`SUMMARY:${icsText(title)}`, `CATEGORIES:${icsText(category)}`);
    if (entry.note) lines.push(`DESCRIPTION:${icsText(`${category}: ${entry.note}`)}`);
    lines.push('END:VEVENT');
    return lines;
  }

  function buildIcs() {
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Calendar//Standalone Calendar//EN',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${icsText(doc.settings.title)}`,
    ];
    doc.entries
      .slice()
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.start_time.localeCompare(b.start_time))
      .forEach((entry) => lines.push(...icsEvent(entry, stamp)));
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  function touch() {
    persist();
  }

  // ---- public surface -----------------------------------------------------

  window.CalendarApi = {
    getMe: op(() => ({ ...ME })),

    getUserDirectory: op(() => clone(doc.people).sort(byName)),

    getEntries: op((range) => doc.entries.filter((entry) => overlaps(entry, range)).map(decorate)),

    createEntry: op((payload) => {
      const entry = cleanEntry(payload, doc, newId());
      doc.entries.push(entry);
      touch();
      return decorate(entry);
    }),

    updateEntry: op((id, payload) => {
      const index = doc.entries.findIndex((entry) => entry.id === String(id));
      if (index === -1) fail('Entry not found. It may have been deleted.');
      const entry = cleanEntry({ ...doc.entries[index], ...(payload || {}) }, doc, doc.entries[index].id);
      doc.entries[index] = entry;
      touch();
      return decorate(entry);
    }),

    deleteEntry: op((id) => {
      doc.entries = doc.entries.filter((entry) => entry.id !== String(id));
      touch();
      return null;
    }),

    getStatuses: op(() => clone(doc.statuses)),

    saveStatus: op((input) => {
      const id = text(input && input.id);
      const index = id ? doc.statuses.findIndex((s) => s.id === id) : -1;
      const status = cleanStatus(input, index === -1 ? newId() : id);
      if (index === -1) doc.statuses.push(status);
      else doc.statuses[index] = status;
      touch();
      return clone(status);
    }),

    deleteStatus: op((id) => {
      const count = doc.entries.filter((entry) => entry.status === String(id)).length;
      if (count > 0) fail(`Category is used by ${count} ${count === 1 ? 'entry' : 'entries'}. Change or delete those first.`);
      doc.statuses = doc.statuses.filter((s) => s.id !== String(id));
      touch();
      return null;
    }),

    savePerson: op((input) => {
      const id = text(input && input.id);
      const index = id ? doc.people.findIndex((p) => p.id === id) : -1;
      const person = cleanPerson(index === -1 ? input : { ...doc.people[index], ...input }, index === -1 ? newId() : id);
      if (index === -1) doc.people.push(person);
      else doc.people[index] = person;
      touch();
      return clone(person);
    }),

    deletePerson: op((id) => {
      doc.people = doc.people.filter((p) => p.id !== String(id));
      doc.entries = doc.entries.filter((entry) => entry.user_id !== String(id));
      touch();
      return null;
    }),

    getSettings: op(() => ({ ...doc.settings })),

    saveSettings: op((partial) => {
      const next = { ...doc.settings };
      if (partial && partial.title !== undefined) {
        next.title = text(partial.title) || DEFAULT_SETTINGS.title;
      }
      if (partial && partial.accent !== undefined) {
        if (!COLOR_RE.test(text(partial.accent))) fail('Pick a valid accent color.');
        next.accent = text(partial.accent).toLowerCase();
      }
      doc.settings = next;
      persist();
      return { ...next };
    }),

    exportData: op(() => JSON.stringify(doc, null, 2)),

    importData: op((json) => {
      let next;
      try {
        next = normalizeDocument(JSON.parse(String(json)));
      } catch (err) {
        fail('That file is not a calendar backup.');
      }
      doc = next;
      persist();
      return null;
    }),

    // Every entry as a standard calendar file that Google Calendar, Outlook
    // and Apple Calendar can import. One-way: a snapshot, not a live link.
    exportIcs: op(() => buildIcs()),

    clearAll: op(() => {
      doc.people = [];
      doc.entries = [];
      doc.sample = false;
      persist();
      return null;
    }),

    // What clearSampleData() would remove, so the page can say so first.
    sampleDataSummary: op(() => {
      const plan = sampleRemovalPlan();
      return { people: plan.people.size, entries: plan.entries.size };
    }),

    // Removes the untouched sample people, everything scheduled for them, and
    // the built-in sample entries. A sample person who has been renamed is
    // treated as real and kept, along with entries added for them.
    clearSampleData: op(() => {
      const plan = sampleRemovalPlan();
      doc.people = doc.people.filter((person) => !plan.people.has(person.id));
      doc.entries = doc.entries.filter((entry) => !plan.entries.has(entry.id));
      doc.sample = false;
      persist();
      return null;
    }),

    isSampleData: op(() => doc.sample === true),

    storageOk: op(() => writesOk),
  };
})();
