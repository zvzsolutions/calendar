(function() {
  'use strict';

  // Categories are data (see calendar-api.js). This lookup is refilled from
  // the store by setStatuses() so views can read it synchronously.
  const STATUS_META = {};
  const UNKNOWN_STATUS = { label: 'Unknown', color: '#9aa1a9' };

  function setStatuses(list) {
    Object.keys(STATUS_META).forEach((key) => delete STATUS_META[key]);
    (list || []).forEach((status) => {
      STATUS_META[status.id] = { label: status.label, color: status.color };
    });
  }

  function statusMeta(_state, id) {
    return STATUS_META[id] || UNKNOWN_STATUS;
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const VIEW_MODES = ['day', 'week', 'month', 'two_months', 'year', 'people', 'all'];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function startOfWeek(date) {
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return addDays(value, -value.getDay());
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function monthRange(viewDate) {
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    return { start_date: isoDate(start), end_date: isoDate(end) };
  }

  function visibleRange(state) {
    const viewDate = state.viewDate || new Date();
    const viewMode = state.viewMode || 'month';

    if (viewMode === 'day') {
      const day = state.selectedDate || viewDate;
      return { start_date: isoDate(day), end_date: isoDate(day) };
    }

    if (viewMode === 'week') {
      const start = startOfWeek(state.selectedDate || viewDate);
      const end = addDays(start, 6);
      return { start_date: isoDate(start), end_date: isoDate(end) };
    }

    if (viewMode === 'two_months') {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 0);
      return { start_date: isoDate(start), end_date: isoDate(end) };
    }

    if (viewMode === 'year') {
      const start = new Date(viewDate.getFullYear(), 0, 1);
      const end = new Date(viewDate.getFullYear(), 11, 31);
      return { start_date: isoDate(start), end_date: isoDate(end) };
    }

    return monthRange(viewDate);
  }

  function createState() {
    const today = new Date();
    return {
      today,
      viewDate: new Date(today.getFullYear(), today.getMonth(), 1),
      viewMode: 'month',
      selectedDate: null,
      me: null,
      entries: [],
      peopleDirectory: [],
      directoryError: null,
      search: '',
      hiddenStatuses: new Set(),
      selectedUserId: null,
      statuses: [],
      settings: { title: 'Calendar', accent: '#2f6fb0' },
      sampleData: false,
      storageOk: true,
      manageOpen: false,
      drawerDate: null,
      drawerFocusEntryId: null,
      sidePanelMode: null,
      editor: null,
      editorSaving: false,
      editorReturnFocus: null,
      loading: true,
      error: null,
    };
  }

  window.CalendarState = {
    STATUS_META,
    setStatuses,
    statusMeta,
    MONTHS,
    DOW,
    VIEW_MODES,
    pad,
    createState,
    addDays,
    daysInMonth,
    isoDate,
    parseDate,
    monthRange,
    startOfWeek,
    visibleRange,
  };
})();
