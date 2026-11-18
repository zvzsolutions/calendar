/*
 * Manage dialog: the things a server used to own.
 * People, categories, appearance, and backup / restore.
 */
(function() {
  'use strict';

  function escapeHtml(value) {
    return window.CalendarRender.escapeHtml(value);
  }

  function entryCountLabel(count) {
    return `${count} ${count === 1 ? 'entry' : 'entries'}`;
  }

  function renderPeople(state) {
    const people = state.peopleDirectory || [];
    return `
      <section class="manage-section" aria-labelledby="managePeopleTitle">
        <h3 id="managePeopleTitle">People</h3>
        <p class="manage-help">Everyone who can have entries on the calendar.</p>
        <div class="manage-list">
          ${people.length ? people.map((person) => `
            <div class="manage-row manage-person" data-person-id="${escapeHtml(person.id)}">
              <input type="text" value="${escapeHtml(person.name)}" aria-label="Name" placeholder="Name" data-person-field="name" data-focus-key="person:${escapeHtml(person.id)}:name">
              <input type="text" value="${escapeHtml(person.role || '')}" aria-label="Role or group" placeholder="Role or group (optional)" data-person-field="role" data-focus-key="person:${escapeHtml(person.id)}:role">
              <input type="email" value="${escapeHtml(person.email || '')}" aria-label="Email" placeholder="Email (optional)" data-person-field="email" data-focus-key="person:${escapeHtml(person.id)}:email">
              <button class="danger-btn" type="button" data-person-delete="${escapeHtml(person.id)}" aria-label="Delete ${escapeHtml(person.name)}">Delete</button>
            </div>
          `).join('') : '<p class="empty-detail">No people yet. Add the first one below.</p>'}
        </div>
        <form class="manage-row manage-add" data-person-add>
          <input type="text" name="name" aria-label="New person name" placeholder="New person's name" required data-focus-key="person:new:name">
          <input type="text" name="role" aria-label="New person role or group" placeholder="Role or group (optional)">
          <button class="primary-btn" type="submit">Add person</button>
        </form>
      </section>
    `;
  }

  function renderCategories(state) {
    const statuses = state.statuses || [];
    return `
      <section class="manage-section" aria-labelledby="manageCategoriesTitle">
        <h3 id="manageCategoriesTitle">Categories</h3>
        <p class="manage-help">The kinds of entries, each with its own color.</p>
        <div class="manage-list">
          ${statuses.map((status) => `
            <div class="manage-row manage-status" data-status-id="${escapeHtml(status.id)}">
              <input type="color" value="${escapeHtml(status.color)}" aria-label="Color for ${escapeHtml(status.label)}" data-status-field="color">
              <input type="text" value="${escapeHtml(status.label)}" aria-label="Category name" data-status-field="label" data-focus-key="status:${escapeHtml(status.id)}:label">
              <button class="danger-btn" type="button" data-status-delete="${escapeHtml(status.id)}" aria-label="Delete ${escapeHtml(status.label)}">Delete</button>
            </div>
          `).join('')}
        </div>
        <form class="manage-row manage-add" data-status-add>
          <input type="color" name="color" value="#2f6fb0" aria-label="New category color">
          <input type="text" name="label" aria-label="New category name" placeholder="New category name" required data-focus-key="status:new:label">
          <button class="primary-btn" type="submit">Add category</button>
        </form>
      </section>
    `;
  }

  function renderAppearance(state) {
    const settings = state.settings || {};
    return `
      <section class="manage-section" aria-labelledby="manageAppearanceTitle">
        <h3 id="manageAppearanceTitle">Appearance</h3>
        <div class="manage-row manage-appearance">
          <label>
            <span>Calendar title</span>
            <input type="text" value="${escapeHtml(settings.title || '')}" data-setting="title" data-focus-key="setting:title">
          </label>
          <label>
            <span>Accent color</span>
            <input type="color" value="${escapeHtml(settings.accent || '#2f6fb0')}" data-setting="accent">
          </label>
        </div>
      </section>
    `;
  }

  function renderBackup(state) {
    return `
      <section class="manage-section" aria-labelledby="manageBackupTitle">
        <h3 id="manageBackupTitle">Backup</h3>
        <p class="manage-help">This calendar is saved in this browser on this device only. Download a backup now and then, and use it to move the calendar to another browser.</p>
        <div class="manage-row manage-backup">
          <button class="nav-btn" type="button" data-backup-download>Download backup</button>
          <button class="nav-btn" type="button" data-backup-restore>Restore from backup</button>
          <input type="file" accept="application/json,.json" data-backup-file hidden>
          ${state.sampleData ? '<button class="nav-btn" type="button" data-clear-sample>Clear sample data</button>' : ''}
        </div>
      </section>
    `;
  }

  function render(state) {
    if (!state.manageOpen) return '';
    return `
      <div class="editor-backdrop manage-backdrop" role="presentation">
        <section class="schedule-editor manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manageTitle">
          <div class="editor-head">
            <div>
              <h2 id="manageTitle">Manage</h2>
            </div>
            <button class="icon-btn" type="button" aria-label="Close" data-manage-close>&times;</button>
          </div>
          <div class="manage-body">
            ${renderPeople(state)}
            ${renderCategories(state)}
            ${renderAppearance(state)}
            ${renderBackup(state)}
          </div>
        </section>
      </div>
    `;
  }

  function focusableElements(container) {
    return Array.from(container.querySelectorAll('button, input, select, textarea'))
      .filter((element) => !element.disabled && !element.hidden && element.offsetParent !== null);
  }

  function entriesForPerson(personId) {
    return window.CalendarApi.getEntries({}).then((entries) => (
      entries.filter((entry) => String(entry.user_id) === String(personId)).length
    ));
  }

  function downloadText(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bind(root, state, actions) {
    const backdrop = root.querySelector('.manage-backdrop');
    if (!backdrop) return;

    // Runs a change, then re-renders and puts the cursor back where it was,
    // since every change redraws the whole page.
    async function run(work, successMessage) {
      try {
        await work();
        const active = document.activeElement;
        const focusKey = active && active.dataset ? active.dataset.focusKey : '';
        await actions.reload();
        if (successMessage) actions.showToast(successMessage, 'success');
        if (focusKey) {
          const target = root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
          if (target) target.focus({ preventScroll: true });
        }
      } catch (err) {
        await actions.reload();
        actions.showToast(err.message || 'That change could not be saved.', 'error');
      }
    }

    root.querySelectorAll('[data-manage-close]').forEach((button) => {
      button.addEventListener('click', () => actions.closeManage());
    });
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) actions.closeManage();
    });
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        actions.closeManage();
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

    // People
    root.querySelectorAll('.manage-person').forEach((row) => {
      const id = row.dataset.personId;
      row.querySelectorAll('[data-person-field]').forEach((input) => {
        input.addEventListener('change', () => run(() => (
          window.CalendarApi.savePerson({ id, [input.dataset.personField]: input.value })
        )));
      });
    });
    root.querySelectorAll('[data-person-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.personDelete;
        const person = (state.peopleDirectory || []).find((item) => String(item.id) === String(id));
        const count = await entriesForPerson(id);
        const question = count
          ? `Delete ${person ? person.name : 'this person'} and their ${entryCountLabel(count)}?`
          : `Delete ${person ? person.name : 'this person'}?`;
        if (window.confirm && !window.confirm(question)) return;
        run(() => window.CalendarApi.deletePerson(id), 'Person deleted.');
      });
    });
    const personAdd = root.querySelector('[data-person-add]');
    if (personAdd) {
      personAdd.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = personAdd.elements.name.value;
        const role = personAdd.elements.role.value;
        run(() => window.CalendarApi.savePerson({ name, role }), 'Person added.');
      });
    }

    // Categories
    root.querySelectorAll('.manage-status').forEach((row) => {
      const id = row.dataset.statusId;
      const save = () => run(() => window.CalendarApi.saveStatus({
        id,
        label: row.querySelector('[data-status-field="label"]').value,
        color: row.querySelector('[data-status-field="color"]').value,
      }));
      row.querySelectorAll('[data-status-field]').forEach((input) => input.addEventListener('change', save));
    });
    root.querySelectorAll('[data-status-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.statusDelete;
        const status = (state.statuses || []).find((item) => String(item.id) === String(id));
        if (window.confirm && !window.confirm(`Delete the ${status ? status.label : ''} category?`)) return;
        run(() => window.CalendarApi.deleteStatus(id), 'Category deleted.');
      });
    });
    const statusAdd = root.querySelector('[data-status-add]');
    if (statusAdd) {
      statusAdd.addEventListener('submit', (event) => {
        event.preventDefault();
        const label = statusAdd.elements.label.value;
        const color = statusAdd.elements.color.value;
        run(() => window.CalendarApi.saveStatus({ label, color }), 'Category added.');
      });
    }

    // Appearance
    root.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => run(() => (
        window.CalendarApi.saveSettings({ [input.dataset.setting]: input.value })
      )));
    });

    // Backup
    const download = root.querySelector('[data-backup-download]');
    if (download) {
      download.addEventListener('click', async () => {
        try {
          const json = await window.CalendarApi.exportData();
          downloadText(`calendar-backup-${window.CalendarState.isoDate(new Date())}.json`, json);
        } catch (err) {
          actions.showToast(err.message || 'Could not create the backup.', 'error');
        }
      });
    }
    const restore = root.querySelector('[data-backup-restore]');
    const fileInput = root.querySelector('[data-backup-file]');
    if (restore && fileInput) {
      restore.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        let text = '';
        try {
          text = await file.text();
        } catch (err) {
          actions.showToast('That file could not be read.', 'error');
          return;
        }
        if (window.confirm && !window.confirm('This replaces everything currently in the calendar. Continue?')) {
          fileInput.value = '';
          return;
        }
        run(() => window.CalendarApi.importData(text), 'Calendar restored from backup.');
      });
    }
  }

  window.CalendarManage = {
    render,
    bind,
  };
})();
