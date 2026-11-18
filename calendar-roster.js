(function() {
  'use strict';

  function escapeHtml(value) {
    return window.CalendarRender.escapeHtml(value);
  }

  const F = () => window.CalendarFilters;

  function entryStartIso(entry) {
    return F().entryStartIso(entry);
  }

  function entryEndIso(entry) {
    return F().entryEndIso(entry);
  }

  function entryUserId(entry) {
    return F().entryUserId(entry);
  }

  function entryUserName(entry) {
    return F().entryUserName(entry);
  }

  function entryLabel(entry) {
    return F().entryLabel(entry);
  }

  function entryOverlapsRange(entry, range) {
    return F().entryOverlapsRange(entry, range);
  }

  function entryTime(value) {
    return String(value || '').slice(0, 5);
  }

  function entryTimeLabel(entry) {
    const start = entryTime(entry.start_time);
    const end = entryTime(entry.end_time);
    if (!start && !end) return 'All day';
    if (start && end) return `${start}-${end}`;
    return start || end;
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

  function visibleEntries(state) {
    return F().visibleEntries(state);
  }

  function entriesForDay(state, day) {
    return F().entriesForDate(state, window.CalendarState.isoDate(day));
  }

  function entriesForPerson(state, personId) {
    return visibleEntries(state).filter((entry) => entryUserId(entry) === String(personId));
  }

  function isToday(state, day) {
    return window.CalendarState.isoDate(day) === window.CalendarState.isoDate(state.today || new Date());
  }

  function isSelectedDate(state, day) {
    return window.CalendarState.isoDate(day) === window.CalendarState.isoDate(state.selectedDate || state.today || new Date());
  }

  function isWeekend(day) {
    return day.getDay() === 0 || day.getDay() === 6;
  }

  function dayLabel(day) {
    return `${window.CalendarState.MONTHS[day.getMonth()]} ${day.getDate()}`;
  }

  function monthLabel(year, month) {
    return `${window.CalendarState.MONTHS[month]} ${year}`;
  }

  function daysForMonth(year, month) {
    const days = window.CalendarState.daysInMonth(year, month);
    return Array.from({ length: days }, (_, index) => new Date(year, month, index + 1));
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';
  }

  function renderToolbar(state) {
    return `
      <div class="roster-toolbar">
        <input class="schedule-search" type="search" placeholder="Keyword search" value="${escapeHtml(state.search || '')}" aria-label="Keyword search">
        <select class="user-filter" data-user-filter aria-label="Filter by person">
          ${renderUserFilterOptions(state)}
        </select>
      </div>
    `;
  }

  function personFilterLabel(person) {
    return person.name || person.email || 'Unnamed';
  }

  function renderUserFilterOptions(state) {
    const selectedUserId = String(state.selectedUserId || '');
    const people = (state.peopleDirectory || [])
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    return `
      <option value="" ${selectedUserId ? '' : 'selected'}>Everyone</option>
      ${people.map((person) => `
        <option value="${escapeHtml(person.id)}" ${selectedUserId === String(person.id) ? 'selected' : ''}>
          ${escapeHtml(personFilterLabel(person))}
        </option>
      `).join('')}
    `;
  }

  function entryColor(entry) {
    return entry.event_color || window.CalendarState.statusMeta(null, entry.status).color;
  }

  function barStyle(entry) {
    return `--entry-color:${escapeHtml(entryColor(entry))};`;
  }

  function renderDensityIndicators(entries) {
    if (!entries.length) return '';
    const dots = entries.slice(0, 3).map((entry) => (
      `<i class="density-dot" style="--pip-color:${escapeHtml(entryColor(entry))}" aria-hidden="true"></i>`
    )).join('');
    return `
      <span class="day-density" title="${entries.length} visible entries">
        <span class="density-dots">${dots}</span>
        <b>${entries.length}</b>
      </span>
    `;
  }

  function renderEntryPill(entry, compact, state) {
    const time = entryTimeLabel(entry);
    return `
      <button class="entry-bar ${compact ? 'is-compact' : ''}" type="button" data-entry-id="${escapeHtml(entry.id)}" style="${barStyle(entry)}" title="${escapeHtml(entryLabel(entry))}">
        ${compact ? '' : `<span class="entry-time">${escapeHtml(time)}</span>`}
        <span class="entry-name">${escapeHtml(entryLabel(entry))}</span>
        ${compact ? '' : `<span class="entry-person">${escapeHtml(entryUserName(entry))}</span>`}
      </button>
    `;
  }

  function renderDayTile(state, day, options = {}) {
    const classes = ['calendar-day'];
    if (isToday(state, day)) classes.push('is-today');
    if (isSelectedDate(state, day)) classes.push('is-selected');
    if (isWeekend(day)) classes.push('is-weekend');
    const entries = entriesForDay(state, day);
    const limit = options.compact ? 3 : 5;
    const shown = entries.slice(0, limit);
    const hiddenCount = Math.max(entries.length - shown.length, 0);

    return `
      <div class="${classes.join(' ')}" data-date="${window.CalendarState.isoDate(day)}" data-day-open="${window.CalendarState.isoDate(day)}" data-day-drilldown="true" role="button" tabindex="0" aria-label="${escapeHtml(dayLabel(day))}">
        <div class="calendar-day-head">
          <span>${escapeHtml(window.CalendarState.DOW[day.getDay()])}</span>
          <strong>${day.getDate()}</strong>
        </div>
        <div class="calendar-day-entries">
          ${shown.map((entry) => renderEntryPill(entry, options.compact, state)).join('')}
          ${hiddenCount ? renderDensityIndicators(entries) : ''}
          ${hiddenCount ? `<button class="day-more" type="button" data-date="${window.CalendarState.isoDate(day)}" data-day-open="${window.CalendarState.isoDate(day)}" data-day-drilldown="true">+${hiddenCount} more</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderWeekdays() {
    return window.CalendarState.DOW.map((day) => `<div class="weekday-label">${escapeHtml(day)}</div>`).join('');
  }

  function renderMonthBoard(state, year, month, options = {}) {
    const days = daysForMonth(year, month);
    const blanks = Array.from({ length: days[0].getDay() }, (_, index) => `<div class="calendar-day is-blank" aria-hidden="true" data-blank="${index}"></div>`).join('');
    const classes = ['calendar-month-board'];
    if (options.compact) classes.push('is-compact');

    return `
      <article class="${classes.join(' ')}">
        <div class="month-board-head">
          <h2>${escapeHtml(monthLabel(year, month))}</h2>
          <span>${entriesForMonth(state, year, month).length} entries</span>
        </div>
        <div class="calendar-weekdays">${renderWeekdays()}</div>
        <div class="calendar-month-grid">
          ${blanks}
          ${days.map((day) => renderDayTile(state, day, options)).join('')}
        </div>
      </article>
    `;
  }

  function entriesForMonth(state, year, month) {
    const start = window.CalendarState.isoDate(new Date(year, month, 1));
    const end = window.CalendarState.isoDate(new Date(year, month + 1, 0));
    return visibleEntries(state).filter((entry) => entryOverlapsRange(entry, { start_date: start, end_date: end }));
  }

  function renderMonthView(state) {
    return `
      <div class="month-overview">
        ${renderMonthBoard(state, state.viewDate.getFullYear(), state.viewDate.getMonth())}
      </div>
    `;
  }

  function renderTwoMonthsView(state) {
    const first = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);
    const second = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
    return `
      <div class="two-month-overview">
        ${renderMonthBoard(state, first.getFullYear(), first.getMonth(), { compact: true })}
        ${renderMonthBoard(state, second.getFullYear(), second.getMonth(), { compact: true })}
      </div>
    `;
  }

  function renderMiniMonth(state, year, month) {
    const days = daysForMonth(year, month);
    const blanks = Array.from({ length: days[0].getDay() }, (_, index) => `<span class="mini-day is-blank" aria-hidden="true" data-blank="${index}"></span>`).join('');
    return `
      <article class="year-month">
        <div class="year-month-head">
          <h2>${escapeHtml(window.CalendarState.MONTHS[month])}</h2>
          <span>${entriesForMonth(state, year, month).length}</span>
        </div>
        <div class="year-month-grid">
          ${window.CalendarState.DOW.map((day) => `<span class="mini-weekday">${escapeHtml(day.charAt(0))}</span>`).join('')}
          ${blanks}
          ${days.map((day) => {
            const entries = entriesForDay(state, day);
            const classes = ['mini-day'];
            if (entries.length) classes.push('has-entries');
            if (isToday(state, day)) classes.push('is-today');
            if (isSelectedDate(state, day)) classes.push('is-selected');
            const density = entries.length ? renderDensityIndicators(entries) : '';
            return `<button class="${classes.join(' ')}" type="button" data-date="${window.CalendarState.isoDate(day)}" data-day-open="${window.CalendarState.isoDate(day)}" data-day-drilldown="true" title="${escapeHtml(dayLabel(day))}: ${entries.length} entries"><span>${day.getDate()}</span>${density}</button>`;
          }).join('')}
        </div>
      </article>
    `;
  }

  function renderYearView(state) {
    const year = state.viewDate.getFullYear();
    return `
      <div class="year-overview">
        ${Array.from({ length: 12 }, (_, month) => renderMiniMonth(state, year, month)).join('')}
      </div>
    `;
  }

  function renderPersonCard(state, person) {
    const entries = entriesForPerson(state, person.id);
    const shown = entries.slice(0, 8);
    return `
      <article class="person-card ${String(state.selectedUserId || '') === String(person.id) ? 'is-selected' : ''}" data-user-id="${escapeHtml(person.id)}" role="button" tabindex="0">
        <div class="person-card-head">
          <span class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</span>
          <span class="person-text">
            <span class="person-name">${escapeHtml(person.name)}</span>
            <span class="person-role">${escapeHtml(person.role || '')}</span>
          </span>
          <strong>${entries.length}</strong>
        </div>
        <div class="person-entry-list">
          ${shown.length ? shown.map((entry) => `
            <button class="person-entry" type="button" data-entry-id="${escapeHtml(entry.id)}" data-date="${escapeHtml(entryStartIso(entry))}">
              <span class="detail-status" style="--status-color:${escapeHtml(entryColor(entry))}" aria-hidden="true"></span>
              <span>
                <strong>${escapeHtml(entryLabel(entry))}</strong>
                <small>${escapeHtml(entryStartIso(entry))} · ${escapeHtml(entryTimeLabel(entry))}</small>
              </span>
            </button>
          `).join('') : '<p class="empty-detail">No visible entries in this range.</p>'}
        </div>
      </article>
    `;
  }

  function renderPeopleView(state) {
    const people = filteredPeople(state);
    return `
      <div class="people-overview">
        ${people.length ? people.map((person) => renderPersonCard(state, person)).join('') : '<div class="empty-roster">No people yet. Use Manage to add someone.</div>'}
      </div>
    `;
  }

  function renderDayView(state) {
    const day = state.selectedDate || state.viewDate || state.today || new Date();
    const entries = entriesForDay(state, day);
    const counts = (state.statuses || [])
      .map((status) => ({ label: status.label, count: entries.filter((entry) => entry.status === status.id).length }))
      .filter((item) => item.count > 0);
    return `
      <div class="day-overview">
        <aside class="day-rail">
          <span class="day-rail-weekday">${escapeHtml(window.CalendarState.DOW[day.getDay()])}</span>
          <strong>${day.getDate()}</strong>
          <span>${escapeHtml(window.CalendarState.MONTHS[day.getMonth()])} ${day.getFullYear()}</span>
          <button class="primary-btn" type="button" data-day-add="${window.CalendarState.isoDate(day)}">Add Entry</button>
          <div class="day-rail-counts">
            ${counts.map((item) => `<span><b>${item.count}</b> ${escapeHtml(item.label)}</span>`).join('')}
          </div>
        </aside>
        <section class="day-entry-panel">
          <div class="day-overview-head">
            <h2>${escapeHtml(dayLabel(day))}</h2>
            <div class="day-overview-actions">
              <span>${entries.length} visible entries</span>
            </div>
          </div>
          <div class="day-entry-list">
            ${entries.length ? entries.map((entry) => renderEntryPill(entry, false, state)).join('') : '<p class="empty-roster">No visible entries for this day.</p>'}
          </div>
        </section>
      </div>
    `;
  }

  function daysForWeek(state) {
    const start = window.CalendarState.startOfWeek(state.selectedDate || state.viewDate || state.today || new Date());
    return Array.from({ length: 7 }, (_, index) => window.CalendarState.addDays(start, index));
  }

  function dayIndexInRange(iso, days) {
    const dateIso = String(iso || '').slice(0, 10);
    return days.findIndex((day) => window.CalendarState.isoDate(day) === dateIso);
  }

  function renderWeekSpanningBar(entry, days) {
    const startIndex = Math.max(dayIndexInRange(entryStartIso(entry), days), 0);
    const rawEndIndex = dayIndexInRange(entryEndIso(entry), days);
    const endIndex = rawEndIndex < 0 ? days.length - 1 : rawEndIndex;
    return `
      <button class="entry-bar timeline-bar" type="button" data-entry-id="${escapeHtml(entry.id)}" style="grid-column:${startIndex + 1} / ${endIndex + 2}; ${barStyle(entry)}" title="${escapeHtml(entryLabel(entry))}">
        <span class="entry-name">${escapeHtml(entryLabel(entry))}</span>
        <span class="entry-person">${escapeHtml(entryUserName(entry))}</span>
      </button>
    `;
  }

  function renderWeekView(state) {
    const days = daysForWeek(state);
    const entries = visibleEntries(state);
    return `
      <div class="week-overview">
        <div class="timeline-days" style="grid-template-columns:repeat(${days.length}, minmax(0, 1fr));">
          ${days.map((day) => `<button class="timeline-day-head" type="button" data-date="${window.CalendarState.isoDate(day)}" data-day-drilldown="true">${escapeHtml(window.CalendarState.DOW[day.getDay()])} ${day.getDate()}</button>`).join('')}
        </div>
        <div class="week-bars" style="grid-template-columns:repeat(${days.length}, minmax(0, 1fr));">
          ${entries.length ? entries.map((entry) => renderWeekSpanningBar(entry, days)).join('') : '<p class="empty-roster">No visible entries this week.</p>'}
        </div>
      </div>
    `;
  }

  function renderPersonTimelineRow(state, person, days) {
    const entries = entriesForPerson(state, person.id);
    return `
      <div class="person-cell person-timeline-row" data-user-id="${escapeHtml(person.id)}">
        <span class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</span>
        <span class="person-text">
          <span class="person-name">${escapeHtml(person.name)}</span>
          <span class="person-role">${escapeHtml(person.role || '')}</span>
        </span>
      </div>
      <div class="person-timeline-bars" style="grid-column:2 / span ${days.length}; grid-template-columns:repeat(${days.length}, var(--day-w));">
        ${entries.map((entry) => renderWeekSpanningBar(entry, days)).join('')}
      </div>
    `;
  }

  function renderAllView(state) {
    const range = window.CalendarState.visibleRange(state);
    const start = window.CalendarState.parseDate(range.start_date);
    const totalDays = Math.round((window.CalendarState.parseDate(range.end_date) - start) / 86400000) + 1;
    const days = Array.from({ length: totalDays }, (_, index) => window.CalendarState.addDays(start, index));
    const people = filteredPeople(state);

    return `
      <div class="all-overview">
        <div class="all-timeline-grid" style="--days:${days.length}">
          <div class="corner-cell">Person</div>
          ${days.map((day) => `<button class="day-head ${isToday(state, day) ? 'is-today' : ''}" type="button" data-date="${window.CalendarState.isoDate(day)}" data-day-drilldown="true"><span class="day-dow">${escapeHtml(window.CalendarState.DOW[day.getDay()])}</span><span class="day-num">${day.getDate()}</span></button>`).join('')}
          ${people.length ? people.map((person) => renderPersonTimelineRow(state, person, days)).join('') : '<div class="empty-roster">No people yet. Use Manage to add someone.</div>'}
        </div>
      </div>
    `;
  }

  function renderBoard(state) {
    if (state.viewMode === 'day') return renderDayView(state);
    if (state.viewMode === 'week') return renderWeekView(state);
    if (state.viewMode === 'two_months') return renderTwoMonthsView(state);
    if (state.viewMode === 'year') return renderYearView(state);
    if (state.viewMode === 'people') return renderPeopleView(state);
    if (state.viewMode === 'all') return renderAllView(state);
    return renderMonthView(state);
  }

  function render(state) {
    return `
      <section class="roster-card is-${escapeHtml(state.viewMode || 'month')}" aria-label="Calendar">
        ${renderToolbar(state)}
        ${renderBoard(state)}
      </section>
    `;
  }

  function bind(root, state, actions) {
    function isActivationKey(event) {
      return event.key === 'Enter' || event.key === ' ';
    }

    function activateOnKey(event, handler) {
      if (!isActivationKey(event)) return;
      event.preventDefault();
      handler(event);
    }

    function selectPerson(userId) {
      actions.setSelectedUser(userId);
    }

    function selectDate(date) {
      actions.setSelectedDate(window.CalendarState.parseDate(date));
    }

    function drillDownToDay(date) {
      selectDate(date);
      if (
        actions.openDayDrawer &&
        ['month', 'two_months', 'year'].includes(state.viewMode)
      ) {
        actions.openDayDrawer(date);
        return;
      }
      if (actions.setViewMode) {
        actions.setViewMode('day');
      }
    }

    function findEntry(entryId) {
      return (state.entries || []).find((entry) => String(entry.id) === String(entryId));
    }

    function activateEntry(entryId) {
      const entry = findEntry(entryId);
      if (entry && actions.openEditor) actions.openEditor(entry);
    }

    const search = root.querySelector('.schedule-search');
    if (search) {
      search.addEventListener('input', (event) => actions.setSearch(event.target.value));
    }
    root.querySelectorAll('[data-user-filter]').forEach((select) => {
      select.addEventListener('change', () => actions.setSelectedUser(select.value || null));
    });
    root.querySelectorAll('.person-card[data-user-id]').forEach((card) => {
      const activate = () => selectPerson(card.dataset.userId);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (event) => activateOnKey(event, activate));
    });
    root.querySelectorAll('.calendar-day[data-date], .mini-day[data-date], .day-more[data-date]').forEach((target) => {
      const activate = (event) => {
        if (event && target.classList && target.classList.contains('day-more')) event.stopPropagation();
        drillDownToDay(target.dataset.date);
      };
      target.addEventListener('click', activate);
      target.addEventListener('keydown', (event) => activateOnKey(event, activate));
    });
    root.querySelectorAll('.roster-card [data-day-add]').forEach((button) => {
      button.addEventListener('click', () => {
        selectDate(button.dataset.dayAdd);
        if (actions.openEditor) actions.openEditor();
      });
    });
    root.querySelectorAll('.entry-bar[data-entry-id], .person-entry[data-entry-id]').forEach((button) => {
      const activate = (event) => {
        event.stopPropagation();
        activateEntry(button.dataset.entryId, button.dataset.date);
      };
      button.addEventListener('click', activate);
    });
  }

  window.CalendarRoster = {
    render,
    bind,
  };
})();
