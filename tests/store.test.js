'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = path.join(__dirname, '..', 'calendar-api.js');
const KEY = 'calendar.v1';

function fakeStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    data,
    failWrites: false,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (this.failWrites) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem(key) { data.delete(key); },
  };
}

function load(storage) {
  const store = storage || fakeStorage();
  const window = {};
  const context = vm.createContext({ window, localStorage: store, crypto: globalThis.crypto, console });
  vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), context, { filename: 'calendar-api.js' });
  return { api: window.CalendarApi, storage: store };
}

// Values created inside the vm context have a different Object prototype;
// normalise through JSON before deep comparisons.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const EVERYTHING = { start_date: '0001-01-01', end_date: '9999-12-31' };

async function emptyApi(storage) {
  const loaded = load(storage);
  await loaded.api.clearAll();
  return loaded;
}

async function personAndStatus(api) {
  const person = await api.savePerson({ name: 'Pat Example' });
  const [status] = await api.getStatuses();
  return { person, status };
}

test('seeds sample data on first run', async () => {
  const { api } = load();
  assert.equal((await api.getUserDirectory()).length, 4);
  assert.equal((await api.getStatuses()).length, 7);
  assert.equal((await api.getEntries(EVERYTHING)).length, 8);
  assert.equal(await api.isSampleData(), true);
});

test('getMe is a constant local admin', async () => {
  const { api } = load();
  assert.deepEqual(plain(await api.getMe()), { id: 'local', name: 'Local', role: 'admin' });
});

test('data survives a reload', async () => {
  const { api, storage } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  const created = await api.createEntry({
    user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10', note: 'Dentist',
  });

  const reloaded = load(storage).api;
  const entries = await reloaded.getEntries(EVERYTHING);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, created.id);
  assert.equal(entries[0].note, 'Dentist');
  assert.equal(entries[0].user_name, 'Pat Example');
});

test('getEntries returns only entries overlapping the range', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-12' });

  assert.equal((await api.getEntries({ start_date: '2026-03-12', end_date: '2026-03-20' })).length, 1);
  assert.equal((await api.getEntries({ start_date: '2026-03-13', end_date: '2026-03-20' })).length, 0);
  assert.equal((await api.getEntries({ start_date: '2026-03-01', end_date: '2026-03-09' })).length, 0);
});

test('createEntry rejects end before start', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  await assert.rejects(
    api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-12', end_date: '2026-03-10' }),
    /end date/i,
  );
  assert.equal((await api.getEntries(EVERYTHING)).length, 0);
});

test('createEntry rejects unknown person or status', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  const dates = { start_date: '2026-03-10', end_date: '2026-03-10' };
  await assert.rejects(api.createEntry({ user_id: 'nobody', status: status.id, ...dates }), /person/i);
  await assert.rejects(api.createEntry({ user_id: '', status: status.id, ...dates }), /person/i);
  await assert.rejects(api.createEntry({ user_id: person.id, status: 'nope', ...dates }), /category/i);
});

test('createEntry rejects a malformed date', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  await assert.rejects(
    api.createEntry({ user_id: person.id, status: status.id, start_date: 'tomorrow', end_date: '2026-03-10' }),
    /date/i,
  );
});

test('updateEntry changes fields and keeps id', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  const created = await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10', note: 'a' });
  const updated = await api.updateEntry(created.id, { ...created, note: 'b', end_date: '2026-03-11' });
  assert.equal(updated.id, created.id);
  assert.equal(updated.note, 'b');
  const [stored] = await api.getEntries(EVERYTHING);
  assert.equal(stored.end_date, '2026-03-11');
});

test('updateEntry rejects an id that does not exist', async () => {
  const { api } = await emptyApi();
  await assert.rejects(api.updateEntry('missing', { note: 'x' }), /not found/i);
});

test('deleteEntry removes it', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  const created = await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10' });
  assert.equal(await api.deleteEntry(created.id), null);
  assert.equal((await api.getEntries(EVERYTHING)).length, 0);
});

