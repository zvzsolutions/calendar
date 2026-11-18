(function() {
  'use strict';

  function escapeHtml(value) {
    return window.CalendarRender.escapeHtml(value);
  }

  function entryStartIso(entry) {
    return window.CalendarFilters.entryStartIso(entry);
  }

  function entryTime(value) {
    return String(value || '').slice(0, 5);
  }

  function entryTimeLabel(entry) {
    const start = entryTime(entry.start_time || entry.startTime);
    const end = entryTime(entry.end_time || entry.endTime);
    if (!start && !end) return 'All day';
    if (start && end) return `${start}-${end}`;
    return start || end;
  }

  function entryTitle(entry) {
    return window.CalendarFilters.entryLabel(entry);
  }

  function personName(entry) {
    return window.CalendarFilters.entryUserName(entry);
  }

  function statusMeta(entry) {
    return window.CalendarState.statusMeta(null, entry.status);
  }

  function formatDate(value) {
    const date = window.CalendarState.parseDate(String(value).slice(0, 10));
    if (!date || Number.isNaN(date.getTime())) return String(value || '');
    return `${window.CalendarState.MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function renderEntryRow(entry, state, options = {}) {
    const focused = String(state.drawerFocusEntryId || '') === String(entry.id || '');
    const resultAttr = options.searchResult ? `data-search-result="${escapeHtml(entry.id)}"` : '';
    return `
      <div class="panel-entry-row">
        <button class="panel-entry ${focused ? 'is-focused' : ''}" type="button" data-panel-entry="${escapeHtml(entry.id)}" data-date="${escapeHtml(entryStartIso(entry))}" ${resultAttr}>
          <span class="detail-status" style="--status-color:${escapeHtml(entry.event_color || statusMeta(entry).color)}" aria-hidden="true"></span>
          <span class="panel-entry-copy">
            <strong>${escapeHtml(entryTitle(entry))}</strong>
            <small>${escapeHtml(personName(entry))} - ${escapeHtml(entryTimeLabel(entry))} - ${escapeHtml(statusMeta(entry).label)}</small>
          </span>
        </button>
      </div>
    `;
  }

  function renderDayDrawer(state) {
    if (!state.drawerDate) return '';
    const date = String(state.drawerDate).slice(0, 10);
    const entries = window.CalendarFilters.entriesForDate(state, date);

    return `
      <section class="schedule-day-drawer schedule-side-panel" aria-label="Day drawer">
        <div class="panel-head">
          <div>
            <p class="detail-eyebrow">Day</p>
            <h2>${escapeHtml(formatDate(date))}</h2>
            <p>${entries.length} visible ${entries.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          <button class="icon-btn" type="button" data-panel-close aria-label="Close day drawer">&times;</button>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" type="button" data-day-add="${escapeHtml(date)}">Add Entry</button>
        </div>
        <div class="panel-entry-list">
          ${entries.length ? entries.map((entry) => renderEntryRow(entry, state)).join('') : '<p class="empty-detail">No visible entries for this day.</p>'}
        </div>
      </section>
    `;
  }

  function renderSearchPanel(state) {
    const query = String(state.search || '').trim();
    if (!query) return '';
    const results = window.CalendarFilters.searchResults(state);
    const countLabel = `${results.length} ${results.length === 1 ? 'result' : 'results'}`;

    return `
      <section class="schedule-search-panel schedule-side-panel" aria-label="Calendar search results">
        <div class="panel-head">
          <div>
            <p class="detail-eyebrow">Search</p>
            <h2>${escapeHtml(countLabel)}</h2>
            <p>${escapeHtml(query)}</p>
          </div>
        </div>
        <div class="panel-entry-list">
            ${results.length ? results.map((entry) => renderEntryRow(entry, state, { searchResult: true })).join('') : '<p class="empty-detail">No entries match this search.</p>'}
        </div>
      </section>
    `;
  }

  function render(state) {
    const html = [
      renderSearchPanel(state),
      renderDayDrawer(state),
    ].filter(Boolean).join('');

    if (!html) return '';
    return `<aside class="schedule-side-panels">${html}</aside>`;
  }

  function bind(root, _state, actions) {
    root.querySelectorAll('[data-panel-close]').forEach((button) => {
      button.addEventListener('click', () => {
        if (actions.closeSidePanel) actions.closeSidePanel();
      });
    });

    root.querySelectorAll('.schedule-side-panel [data-day-add]').forEach((button) => {
      button.addEventListener('click', () => {
        if (actions.openDayDrawer) actions.openDayDrawer(button.dataset.dayAdd);
        if (actions.openEditor) actions.openEditor();
      });
    });

    root.querySelectorAll('[data-search-result]').forEach((button) => {
      button.addEventListener('click', () => {
        if (actions.openDayDrawer) actions.openDayDrawer(button.dataset.date, button.dataset.searchResult);
      });
    });

    root.querySelectorAll('[data-panel-entry]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.searchResult) return;
        if (actions.focusEntryInDrawer) actions.focusEntryInDrawer(button.dataset.panelEntry);
      });
    });

  }

  window.CalendarPanels = {
    render,
    bind,
  };
})();
