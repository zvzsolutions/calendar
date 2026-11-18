(function() {
  'use strict';

  const app = document.getElementById('calendarApp');
  const state = CalendarState.createState();
  let entriesRequestSeq = 0;
  let storageWarned = false;

  function showToast(message, type) {
    const toast = document.getElementById('calToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `cal-toast cal-toast-${type || 'info'} cal-toast-show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('cal-toast-show'), 4000);
  }

  async function loadEntries() {
    const requestSeq = ++entriesRequestSeq;
    const range = CalendarState.visibleRange(state);
    try {
      const entries = await CalendarApi.getEntries(range);
      if (requestSeq !== entriesRequestSeq) return false;
      state.entries = entries;
      state.loading = false;
      state.error = null;
      return true;
    } catch (err) {
      if (requestSeq !== entriesRequestSeq) return false;
      throw err;
    }
  }

  function applySettings() {
    const settings = state.settings || {};
    document.title = settings.title || 'Calendar';
    if (settings.accent) document.documentElement.style.setProperty('--accent', settings.accent);
  }

  // People, categories and settings all live in the store; re-read them
  // together so every view sees one consistent picture.
  async function loadMeta() {
    const [people, statuses, settings, sampleData, storageOk] = await Promise.all([
      CalendarApi.getUserDirectory(),
      CalendarApi.getStatuses(),
      CalendarApi.getSettings(),
      CalendarApi.isSampleData(),
      CalendarApi.storageOk(),
    ]);
    state.peopleDirectory = people;
    state.directoryError = null;
    state.statuses = statuses;
    state.settings = settings;
    state.sampleData = sampleData;
    state.storageOk = storageOk;
    CalendarState.setStatuses(statuses);
    const known = new Set(statuses.map((status) => status.id));
    state.hiddenStatuses.forEach((id) => {
      if (!known.has(id)) state.hiddenStatuses.delete(id);
    });
    if (state.selectedUserId && !people.some((person) => String(person.id) === String(state.selectedUserId))) {
      state.selectedUserId = null;
    }
    applySettings();
  }

  async function boot() {
    try {
      state.me = await CalendarApi.getMe();
      await loadMeta();
      const loaded = await loadEntries();
      if (!loaded) return;
      state.error = null;
      CalendarRender.render(app, state, actions);
      if (!state.storageOk) {
        showToast('This browser is blocking storage, so changes will not be saved.', 'error');
      }
    } catch (err) {
      state.loading = false;
      state.error = err.message;
      CalendarRender.render(app, state, actions);
      showToast(err.message, 'error');
    }
  }

  function selectedIsoDate() {
    return CalendarState.isoDate(state.selectedDate || state.viewDate || state.today || new Date());
  }

  function newManualEntry() {
    const date = selectedIsoDate();
    const firstPerson = (state.peopleDirectory || [])[0];
    const firstStatus = (state.statuses || [])[0];
    return {
      user_id: state.selectedUserId || (firstPerson ? firstPerson.id : ''),
      status: firstStatus ? firstStatus.id : '',
      start_date: date,
      end_date: date,
      start_time: '',
      end_time: '',
      event_color: '',
      source: 'manual',
      note: '',
    };
  }

  function restoreEditorFocus() {
    const target = state.editorReturnFocus;
    state.editorReturnFocus = null;
    if (!target || !document.contains || !document.contains(target) || !target.focus) return;
    try {
      target.focus({ preventScroll: true });
    } catch (err) {
      target.focus();
    }
  }

  function schedulePayloadBody(payload) {
    return {
      user_id: payload.user_id,
      status: payload.status,
      start_date: payload.start_date,
      end_date: payload.end_date,
      start_time: payload.start_time || '',
      end_time: payload.end_time || '',
      note: payload.note || '',
      event_color: payload.event_color || null,
    };
  }

  const actions = {
    showToast,
    async reload() {
      try {
        await loadMeta();
        const loaded = await loadEntries();
        if (loaded) CalendarRender.render(app, state, actions);
        if (!state.storageOk && !storageWarned) {
          storageWarned = true;
          showToast('This browser is blocking storage, so changes will not be saved.', 'error');
        }
      } catch (err) {
        state.loading = false;
        state.error = err.message;
        CalendarRender.render(app, state, actions);
        showToast(err.message, 'error');
      }
    },
    openDayDrawer(date, focusEntryId) {
      const iso = typeof date === 'string' ? date.slice(0, 10) : CalendarState.isoDate(date || state.selectedDate || state.viewDate || new Date());
      state.drawerDate = iso;
      state.drawerFocusEntryId = focusEntryId || null;
      state.sidePanelMode = 'day';
      state.selectedDate = CalendarState.parseDate(iso);
      CalendarRender.render(app, state, actions);
    },
    closeSidePanel() {
      state.drawerDate = null;
      state.drawerFocusEntryId = null;
      state.sidePanelMode = null;
      CalendarRender.render(app, state, actions);
    },
    focusEntryInDrawer(entryId) {
      state.drawerFocusEntryId = entryId || null;
      const entry = (state.entries || []).find((item) => String(item.id) === String(entryId));
      if (entry) {
        actions.openEditor(entry);
        return;
      }
      CalendarRender.render(app, state, actions);
    },
    setSearch(value) {
      const active = document.activeElement;
      const shouldRestoreSearch = active && active.classList && active.classList.contains('schedule-search');
      const selectionStart = shouldRestoreSearch ? active.selectionStart : null;
      const selectionEnd = shouldRestoreSearch ? active.selectionEnd : null;
      state.search = value;
      if (String(value || '').trim()) {
        state.sidePanelMode = 'search';
      } else if (state.sidePanelMode === 'search') {
        state.sidePanelMode = state.drawerDate ? 'day' : null;
      }
      CalendarRender.render(app, state, actions);
      if (!shouldRestoreSearch) return;
      const search = app.querySelector('.schedule-search');
      if (!search) return;
      try {
        search.focus({ preventScroll: true });
      } catch (err) {
        search.focus();
      }
      if (selectionStart == null || selectionEnd == null || !search.setSelectionRange) return;
      search.setSelectionRange(selectionStart, selectionEnd);
    },
    setViewDate(date) {
      state.viewDate = date;
      actions.reload();
    },
    setViewMode(mode) {
      if (!CalendarState.VIEW_MODES.includes(mode) || state.viewMode === mode) return;
      state.viewMode = mode;
      actions.reload();
    },
    setSelectedDate(date) {
      state.selectedDate = date;
      CalendarRender.render(app, state, actions);
    },
    setSelectedUser(userId) {
      state.selectedUserId = userId;
      CalendarRender.render(app, state, actions);
    },
    toggleStatus(status) {
      if (state.hiddenStatuses.has(status)) state.hiddenStatuses.delete(status);
      else state.hiddenStatuses.add(status);
      CalendarRender.render(app, state, actions);
    },
    openEditor(entry) {
      if (state.editorSaving) return;
      if (!entry && !(state.peopleDirectory || []).length) {
        showToast('Add a person first, then you can add entries for them.', 'info');
        if (actions.openManage) actions.openManage();
        return;
      }
      state.editorReturnFocus = document.activeElement;
      state.editor = entry || newManualEntry();
      CalendarRender.render(app, state, actions);
    },
    closeEditor() {
      if (state.editorSaving) return;
      state.editor = null;
      state.editorSaving = false;
      CalendarRender.render(app, state, actions);
      restoreEditorFocus();
    },
    async saveEditor(payload = {}) {
      if (state.editorSaving) return;
      const current = state.editor;
      if (!current) return;
      const editorId = current.id;
      if (payload.id && String(payload.id) !== String(editorId || '')) {
        showToast('Entry changed. Please reopen and try again.', 'error');
        return;
      }
      state.editorSaving = true;
      CalendarRender.render(app, state, actions);
      try {
        const body = schedulePayloadBody(payload);
        if (editorId) {
          await CalendarApi.updateEntry(editorId, body);
          showToast('Entry updated.', 'success');
        } else {
          await CalendarApi.createEntry(body);
          showToast('Entry created.', 'success');
        }
        state.editor = null;
        state.editorSaving = false;
        await actions.reload();
        restoreEditorFocus();
      } catch (err) {
        state.editorSaving = false;
        CalendarRender.render(app, state, actions);
        throw err;
      }
    },
    async deleteEntry(id) {
      if (state.editorSaving) return;
      const current = state.editor;
      if (!current || !current.id) return;
      if (id && String(id) !== String(current.id)) {
        showToast('Entry changed. Please reopen and try again.', 'error');
        return;
      }
      state.editorSaving = true;
      CalendarRender.render(app, state, actions);
      try {
        await CalendarApi.deleteEntry(current.id);
        showToast('Entry deleted.', 'success');
        state.editor = null;
        state.editorSaving = false;
        await actions.reload();
        restoreEditorFocus();
      } catch (err) {
        state.editorSaving = false;
        CalendarRender.render(app, state, actions);
        throw err;
      }
    },
  };

  window.CalendarApp = { state, actions };
  boot();
})();
