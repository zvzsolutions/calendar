(function() {
  'use strict';

  function escapeHtml(value) {
    return window.CalendarRender.escapeHtml(value);
  }

  function entryUserId(entry) {
    return window.CalendarFilters.entryUserId(entry);
  }

  function entryStartIso(entry) {
    return window.CalendarFilters.entryStartIso(entry);
  }

  function entryEndIso(entry) {
    return window.CalendarFilters.entryEndIso(entry);
  }

  function entryTime(value) {
    return String(value || '').slice(0, 5);
  }

  function selectedIso(state) {
    return window.CalendarState.isoDate(state.selectedDate || state.viewDate || state.today || new Date());
  }

  function selectedPerson(state) {
    const selectedUserId = String(state.selectedUserId || '');
    if (!selectedUserId) return null;
    return (state.peopleDirectory || []).find((person) => String(person.id) === selectedUserId) || null;
  }

  function entryOverlapsDate(entry, iso) {
    const start = entryStartIso(entry);
    const end = entryEndIso(entry) || start;
    return Boolean(start && iso >= start && iso <= end);
  }

  function selectedDateEntries(state) {
    const iso = selectedIso(state);
    const selectedUserId = String(state.selectedUserId || '');
    return (state.entries || [])
      .filter((entry) => {
        if (!entryOverlapsDate(entry, iso)) return false;
        if (selectedUserId && entryUserId(entry) !== selectedUserId) return false;
        return !state.hiddenStatuses.has(entry.status);
      })
      .sort((a, b) => {
        const aTime = entryTime(a.start_time) || '99:99';
        const bTime = entryTime(b.start_time) || '99:99';
        return aTime.localeCompare(bTime) || entryUserId(a).localeCompare(entryUserId(b));
      });
  }

  function dateLabel(state) {
    const date = state.selectedDate || state.viewDate || state.today || new Date();
    return `${window.CalendarState.MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function timeLabel(entry) {
    const start = entryTime(entry.start_time);
    const end = entryTime(entry.end_time);
    if (!start && !end) return 'All day';
    if (start && end) return `${start} - ${end}`;
    return start ? `${start} start` : `${end} end`;
  }

  function statusMeta(entry) {
    return window.CalendarState.statusMeta(null, entry.status);
  }

  function personLabel(entry, state) {
    const selected = selectedPerson(state);
    if (selected) return selected.name;
    return window.CalendarFilters.entryUserName(entry);
  }

  function renderEntry(entry, state) {
    const meta = statusMeta(entry);
    return `
      <button class="detail-entry is-editable" type="button" data-entry-id="${escapeHtml(entry.id)}" aria-label="Edit ${escapeHtml(entry.note || meta.label)}">
        <span class="detail-status" style="--status-color:${escapeHtml(entry.event_color || meta.color)}" aria-hidden="true"></span>
        <span class="detail-entry-body">
          <span class="detail-entry-top">
            <strong>${escapeHtml(meta.label)}</strong>
            <small>${escapeHtml(timeLabel(entry))}</small>
          </span>
          <span class="detail-person">${escapeHtml(personLabel(entry, state))}</span>
          ${entry.note ? `<span class="detail-note">${escapeHtml(entry.note)}</span>` : ''}
        </span>
      </button>
    `;
  }

  function render(state) {
    const person = selectedPerson(state);
    const entries = selectedDateEntries(state);
    const heading = person ? person.name : 'Everyone';
    const subheading = person && person.role ? `${person.role} on ${dateLabel(state)}` : dateLabel(state);

    return `
      <aside class="detail-panel" aria-label="Selected day details">
        <div class="detail-head">
          <div>
            <p class="detail-eyebrow">Selected</p>
            <h2>${escapeHtml(heading)}</h2>
            <p>${escapeHtml(subheading)}</p>
          </div>
          ${person ? '<button class="nav-btn" type="button" data-detail-clear-person>All People</button>' : ''}
        </div>
        <div class="detail-list">
          ${entries.length ? entries.map((entry) => renderEntry(entry, state)).join('') : `
            <p class="empty-detail">Nothing on this day.</p>
          `}
        </div>
      </aside>
    `;
  }

  function bind(root, state, actions) {
    const clear = root.querySelector('[data-detail-clear-person]');
    if (clear) {
      clear.addEventListener('click', () => actions.setSelectedUser(null));
    }

    root.querySelectorAll('.detail-entry[data-entry-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const entry = (state.entries || []).find((item) => String(item.id) === String(button.dataset.entryId));
        if (entry && actions.openEditor) actions.openEditor(entry);
      });
    });

  }

  window.CalendarDetail = {
    render,
    bind,
  };
})();