test('savePerson requires a name and updates in place', async () => {
  const { api } = await emptyApi();
  await assert.rejects(api.savePerson({ name: '   ' }), /name/i);
  const person = await api.savePerson({ name: 'Pat', role: 'Driver', email: 'pat@example.com' });
  const renamed = await api.savePerson({ id: person.id, name: 'Patricia' });
  assert.equal(renamed.id, person.id);
  const people = await api.getUserDirectory();
  assert.equal(people.length, 1);
  assert.equal(people[0].name, 'Patricia');
});

test('deletePerson removes their entries', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  const other = await api.savePerson({ name: 'Other' });
  await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10' });
  await api.createEntry({ user_id: other.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10' });

  await api.deletePerson(person.id);
  const entries = await api.getEntries(EVERYTHING);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].user_id, other.id);
  assert.equal((await api.getUserDirectory()).length, 1);
});

test('saveStatus validates label and color', async () => {
  const { api } = await emptyApi();
  await assert.rejects(api.saveStatus({ label: '', color: '#112233' }), /name/i);
  await assert.rejects(api.saveStatus({ label: 'Shift', color: 'red' }), /color/i);
  const status = await api.saveStatus({ label: 'Shift', color: '#112233' });
  assert.equal((await api.getStatuses()).some((s) => s.id === status.id && s.label === 'Shift'), true);
});

test('deleteStatus refuses while in use', async () => {
  const { api } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10' });
  await assert.rejects(api.deleteStatus(status.id), /used by 1 entr/);
  assert.equal((await api.getStatuses()).length, 7);
});

test('deleteStatus removes an unused status', async () => {
  const { api } = await emptyApi();
  const [status] = await api.getStatuses();
  await api.deleteStatus(status.id);
  assert.equal((await api.getStatuses()).length, 6);
});

test('settings merge and persist', async () => {
  const { api, storage } = load();
  assert.deepEqual(plain(await api.getSettings()), { title: 'Calendar', accent: '#2f6fb0' });
  await api.saveSettings({ title: 'Family' });
  assert.deepEqual(plain(await load(storage).api.getSettings()), { title: 'Family', accent: '#2f6fb0' });
  await assert.rejects(api.saveSettings({ accent: 'blue' }), /color/i);
});

test('export then import round-trips', async () => {
  const first = load();
  const exported = await first.api.exportData();
  const second = await emptyApi();
  await second.api.importData(exported);
  assert.deepEqual(JSON.parse(await second.api.exportData()), JSON.parse(exported));
  assert.equal((await second.api.getEntries(EVERYTHING)).length, 8);
});

test('importData rejects junk and keeps data', async () => {
  const { api } = load();
  for (const junk of ['not json', '{"foo":1}', '[]', 'null', '{"version":1,"people":"x","statuses":[],"entries":[]}']) {
    await assert.rejects(api.importData(junk), /backup/i, `should reject ${junk}`);
  }
  assert.equal((await api.getEntries(EVERYTHING)).length, 8);
});

test('importData drops entries pointing at missing people', async () => {
  const { api } = await emptyApi();
  const doc = {
    version: 1,
    people: [{ id: 'p1', name: 'Pat' }],
    statuses: [{ id: 's1', label: 'Busy', color: '#112233' }],
    entries: [
      { id: 'e1', user_id: 'p1', status: 's1', start_date: '2026-03-10', end_date: '2026-03-10' },
      { id: 'e2', user_id: 'ghost', status: 's1', start_date: '2026-03-10', end_date: '2026-03-10' },
    ],
  };
  await api.importData(JSON.stringify(doc));
  const entries = await api.getEntries(EVERYTHING);
  assert.deepEqual(plain(entries.map((e) => e.id)), ['e1']);
  assert.equal(await api.isSampleData(), false);
});

