(function() {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function entryUserId(entry) {
    return entry.user_id || '';
  }

  function entryUserName(entry) {
    return entry.user_name || 'Unassigned';
  }

  function entryStartIso(entry) {
    return String(entry.start_date || '').slice(0, 10);
  }

  function entryEndIso(entry) {
    return String(entry.end_date || entry.start_date || '').slice(0, 10);
  }

  function entryOverlapsDate(entry, iso) {
    const start = entryStartIso(entry);
    const end = entryEndIso(entry) || start;
    return Boolean(start && iso >= start && iso <= end);
  }

  function entriesForDay(entries, date) {
    const iso = window.CalendarState.isoDate(date);
    return (entries || []).filter((entry) => entryOverlapsDate(entry, iso));
  }

  function monthLabel(state) {
    if (state.viewMode === 'year') return `${state.viewDate.getFullYear()}`;
    if (state.viewMode === 'two_months') {
      const next = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
      return `${window.CalendarState.MONTHS[state.viewDate.getMonth()]} - ${window.CalendarState.MONTHS[next.getMonth()]} ${next.getFullYear()}`;
    }
    return `${window.CalendarState.MONTHS[state.viewDate.getMonth()]} ${state.viewDate.getFullYear()}`;
  }

  function viewModeLabel(mode) {
    if (mode === 'day') return 'Day';
    if (mode === 'week') return 'Week';
    if (mode === 'two_months') return '2 Months';
    if (mode === 'year') return 'Year';
    if (mode === 'people') return 'People';
    if (mode === 'all') return 'All';
    return 'Month';
  }

  function renderViewTabs(state) {
    const current = state.viewMode || 'month';
    return `
      <div class="view-tabs" aria-label="Calendar view">
        ${window.CalendarState.VIEW_MODES.map((mode) => `
          <button class="view-tab ${current === mode ? 'is-active' : ''}" type="button" data-view-mode="${escapeHtml(mode)}" aria-pressed="${current === mode ? 'true' : 'false'}">
            ${escapeHtml(viewModeLabel(mode))}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderStatusFilters(state) {
    const hiddenStatuses = state.hiddenStatuses || new Set();
    return (state.statuses || []).map((item) => {
      const status = item.id;
      const meta = item;
      const hidden = hiddenStatuses.has(status);
      return `
        <button class="filter-chip ${hidden ? 'is-muted' : 'is-active'}" type="button" data-status-filter="${escapeHtml(status)}" aria-pressed="${hidden ? 'false' : 'true'}">
          <span class="status-dot" style="--status-color:${escapeHtml(meta.color)}" aria-hidden="true"></span>
          ${escapeHtml(meta.label)}
        </button>
      `;
    }).join('');
  }

  function renderNotices(state) {
    const notices = [];
    if (state.storageOk === false) {
      notices.push(`
        <div class="schedule-notice is-warning" role="alert">
          <span>This browser is blocking storage, so changes will be lost when you close the page.</span>
        </div>
      `);
    }
    if (state.sampleData) {
      notices.push(`
        <div class="schedule-notice" role="status">
          <span>You're looking at sample data.</span>
          <button class="nav-btn" type="button" data-clear-sample>Clear sample data</button>
        </div>
      `);
    }
    return notices.join('');
  }

  function renderHeader(state) {
    const title = (state.settings && state.settings.title) || 'Calendar';
    return `
      <header class="schedule-topbar">
        <div class="brand-mark">
          <h1 class="brand-title">${escapeHtml(title)}</h1>
          <p class="brand-subtitle">${escapeHtml(monthLabel(state))}</p>
        </div>
      </header>
      ${renderNotices(state)}
      <div class="schedule-toolbar" aria-label="Calendar controls">
        <div class="nav-group" aria-label="Month navigation">
          <button class="nav-btn icon-only" type="button" data-cal-action="prev" aria-label="Previous">&lt;</button>
          <button class="nav-btn" type="button" data-cal-action="today">Today</button>
          <div class="month-label" aria-live="polite">${escapeHtml(monthLabel(state))}</div>
          <button class="nav-btn icon-only" type="button" data-cal-action="next" aria-label="Next">&gt;</button>
        </div>
        ${renderViewTabs(state)}
        <div class="status-filters" aria-label="Category filters">
          ${renderStatusFilters(state)}
        </div>
        <div class="schedule-controls">
          <button class="nav-btn" type="button" data-cal-action="manage">Manage</button>
          <button class="primary-btn" type="button" data-cal-action="add" data-action="new-entry">Add Entry</button>
        </div>
      </div>
    `;
  }

  function renderSummary(state) {
    const todayIso = window.CalendarState.isoDate(state.today || new Date());
    const todayEntries = entriesForDay(state.entries, state.today || new Date());
    const peopleToday = new Set(todayEntries.map((entry) => String(entryUserId(entry)))).size;
    const peopleCount = (state.peopleDirectory || []).length;
    const upcoming = (state.entries || []).filter((entry) => entryStartIso(entry) > todayIso).length;
    const total = (state.entries || []).length;

    return `
      <section class="schedule-summary" aria-label="Summary">
        <article class="summary-card">
          <p class="summary-label">Today</p>
          <p class="summary-number">${todayEntries.length}</p>
          <p class="summary-note">${todayEntries.length === 1 ? 'entry' : 'entries'} on today's date</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">People Today</p>
          <p class="summary-number">${peopleToday}</p>
          <p class="summary-note">of ${peopleCount} with something on</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">Upcoming</p>
          <p class="summary-number">${upcoming}</p>
          <p class="summary-note">starting after today, in this view</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">In This View</p>
          <p class="summary-number">${total}</p>
          <p class="summary-note">${total === 1 ? 'entry' : 'entries'} in the dates shown</p>
        </article>
      </section>
    `;
  }

  function bindShellActions(root, state, actions) {
    const prev = root.querySelector('[data-cal-action="prev"]');
    const next = root.querySelector('[data-cal-action="next"]');
    const today = root.querySelector('[data-cal-action="today"]');
    const add = root.querySelector('[data-cal-action="add"], [data-action="new-entry"]');
    const step = state.viewMode === 'year' ? 12 : (state.viewMode === 'two_months' ? 2 : 1);

    function shiftDate(days) {
      const base = state.selectedDate || state.viewDate || new Date();
      const nextDate = window.CalendarState.addDays(base, days);
      actions.setSelectedDate(nextDate);
      actions.setViewDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }

    if (prev) {
      prev.addEventListener('click', () => {
        if (state.viewMode === 'day') {
          shiftDate(-1);
          return;
        }
        if (state.viewMode === 'week') {
          shiftDate(-7);
          return;
        }
        actions.setViewDate(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - step, 1));
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        if (state.viewMode === 'day') {
          shiftDate(1);
          return;
        }
        if (state.viewMode === 'week') {
          shiftDate(7);
          return;
        }
        actions.setViewDate(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + step, 1));
      });
    }
    if (today) {
      today.addEventListener('click', () => {
        const now = new Date();
        actions.setSelectedDate(now);
        actions.setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
      });
    }
    if (add) {
      add.addEventListener('click', () => {
        if (actions.openEditor) actions.openEditor();
      });
    }
    root.querySelectorAll('[data-view-mode]').forEach((button) => {
      button.addEventListener('click', () => actions.setViewMode(button.dataset.viewMode));
    });
    root.querySelectorAll('[data-status-filter]').forEach((button) => {
      button.addEventListener('click', () => actions.toggleStatus(button.dataset.statusFilter));
    });
    const manage = root.querySelector('[data-cal-action="manage"]');
    if (manage) {
      manage.addEventListener('click', () => {
        if (actions.openManage) actions.openManage();
      });
    }
    root.querySelectorAll('[data-clear-sample]').forEach((button) => {
      button.addEventListener('click', () => {
        if (actions.clearSampleData) actions.clearSampleData();
      });
    });
  }

  function render(root, state, actions) {
    if (!root) return;
    if (state.loading) {
      root.innerHTML = '<section class="schedule-loading" aria-label="Loading calendar">Loading calendar...</section>';
      return;
    }
    if (state.error) {
      root.innerHTML = `<section class="schedule-error" role="alert">${escapeHtml(state.error)}</section>`;
      return;
    }

    root.innerHTML = `
      ${renderHeader(state, actions)}
      ${renderSummary(state)}
      ${window.CalendarRoster ? window.CalendarRoster.render(state) : ''}
      ${window.CalendarPanels ? window.CalendarPanels.render(state) : ''}
      ${window.CalendarDetail ? window.CalendarDetail.render(state) : ''}
      ${window.CalendarEditor ? window.CalendarEditor.render(state) : ''}
      ${window.CalendarManage ? window.CalendarManage.render(state) : ''}
    `;

    bindShellActions(root, state, actions);
    if (window.CalendarRoster) window.CalendarRoster.bind(root, state, actions);
    if (window.CalendarPanels && window.CalendarPanels.bind) window.CalendarPanels.bind(root, state, actions);
    if (window.CalendarDetail && window.CalendarDetail.bind) window.CalendarDetail.bind(root, state, actions);
    if (window.CalendarEditor && window.CalendarEditor.bind) window.CalendarEditor.bind(root, state, actions);
    if (window.CalendarManage && window.CalendarManage.bind) window.CalendarManage.bind(root, state, actions);
  }

  window.CalendarRender = {
    escapeHtml,
    entriesForDay,
    renderHeader,
    renderViewTabs,
    render,
  };
})();
