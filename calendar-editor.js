(function() {
  'use strict';

  function escapeHtml(value) {
    return window.CalendarRender.escapeHtml(value);
  }

  function firstValue() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function entryUserId(entry) {
    return firstValue(entry.user_id);
  }

  function entryStartDate(entry) {
    return String(firstValue(entry.start_date)).slice(0, 10);
  }

  function entryEndDate(entry) {
    return String(firstValue(entry.end_date, entry.start_date)).slice(0, 10);
  }

  function entryStartTime(entry) {
    return String(firstValue(entry.start_time)).slice(0, 5);
  }

  function entryEndTime(entry) {
    return String(firstValue(entry.end_time)).slice(0, 5);
  }

  function fieldValue(form, name) {
    return form.elements[name] ? String(form.elements[name].value || '').trim() : '';
  }

  function optionalTimeValue(form, name) {
    return fieldValue(form, name) || null;
  }

  function renderPersonOptions(state, selectedUserId) {
    return (state.peopleDirectory || []).map((person) => `
      <option value="${escapeHtml(person.id)}" ${String(selectedUserId) === String(person.id) ? 'selected' : ''}>
        ${escapeHtml(person.name || person.email || 'Unnamed')}
      </option>
    `).join('');
  }

  function statusColor(status) {
    return window.CalendarState.statusMeta(null, status).color;
  }

  function focusableElements(container) {
    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && element.offsetParent !== null);
  }

  function focusFirstField(container) {
    const focusables = focusableElements(container);
    const target = focusables.find((element) => element.name === 'user_id') || focusables[0];
    if (!target || !target.focus) return;
    try {
      target.focus({ preventScroll: true });
    } catch (err) {
      target.focus();
    }
  }

  function renderStatusOptions(state, selected) {
    return (state.statuses || []).map((status) => `
      <option value="${escapeHtml(status.id)}" data-color="${escapeHtml(status.color)}" ${String(selected) === String(status.id) ? 'selected' : ''}>
        ${escapeHtml(status.label)}
      </option>
    `).join('');
  }

  function render(state) {
    const entry = state.editor;
    if (!entry) return '';

    const isExisting = Boolean(entry.id);
    const canDelete = isExisting;
    const isSaving = Boolean(state.editorSaving);
    const title = isExisting ? 'Edit Entry' : 'Add Entry';
    const status = firstValue(entry.status, ((state.statuses || [])[0] || {}).id);

    return `
      <div class="editor-backdrop" role="presentation" data-editor-close>
        <section class="schedule-editor" role="dialog" aria-modal="true" aria-labelledby="scheduleEditorTitle">
          <form class="schedule-editor-form">
            <div class="editor-head">
              <div>
                <h2 id="scheduleEditorTitle">${escapeHtml(title)}</h2>
              </div>
              <button class="icon-btn" type="button" aria-label="Close editor" data-editor-close ${isSaving ? 'disabled' : ''}>&times;</button>
            </div>
            <div class="editor-grid">
              <label>
                <span>Person</span>
                <select name="user_id" required ${isSaving ? 'disabled' : ''}>
                  ${renderPersonOptions(state, entryUserId(entry))}
                </select>
              </label>
              <label>
                <span>Category</span>
                <select name="status" required ${isSaving ? 'disabled' : ''}>
                  ${renderStatusOptions(state, status)}
                </select>
              </label>
              <label>
                <span>Start Date</span>
                <input name="start_date" type="date" value="${escapeHtml(entryStartDate(entry))}" required ${isSaving ? 'disabled' : ''}>
              </label>
              <label>
                <span>End Date</span>
                <input name="end_date" type="date" value="${escapeHtml(entryEndDate(entry))}" required ${isSaving ? 'disabled' : ''}>
              </label>
              <label>
                <span>Start Time</span>
                <input name="start_time" type="time" value="${escapeHtml(entryStartTime(entry))}" ${isSaving ? 'disabled' : ''}>
              </label>
              <label>
                <span>End Time</span>
                <input name="end_time" type="time" value="${escapeHtml(entryEndTime(entry))}" ${isSaving ? 'disabled' : ''}>
              </label>
              <label>
                <span>Color</span>
                <input name="event_color" type="color" value="${escapeHtml(firstValue(entry.event_color, statusColor(status)))}" ${isSaving ? 'disabled' : ''}>
                <small class="field-help">Follows the category color unless you pick a different one.</small>
              </label>
              <label class="editor-note">
                <span>Note</span>
                <textarea name="note" rows="4" ${isSaving ? 'disabled' : ''}>${escapeHtml(firstValue(entry.note, ''))}</textarea>
              </label>
            </div>
            <div class="editor-actions">
              ${canDelete ? `<button class="danger-btn" type="button" data-editor-delete="${escapeHtml(entry.id)}" ${isSaving ? 'disabled' : ''}>Delete</button>` : ''}
              <span class="editor-action-spacer"></span>
              <button class="nav-btn" type="button" data-editor-close ${isSaving ? 'disabled' : ''}>Cancel</button>
              <button class="primary-btn" type="submit" ${isSaving ? 'disabled' : ''}>${isSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function formPayload(form, existing) {
    const current = existing || {};
    const status = fieldValue(form, 'status');
    const color = fieldValue(form, 'event_color').toLowerCase();
    return {
      id: current.id,
      user_id: fieldValue(form, 'user_id'),
      status,
      start_date: fieldValue(form, 'start_date'),
      end_date: fieldValue(form, 'end_date') || fieldValue(form, 'start_date'),
      start_time: optionalTimeValue(form, 'start_time'),
      end_time: optionalTimeValue(form, 'end_time'),
      note: fieldValue(form, 'note'),
      // Only keep a color when it differs from the category's, so recoloring
      // a category later still recolors this entry.
      event_color: color && color !== statusColor(status).toLowerCase() ? color : null,
    };
  }

  function bind(root, state, actions) {
    const backdrop = root.querySelector('.editor-backdrop');
    const form = root.querySelector('.schedule-editor-form');
    if (!backdrop || !form) return;

    focusFirstField(form);

    root.querySelectorAll('[data-editor-close]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (event.currentTarget === backdrop && event.target !== backdrop) return;
        actions.closeEditor();
      });
    });

    root.querySelectorAll('[data-editor-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.editorDelete;
        if (!id || state.editorSaving) return;
        if (window.confirm && !window.confirm('Delete this entry?')) return;
        try {
          await actions.deleteEntry(id);
        } catch (err) {
          actions.showToast(err.message || 'Unable to delete entry.', 'error');
        }
      });
    });

    // Keep the color swatch following the category until the person picks
    // their own color.
    const statusSelect = form.elements.status;
    const colorInput = form.elements.event_color;
    if (statusSelect && colorInput) {
      let lastStatusColor = statusColor(statusSelect.value).toLowerCase();
      statusSelect.addEventListener('change', () => {
        const nextColor = statusColor(statusSelect.value).toLowerCase();
        if (String(colorInput.value).toLowerCase() === lastStatusColor) colorInput.value = nextColor;
        lastStatusColor = nextColor;
      });
    }

    const startInput = form.elements.start_date;
    const endInput = form.elements.end_date;
    if (startInput && endInput) {
      startInput.addEventListener('change', () => {
        if (!endInput.value || endInput.value < startInput.value) endInput.value = startInput.value;
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.editorSaving) return;
      try {
        await actions.saveEditor(formPayload(form, state.editor));
      } catch (err) {
        actions.showToast(err.message || 'Unable to save entry.', 'error');
      }
    });

    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        actions.closeEditor();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = focusableElements(backdrop);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  window.CalendarEditor = {
    render,
    bind,
  };
})();