test('corrupted storage is preserved, not destroyed', async () => {
  const storage = fakeStorage({ [KEY]: '{oops' });
  const { api } = load(storage);
  assert.equal(storage.getItem(`${KEY}.unreadable`), '{oops');
  assert.equal((await api.getUserDirectory()).length, 4);
});

test('data from a newer version is preserved, not destroyed', async () => {
  const newer = JSON.stringify({ version: 2, people: [], statuses: [], entries: [] });
  const storage = fakeStorage({ [KEY]: newer });
  load(storage);
  assert.equal(storage.getItem(`${KEY}.unreadable`), newer);
});

test('storage that throws on write does not throw to caller', async () => {
  const { api, storage } = await emptyApi();
  const { person, status } = await personAndStatus(api);
  assert.equal(await api.storageOk(), true);
  storage.failWrites = true;
  const created = await api.createEntry({ user_id: person.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10' });
  assert.ok(created.id);
  assert.equal(await api.storageOk(), false);
  assert.equal((await api.getEntries(EVERYTHING)).length, 1);
});

test('storage that throws on read still boots with sample data', async () => {
  const storage = fakeStorage();
  storage.getItem = () => { throw new Error('SecurityError'); };
  const { api } = load(storage);
  assert.equal((await api.getUserDirectory()).length, 4);
});

test('clearAll empties people and entries, keeps statuses', async () => {
  const { api } = load();
  await api.clearAll();
  assert.equal((await api.getUserDirectory()).length, 0);
  assert.equal((await api.getEntries(EVERYTHING)).length, 0);
  assert.equal((await api.getStatuses()).length, 7);
  assert.equal(await api.isSampleData(), false);
});

test('callers cannot mutate stored data through returned objects', async () => {
  const { api } = load();
  const people = await api.getUserDirectory();
  people[0].name = 'Tampered';
  people.length = 0;
  const again = await api.getUserDirectory();
  assert.equal(again.length, 4);
  assert.notEqual(again[0].name, 'Tampered');
});

test('sample flag survives edits until sample data is cleared', async () => {
  const { api, storage } = load();
  await api.savePerson({ name: 'Real Person' });
  assert.equal(await api.isSampleData(), true);
  assert.equal(await load(storage).api.isSampleData(), true);
});

test('clearSampleData removes only the sample people and their entries', async () => {
  const { api } = load();
  const real = await api.savePerson({ name: 'Real Person' });
  const [status] = await api.getStatuses();
  await api.createEntry({ user_id: real.id, status: status.id, start_date: '2026-03-10', end_date: '2026-03-10', note: 'Mine' });

  await api.clearSampleData();

  assert.deepEqual(plain((await api.getUserDirectory()).map((p) => p.name)), ['Real Person']);
  assert.deepEqual(plain((await api.getEntries(EVERYTHING)).map((e) => e.note)), ['Mine']);
  assert.equal(await api.isSampleData(), false);
});

test('clearSampleData keeps a sample person who was renamed, with the entries added for them', async () => {
  const { api } = load();
  const [status] = await api.getStatuses();
  await api.savePerson({ id: 'sample-alex', name: 'Uncle Bob' });
  await api.createEntry({ user_id: 'sample-alex', status: status.id, start_date: '2026-03-10', end_date: '2026-03-10', note: 'Real plan' });

  await api.clearSampleData();

  assert.deepEqual(plain((await api.getUserDirectory()).map((p) => p.name)), ['Uncle Bob']);
  assert.deepEqual(plain((await api.getEntries(EVERYTHING)).map((e) => e.note)), ['Real plan']);
});

test('sampleDataSummary counts exactly what clearSampleData will remove', async () => {
  const { api } = load();
  const [status] = await api.getStatuses();
  // An entry the person added for a sample person they did not rename goes too.
  await api.createEntry({ user_id: 'sample-sam', status: status.id, start_date: '2026-03-10', end_date: '2026-03-10', note: 'Added for Sam' });
  await api.savePerson({ id: 'sample-alex', name: 'Uncle Bob' });

  const before = (await api.getEntries(EVERYTHING)).length;
  const summary = plain(await api.sampleDataSummary());
  assert.deepEqual(summary, { people: 3, entries: 9 });

  await api.clearSampleData();
  assert.equal((await api.getUserDirectory()).length, 1);
  assert.equal((await api.getEntries(EVERYTHING)).length, before - summary.entries);
});

// ---- calendar file (.ics) export ------------------------------------------

async function icsFor(entries) {
  const { api } = await emptyApi();
  const person = await api.savePerson({ name: 'Pat Example' });
  const statuses = await api.getStatuses();
  const appointment = statuses.find((s) => s.label === 'Appointment');
  for (const entry of entries) {
    await api.createEntry({ user_id: person.id, status: appointment.id, ...entry });
  }
  return api.exportIcs();
}

function unfold(ics) {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n');
}

test('exportIcs wraps one event per entry in a calendar', async () => {
  const ics = await icsFor([
    { start_date: '2026-03-10', end_date: '2026-03-10', note: 'One' },
    { start_date: '2026-03-11', end_date: '2026-03-11', note: 'Two' },
  ]);
  const lines = unfold(ics);
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.some((line) => line.startsWith('PRODID:')));
  assert.equal(lines.filter((line) => line === 'BEGIN:VEVENT').length, 2);
  assert.equal(lines.filter((line) => line === 'END:VEVENT').length, 2);
  assert.equal(lines.filter(Boolean).pop(), 'END:VCALENDAR');
  assert.equal(lines.filter((line) => line.startsWith('UID:')).length, 2);
  assert.equal(new Set(lines.filter((line) => line.startsWith('UID:'))).size, 2);
  assert.ok(lines.some((line) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(line)));
});

test('exportIcs writes all-day entries with an exclusive end date', async () => {
  const lines = unfold(await icsFor([{ start_date: '2026-02-27', end_date: '2026-02-28', note: 'Trip' }]));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20260227'));
  // Two days, ending the 28th: calendar apps expect the day AFTER the last day.
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260301'));
});

test('exportIcs writes timed entries as local times', async () => {
  const lines = unfold(await icsFor([
    { start_date: '2026-03-10', end_date: '2026-03-10', start_time: '09:00', end_time: '10:30', note: 'Dentist' },
  ]));
  assert.ok(lines.includes('DTSTART:20260310T090000'));
  assert.ok(lines.includes('DTEND:20260310T103000'));
});

test('exportIcs gives a timed entry with no end time one hour', async () => {
  const lines = unfold(await icsFor([
    { start_date: '2026-03-10', end_date: '2026-03-10', start_time: '23:30', note: 'Late' },
  ]));
  assert.ok(lines.includes('DTSTART:20260310T233000'));
  assert.ok(lines.includes('DTEND:20260311T003000'));
});

test('exportIcs names the person and category and escapes special characters', async () => {
  const lines = unfold(await icsFor([
    { start_date: '2026-03-10', end_date: '2026-03-10', note: 'Lunch, then; errands\\done' },
  ]));
  assert.ok(lines.includes('SUMMARY:Lunch\\, then\; errands\\\\done (Pat Example)'));
  assert.ok(lines.includes('CATEGORIES:Appointment'));
});

test('exportIcs falls back to the category name when there is no note', async () => {
  const lines = unfold(await icsFor([{ start_date: '2026-03-10', end_date: '2026-03-10' }]));
  assert.ok(lines.includes('SUMMARY:Appointment (Pat Example)'));
});

test('exportIcs uses CRLF line endings and folds long lines', async () => {
  const ics = await icsFor([{ start_date: '2026-03-10', end_date: '2026-03-10', note: 'x'.repeat(300) }]);
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false);
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `line too long: ${line.length}`);
  assert.ok(unfold(ics).some((line) => line.startsWith('SUMMARY:') && line.includes('x'.repeat(300))));
});
