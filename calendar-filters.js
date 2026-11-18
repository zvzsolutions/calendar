(function() {
  'use strict';

  function entryStartIso(entry) {
    return String(entry.start_date || '').slice(0, 10);
  }

  function entryEndIso(entry) {
    return String(entry.end_date || entry.start_date || '').slice(0, 10);
  }

  function entryUserId(entry) {
    return String(entry.user_id || '');
  }

  function entryUserName(entry) {
    return entry.user_name || 'Unassigned';
  }

  function entryTime(value) {
    return String(value || '').slice(0, 5);
  }

  function entryLabel(entry) {
    const meta = window.CalendarState.statusMeta(null, entry.status);
    return entry.note || meta.label || 'Entry';
  }

  function personForEntry(state, entry) {
    const id = entryUserId(entry);
    return (state.peopleDirectory || []).find((person) => String(person.id) === id) || null;
  }

  function filteredPeople(state) {
    const people = (state.peopleDirectory || []).map((person) => ({
      id: person.id,
      name: person.name || person.email || 'Unnamed',
      role: person.role || '',
      email: person.email || '',
    }));
    const selectedUserId = String(state.selectedUserId || '');
    if (!selectedUserId) return people;
    return people.filter((person) => String(person.id) === selectedUserId);
  }

  function filteredPersonIds(state) {
    const people = filteredPeople(state);
    if (!people.length && !state.selectedUserId) return null;
    return new Set(people.map((person) => String(person.id)));
  }

  function entryOverlapsDate(entry, iso) {
    const start = entryStartIso(entry);
    const end = entryEndIso(entry) || start;
    return Boolean(start && iso >= start && iso <= end);
  }

  function entryOverlapsRange(entry, range) {
    const start = entryStartIso(entry);
    const end = entryEndIso(entry) || start;
    return Boolean(start && range && start <= range.end_date && end >= range.start_date);
  }

  function keywordText(state, entry) {
    const person = personForEntry(state, entry) || {};
    const status = window.CalendarState.statusMeta(state, entry.status);
    return [
      entryLabel(entry),
      entry.note,
      status.label,
      entryUserName(entry),
      person.name,
      person.role,
      person.email,
      entryStartIso(entry),
      entryEndIso(entry),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function entryMatchesKeyword(state, entry) {
    const query = String(state.search || '').trim().toLowerCase();
    if (!query) return true;
    return query.split(/\s+/).every((term) => keywordText(state, entry).includes(term));
  }

  function visibleEntries(state) {
    const ids = filteredPersonIds(state);
    const range = window.CalendarState.visibleRange(state);
    const hiddenStatuses = state.hiddenStatuses || new Set();
    return (state.entries || [])
      .filter((entry) => !hiddenStatuses.has(entry.status))
      .filter((entry) => !ids || ids.has(entryUserId(entry)))
      .filter((entry) => entryMatchesKeyword(state, entry))
      .filter((entry) => entryOverlapsRange(entry, range))
      .slice()
      .sort((a, b) => (
        entryStartIso(a).localeCompare(entryStartIso(b)) ||
        (entryTime(a.start_time) || '99:99').localeCompare(entryTime(b.start_time) || '99:99') ||
        entryUserName(a).localeCompare(entryUserName(b))
      ));
  }

  function entriesForDate(state, isoDate) {
    const iso = typeof isoDate === 'string' ? isoDate.slice(0, 10) : window.CalendarState.isoDate(isoDate);
    return visibleEntries(state).filter((entry) => entryOverlapsDate(entry, iso));
  }

  function searchResults(state) {
    if (!String(state.search || '').trim()) return [];
    return visibleEntries(state);
  }

  window.CalendarFilters = {
    visibleEntries,
    entriesForDate,
    searchResults,
    entryMatchesKeyword,
    entryStartIso,
    entryEndIso,
    entryUserId,
    entryUserName,
    entryLabel,
    entryOverlapsDate,
    entryOverlapsRange,
  };
})();
