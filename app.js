/* ==========================================================
   Productive — weekly planner
   - Weeks run Sunday 00:00 → Saturday 23:59. At Saturday midnight
     the finished week is wiped and the new week starts empty.
   - You can view the current week and any week ahead (not the past).
   - Every day has three columns: Create · In progress · Done.
   - Unfinished tasks whose time has passed auto-shift to the next
     day at the same time, until Saturday (end of week).
   - Everything is saved in the browser (localStorage), so reloads
     keep your data.
   ========================================================== */
(() => {
  'use strict';

  // ---------- Constants ----------
  const STORE_KEY = 'productive.v1';
  const UI_KEY = 'productive.ui.v1';
  const MAX_WEEKS_AHEAD = 52;

  const STATUSES = [
    { id: 'create', label: 'Create' },
    { id: 'progress', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const PRIORITY_LABELS = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Someday' };
  const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#FF4D4F' },
    { id: 'gym', name: 'Gym', color: '#FF9F1C' },
    { id: 'misc', name: 'Miscellaneous', color: '#3A86FF' },
    { id: 'appointment', name: 'Appointment', color: '#C04CFD' },
    { id: 'personal', name: 'Personal', color: '#2EC4B6' },
    { id: 'study', name: 'Study', color: '#FFD60A' },
  ];

  const ICONS = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    shift: '<svg viewBox="0 0 24 24"><path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const startOfWeek = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const currentWeekKey = () => dateKey(startOfWeek(new Date()));
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtShort = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmtTime = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Mouse/trackpad devices use native HTML drag & drop; touch screens use long-press drag (see below).
  const CAN_NATIVE_DRAG = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- State ----------
  function freshState() {
    return { version: 1, activeWeek: currentWeekKey(), categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), weeks: {} };
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s.weeks === 'object' && Array.isArray(s.categories) && s.categories.length) return s;
    } catch (_) { /* ignore corrupt data */ }
    return freshState();
  }
  function loadUI() {
    try { return { filter: [], showPast: false, ...JSON.parse(localStorage.getItem(UI_KEY)) }; }
    catch (_) { return { filter: [], showPast: false }; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (_) { toast('Couldn’t save — browser storage is full or blocked'); }
  }
  function saveUI() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) { /* non-critical */ }
  }

  let state = loadState();
  let ui = loadUI();
  let viewOffset = 0;           // 0 = this week, 1 = next week, ...
  let draggingId = null;
  let editing = null;           // { weekKey, id } when editing an existing task
  let form = {};                // modal selections
  let lastSig = '';

  const weekTasks = (key) => state.weeks[key] || [];
  const ensureWeek = (key) => (state.weeks[key] ||= []);
  const viewWeekStart = () => addDays(startOfWeek(new Date()), viewOffset * 7);
  const viewWeekKey = () => dateKey(viewWeekStart());
  const catById = (id) => state.categories.find((c) => c.id === id) || { id, name: 'Uncategorized', color: '#8D92A1' };

  function dueDate(weekKey, t) {
    const d = addDays(parseKey(weekKey), t.day);
    if (t.time) { const [h, m] = t.time.split(':').map(Number); d.setHours(h, m, 0, 0); }
    else d.setHours(23, 59, 59, 999);
    return d;
  }
  const isOverdue = (weekKey, t) => t.status !== 'done' && dueDate(weekKey, t) < new Date();

  // ---------- Weekly reset ----------
  // Removes every week before the current one. Runs on load and every tick,
  // so the moment Saturday turns into Sunday 00:00 the board starts fresh.
  function checkRollover() {
    const key = currentWeekKey();
    if (state.activeWeek === key) return false;
    const hadPrevious = !!state.activeWeek;
    Object.keys(state.weeks).forEach((k) => { if (k < key) delete state.weeks[k]; });
    state.activeWeek = key;
    save();
    if (viewOffset > 0) viewOffset = Math.max(0, viewOffset - 1);
    return hadPrevious;
  }

  // ---------- Overdue auto-shift ----------
  // Any unfinished task in the current week whose time has passed moves to the
  // next day at the same time. It keeps moving until Saturday; after that it
  // stays on Saturday and is flagged overdue.
  function shiftOverdue() {
    const key = currentWeekKey();
    const list = state.weeks[key];
    if (!list) return 0;
    const now = new Date();
    let moved = 0;
    for (const t of list) {
      if (t.status === 'done') continue;
      let changed = false;
      while (t.day < 6 && dueDate(key, t) < now) {
        if (t.originalDay == null) t.originalDay = t.day;
        t.day += 1;
        changed = true;
      }
      if (changed) moved += 1;
    }
    if (moved) save();
    return moved;
  }

  // ---------- Smooth updates ----------
  // Data changes apply immediately; only the DOM swap is animated.
  function update(mutate) {
    mutate();
    save();
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(render);
    else render();
  }

  // ---------- Rendering ----------
  function render() {
    const weekStart = viewWeekStart();
    const key = dateKey(weekStart);
    const tasks = weekTasks(key);
    const isCurrent = viewOffset === 0;
    const todayIdx = new Date().getDay();

    renderHeader(weekStart);
    renderSummary(tasks, isCurrent);
    renderFilters();
    renderStrip(weekStart, tasks, isCurrent, todayIdx);
    renderBoard(weekStart, key, tasks, isCurrent, todayIdx);
    renderCountdown();
    lastSig = signature();
  }

  function renderHeader(weekStart) {
    const end = addDays(weekStart, 6);
    $('#weekRange').textContent = `${fmtShort(weekStart)} – ${fmtShort(end)}`;
    $('#weekTag').textContent = viewOffset === 0 ? 'This week' : viewOffset === 1 ? 'Next week' : `In ${viewOffset} weeks`;
    $('#prevWeek').disabled = viewOffset === 0;
    $('#nextWeek').disabled = viewOffset >= MAX_WEEKS_AHEAD;
    $('#todayBtn').hidden = viewOffset === 0;
  }

  function renderSummary(tasks, isCurrent) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const prog = tasks.filter((t) => t.status === 'progress').length;
    const todo = total - done - prog;
    const pct = total ? Math.round((done / total) * 100) : 0;

    let headline;
    if (!total) headline = isCurrent ? 'Fresh week. <em>Make it count.</em>' : 'Plan ahead. <em>Future you says thanks.</em>';
    else if (pct === 100) headline = 'Everything’s <em>done.</em> Nice.';
    else if (pct >= 60) headline = `Almost there — <em>${pct}%</em> done.`;
    else headline = `${todo + prog} to go. <em>Keep moving.</em>`;
    $('#headline').innerHTML = headline;

    $('#progressFill').style.width = pct + '%';
    $('#progressText').textContent = total ? `${done} of ${total} done · ${pct}%` : 'No tasks yet';
    $('#stats').innerHTML = `
      <div class="stat"><b>${todo}</b><span>To do</span></div>
      <div class="stat"><b>${prog}</b><span>In progress</span></div>
      <div class="stat accent"><b>${done}</b><span>Done</span></div>`;
  }

  function renderFilters() {
    const active = new Set(ui.filter);
    $('#filters').innerHTML =
      `<button class="filter ${active.size ? '' : 'active'}" data-filter="all">All</button>` +
      state.categories.map((c) =>
        `<button class="filter ${active.has(c.id) ? 'active' : ''}" data-filter="${esc(c.id)}" style="--c:${esc(c.color)}"><i></i>${esc(c.name)}</button>`
      ).join('');
  }

  function renderStrip(weekStart, tasks, isCurrent, todayIdx) {
    $('#daystrip').innerHTML = DAY_NAMES.map((name, i) => {
      const d = addDays(weekStart, i);
      const dayTasks = tasks.filter((t) => t.day === i);
      const open = dayTasks.filter((t) => t.status !== 'done').length;
      const cats = [...new Set(dayTasks.map((t) => t.cat))].slice(0, 4);
      const cls = [isCurrent && i === todayIdx ? 'today' : '', isCurrent && i < todayIdx ? 'past' : ''].join(' ');
      return `<button class="strip-day ${cls}" data-jump="${i}">
        <span class="sd-name">${name.slice(0, 3)}</span>
        <span class="sd-date">${d.getDate()}</span>
        <span class="sd-count">${dayTasks.length ? `${open} open` : '—'}</span>
        <span class="sd-dots">${cats.map((c) => `<i style="--c:${esc(catById(c).color)}"></i>`).join('')}</span>
      </button>`;
    }).join('');
  }

  function sortTasks(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return a.createdAt - b.createdAt;
  }

  function renderBoard(weekStart, key, tasks, isCurrent, todayIdx) {
    const filter = new Set(ui.filter);
    const visible = filter.size ? tasks.filter((t) => filter.has(t.cat)) : tasks;
    const pastCount = isCurrent ? todayIdx : 0;

    const toggle = $('#pastToggle');
    toggle.hidden = pastCount === 0;
    toggle.textContent = ui.showPast ? 'Hide earlier days' : `Show earlier days (${pastCount})`;

    let html = '';
    if (pastCount && !ui.showPast) {
      const pastDone = visible.filter((t) => t.day < todayIdx && t.status === 'done').length;
      const names = DAY_NAMES.slice(0, todayIdx).map((n) => n.slice(0, 3)).join(' · ');
      html += `<button class="past-bar" data-show-past>
        <b>Earlier this week</b><span class="sep">—</span><span class="past-names">${names}</span>
        <span class="sep">·</span>${pastDone} done
        <span class="go">Show ${ICONS.chevron}</span>
      </button>`;
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const isToday = isCurrent && i === todayIdx;
      const isPast = isCurrent && i < todayIdx;
      const dayTasks = visible.filter((t) => t.day === i);
      const doneCount = dayTasks.filter((t) => t.status === 'done').length;

      if (isPast && !ui.showPast) continue;

      html += `<section class="day ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}" id="day-${i}">
        <header class="day-head">
          <div class="day-title">
            <span class="day-name">${DAY_NAMES[i]}</span>
            <span class="day-date">${fmtShort(date)}</span>
          </div>
          ${isToday ? '<span class="pill">Today</span>' : ''}
          ${isPast ? '<span class="pill muted">Past</span>' : ''}
          <span class="day-stats">${dayTasks.length ? `${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'} · ${doneCount} done` : ''}</span>
          ${isPast ? '' : `<button class="add-btn" data-add="${i}" aria-label="Add task to ${DAY_NAMES[i]}">${ICONS.plus}<span class="add-text">Add</span></button>`}
        </header>
        <div class="cols">
          ${STATUSES.map((s) => {
            const colTasks = dayTasks.filter((t) => t.status === s.id).sort(sortTasks);
            const empty = colTasks.length ? '' :
              (s.id === 'create' && !isPast
                ? `<button class="empty" data-add="${i}">${ICONS.plus}Add a task</button>`
                : `<div class="empty">${isPast ? '' : 'Drop here'}</div>`);
            return `<div class="col" data-status="${s.id}">
              <div class="col-head"><span class="col-dot"></span>${s.label}<span class="count">${colTasks.length}</span></div>
              <div class="col-body" data-day="${i}" data-status="${s.id}" ${isPast ? '' : 'data-drop'}>
                ${colTasks.map((t) => cardHTML(key, t)).join('')}${empty}
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>`;
    }
    $('#board').innerHTML = html;
  }

  function cardHTML(weekKey, t) {
    const cat = catById(t.cat);
    const overdue = isOverdue(weekKey, t);
    const meta = [];
    if (t.time) meta.push(`<span>${ICONS.clock}${esc(fmtTime(t.time))}</span>`);
    if (t.location) {
      const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.location);
      meta.push(`<a href="${url}" target="_blank" rel="noopener" title="Open in Maps">${ICONS.pin}${esc(t.location)}</a>`);
    }
    if (t.originalDay != null && t.originalDay !== t.day && t.status !== 'done') {
      meta.push(`<span class="moved" title="Auto-moved because it wasn't finished in time">${ICONS.shift}from ${DAY_NAMES[t.originalDay].slice(0, 3)}</span>`);
    }
    if (overdue) meta.push(`<span class="overdue">${ICONS.alert}Overdue</span>`);

    const next = t.status === 'create' ? { icon: ICONS.arrow, label: 'Start (move to In progress)' }
      : t.status === 'progress' ? { icon: ICONS.check, label: 'Mark done' }
      : { icon: ICONS.undo, label: 'Reopen' };

    return `<article class="card ${t.status === 'done' ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}"
        ${CAN_NATIVE_DRAG ? 'draggable="true"' : ''} tabindex="0" data-id="${t.id}"
        style="--cat:${esc(cat.color)}; view-transition-name:${t.id}"
        aria-label="${esc(t.title)}, ${esc(cat.name)}, priority ${t.priority}">
      <div class="card-top">
        <span class="cat-tag"><i></i>${esc(cat.name)}</span>
        <span class="prio p${t.priority}" title="Priority ${t.priority} · ${PRIORITY_LABELS[t.priority]}">P${t.priority}</span>
      </div>
      <h4>${esc(t.title)}</h4>
      ${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ''}
      <div class="meta">${meta.join('')}</div>
      <button class="advance" data-advance="${t.id}" title="${next.label}" aria-label="${next.label}">${next.icon}</button>
    </article>`;
  }

  function renderCountdown() {
    const end = addDays(startOfWeek(new Date()), 7); // Sunday 00:00 = Saturday midnight
    let ms = end - new Date();
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4);
    const txt = `Week resets in ${d ? d + 'd ' : ''}${h}h ${m}m`;
    $('#resetText').textContent = txt;
    $('#resetInline').textContent = txt + ' · Saturday at midnight';
  }

  // Cheap fingerprint of anything time-dependent, so the periodic tick
  // only re-renders when something visible actually changed.
  function signature() {
    const key = currentWeekKey();
    const overdue = weekTasks(key).filter((t) => isOverdue(key, t)).map((t) => t.id).join(',');
    return `${dateKey(new Date())}|${overdue}`;
  }

  // ---------- Task actions ----------
  function findTask(id, key = viewWeekKey()) {
    return weekTasks(key).find((t) => t.id === id);
  }

  function moveTask(id, day, status) {
    const key = viewWeekKey();
    const t = findTask(id, key);
    if (!t || (t.day === day && t.status === status)) return;
    update(() => {
      if (t.day !== day) delete t.originalDay; // manual move resets auto-shift history
      t.day = day;
      t.status = status;
    });
    afterManualChange();
  }

  function advanceTask(id) {
    const t = findTask(id);
    if (!t) return;
    const order = ['create', 'progress', 'done'];
    const next = t.status === 'done' ? 'create' : order[order.indexOf(t.status) + 1];
    update(() => { t.status = next; });
    if (next === 'done') toast(`Nice — “${truncate(t.title, 28)}” is done`);
    else afterManualChange();
  }

  function deleteTask(id) {
    const key = viewWeekKey();
    const list = weekTasks(key);
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [removed] = list.slice(idx, idx + 1);
    update(() => { list.splice(idx, 1); });
    toast('Task deleted', 'Undo', () => {
      update(() => { ensureWeek(key).splice(Math.min(idx, ensureWeek(key).length), 0, removed); });
    });
  }

  // If a manual edit put a task in the past (current week), apply the shift rule right away.
  function afterManualChange() {
    if (viewOffset !== 0) return;
    const moved = shiftOverdue();
    if (moved) {
      update(() => {});
      toast('That time already passed — moved to the next day');
    }
  }

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ---------- Task modal ----------
  const taskModal = $('#taskModal');

  function openTaskModal({ id = null, day = null } = {}) {
    const key = viewWeekKey();
    const isCurrent = viewOffset === 0;
    const todayIdx = new Date().getDay();
    const t = id ? findTask(id, key) : null;
    editing = t ? { id: t.id, weekKey: key } : null;

    let defaultDay = day ?? (isCurrent ? todayIdx : 1);
    if (isCurrent && defaultDay < todayIdx) defaultDay = todayIdx;

    form = t
      ? { day: t.day, status: t.status, cat: t.cat, priority: t.priority }
      : { day: defaultDay, status: 'create', cat: ui.filter.length === 1 ? ui.filter[0] : state.categories[0].id, priority: 3 };
    if (!state.categories.some((c) => c.id === form.cat)) form.cat = state.categories[0].id;

    $('#modalTitle').textContent = t ? 'Edit task' : 'New task';
    $('#saveBtn').textContent = t ? 'Save changes' : 'Add task';
    $('#deleteBtn').hidden = !t;
    $('#fTitle').value = t ? t.title : '';
    $('#fTime').value = t ? t.time || '' : '';
    $('#fLocation').value = t ? t.location || '' : '';
    $('#fNotes').value = t ? t.notes || '' : '';
    $('#titleError').textContent = '';
    $('#timeError').textContent = '';

    // Day picker — past days of the current week are locked
    const weekStart = viewWeekStart();
    $('#fDays').innerHTML = DAY_NAMES.map((n, i) => {
      const locked = isCurrent && i < todayIdx && !(t && t.day === i);
      return `<button type="button" role="radio" data-v="${i}" ${locked ? 'disabled' : ''}>${n.slice(0, 3)}<small>${addDays(weekStart, i).getDate()}</small></button>`;
    }).join('');
    $('#fStatus').innerHTML = STATUSES.map((s) => `<button type="button" role="radio" data-v="${s.id}">${s.label}</button>`).join('');
    $('#fCats').innerHTML = state.categories.map((c) =>
      `<button type="button" role="radio" data-v="${esc(c.id)}" style="--c:${esc(c.color)}"><i></i>${esc(c.name)}</button>`).join('');
    $('#fPrio').innerHTML = [1, 2, 3, 4, 5].map((p) =>
      `<button type="button" role="radio" data-v="${p}"><b>${p}</b><small>${PRIORITY_LABELS[p]}</small></button>`).join('');
    syncPickers();

    taskModal.showModal();
    requestAnimationFrame(() => $('#fTitle').focus());
  }

  function syncPickers() {
    const map = { fDays: 'day', fStatus: 'status', fCats: 'cat', fPrio: 'priority' };
    Object.entries(map).forEach(([el, field]) => {
      $$(`#${el} button`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(form[field]))));
    });
  }

  ['fDays', 'fStatus', 'fCats', 'fPrio'].forEach((el) => {
    const field = { fDays: 'day', fStatus: 'status', fCats: 'cat', fPrio: 'priority' }[el];
    $('#' + el).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      form[field] = field === 'day' || field === 'priority' ? Number(b.dataset.v) : b.dataset.v;
      syncPickers();
      if (field === 'day') $('#timeError').textContent = '';
    });
  });

  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#fTitle').value.trim();
    const time = $('#fTime').value;
    const data = {
      title,
      day: form.day,
      time,
      status: form.status,
      cat: form.cat,
      priority: form.priority,
      location: $('#fLocation').value.trim(),
      notes: $('#fNotes').value.trim(),
    };

    if (!title) {
      $('#titleError').textContent = 'Give your task a name.';
      $('#fTitle').focus();
      return;
    }

    const key = viewWeekKey();
    const existing = editing ? findTask(editing.id, editing.weekKey) : null;
    const whenChanged = !existing || existing.day !== data.day || (existing.time || '') !== data.time;
    if (viewOffset === 0 && whenChanged && data.status !== 'done' && data.time) {
      if (dueDate(key, data) < new Date()) {
        $('#timeError').textContent = 'That time has already passed — pick a later time or another day.';
        $('#fTime').focus();
        return;
      }
    }

    taskModal.close();
    update(() => {
      if (existing) {
        if (existing.day !== data.day) delete existing.originalDay;
        Object.assign(existing, data);
      } else {
        ensureWeek(key).push({ id: uid(), createdAt: Date.now(), ...data });
      }
    });
    if (!existing) {
      toast(`Added to ${DAY_NAMES[data.day]}`);
      setTimeout(() => {
        const el = document.getElementById('day-' + data.day);
        if (el && !isInView(el)) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }, 60);
    }
  });

  $('#deleteBtn').addEventListener('click', () => {
    if (!editing) return;
    const id = editing.id;
    taskModal.close();
    deleteTask(id);
  });

  const isInView = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight * 0.7; };

  // Close buttons + click on backdrop
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach((d) => d.addEventListener('mousedown', (e) => { if (e.target === d) d.close(); }));

  // ---------- Categories modal ----------
  const catModal = $('#catModal');

  function renderCatList() {
    const counts = {};
    Object.values(state.weeks).flat().forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    $('#catList').innerHTML = state.categories.map((c) => `
      <li data-cat="${esc(c.id)}">
        <input type="color" value="${esc(c.color)}" data-cat-color aria-label="${esc(c.name)} color" />
        <input type="text" value="${esc(c.name)}" maxlength="30" data-cat-name aria-label="Category name" />
        <span class="uses">${counts[c.id] ? counts[c.id] + ' task' + (counts[c.id] === 1 ? '' : 's') : ''}</span>
        <button type="button" class="icon-btn" data-cat-del title="Delete category" aria-label="Delete ${esc(c.name)}" ${state.categories.length <= 1 ? 'disabled' : ''}>${ICONS.trash}</button>
      </li>`).join('');
  }

  $('#catBtn').addEventListener('click', () => { renderCatList(); catModal.showModal(); });

  $('#catList').addEventListener('input', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const c = state.categories.find((x) => x.id === li.dataset.cat);
    if (!c) return;
    if (e.target.matches('[data-cat-color]')) c.color = e.target.value;
    if (e.target.matches('[data-cat-name]')) c.name = e.target.value.trim() || c.name;
    save();
    render();
  });

  $('#catList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat-del]');
    if (!btn || state.categories.length <= 1) return;
    const id = btn.closest('li').dataset.cat;
    const idx = state.categories.findIndex((c) => c.id === id);
    const [removed] = state.categories.splice(idx, 1);
    const fallback = state.categories.find((c) => c.id === 'misc') || state.categories[0];
    let reassigned = 0;
    Object.values(state.weeks).flat().forEach((t) => { if (t.cat === id) { t.cat = fallback.id; reassigned++; } });
    ui.filter = ui.filter.filter((f) => f !== id);
    save(); saveUI(); renderCatList(); render();
    toast(reassigned ? `Deleted “${removed.name}” — ${reassigned} task${reassigned === 1 ? '' : 's'} moved to ${fallback.name}` : `Deleted “${removed.name}”`);
  });

  $('#catAddForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#newCatName').value.trim();
    if (!name) { $('#newCatName').focus(); return; }
    state.categories.push({ id: 'c' + uid(), name, color: $('#newCatColor').value });
    $('#newCatName').value = '';
    save(); renderCatList(); render();
  });

  // ---------- Board interactions ----------
  const board = $('#board');

  board.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    if (e.target.closest('a')) return; // location link
    if (e.target.closest('[data-show-past]')) { ui.showPast = true; saveUI(); update(() => {}); return; }
    const adv = e.target.closest('[data-advance]');
    if (adv) { e.stopPropagation(); advanceTask(adv.dataset.advance); return; }
    const add = e.target.closest('[data-add]');
    if (add) { openTaskModal({ day: Number(add.dataset.add) }); return; }
    const card = e.target.closest('.card');
    if (card) openTaskModal({ id: card.dataset.id });
  });

  board.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openTaskModal({ id: card.dataset.id });
    }
  });

  // Drag & drop — between columns and between days
  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    draggingId = card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggingId);
    requestAnimationFrame(() => card.classList.add('dragging'));
    document.body.classList.add('is-dragging');
  });
  board.addEventListener('dragend', () => {
    draggingId = null;
    document.body.classList.remove('is-dragging');
    $$('.dragging').forEach((c) => c.classList.remove('dragging'));
    $$('.over').forEach((z) => z.classList.remove('over'));
  });
  board.addEventListener('dragover', (e) => {
    const zone = e.target.closest('[data-drop]');
    if (!zone || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!zone.classList.contains('over')) {
      $$('.over').forEach((z) => z.classList.remove('over'));
      zone.classList.add('over');
    }
  });
  board.addEventListener('dragleave', (e) => {
    const zone = e.target.closest('[data-drop]');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('over');
  });
  board.addEventListener('drop', (e) => {
    const zone = e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    zone.classList.remove('over');
    moveTask(id, Number(zone.dataset.day), zone.dataset.status);
  });

  // ---------- Touch drag & drop (phones / tablets) ----------
  // Press and hold a card (~0.35s) to pick it up, then drag it to any column
  // or day. The page auto-scrolls near the screen edges, and a day's columns
  // scroll sideways when you drag toward their left/right edge.
  let touch = null;
  let suppressClick = false;
  const LONG_PRESS_MS = 350;
  const MOVE_TOLERANCE = 10;

  board.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || touch) return;
    const card = e.target.closest('.card');
    if (!card || e.target.closest('[data-advance], a')) return;
    const p = e.touches[0];
    touch = { id: card.dataset.id, card, startX: p.clientX, startY: p.clientY, x: p.clientX, y: p.clientY, active: false, zone: null };
    card.classList.add('lifting');
    touch.timer = setTimeout(startTouchDrag, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!touch) return;
    const p = e.touches[0];
    touch.x = p.clientX;
    touch.y = p.clientY;
    if (!touch.active) {
      // Finger moved before the long-press finished → it's a scroll, not a drag.
      if (Math.hypot(touch.x - touch.startX, touch.y - touch.startY) > MOVE_TOLERANCE) cancelTouch();
      return;
    }
    if (e.cancelable) e.preventDefault(); // stop the page from scrolling while dragging
    positionGhost();
    updateTouchZone();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (!touch) return;
    if (!touch.active) { cancelTouch(); return; }
    if (e.cancelable) e.preventDefault();
    const { id, zone } = touch;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400);
    cleanupTouch();
    if (zone) moveTask(id, Number(zone.dataset.day), zone.dataset.status);
  }, { passive: false });

  document.addEventListener('touchcancel', () => cancelTouch());
  board.addEventListener('contextmenu', (e) => { if (touch) e.preventDefault(); });

  function startTouchDrag() {
    if (!touch) return;
    const { card } = touch;
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.remove('lifting');
    ghost.classList.add('drag-ghost');
    ghost.style.viewTransitionName = 'none';
    ghost.style.width = r.width + 'px';
    document.body.appendChild(ghost);
    Object.assign(touch, { active: true, ghost, offX: touch.x - r.left, offY: touch.y - r.top });
    card.classList.remove('lifting');
    card.classList.add('dragging');
    document.body.classList.add('is-dragging');
    draggingId = touch.id;
    if (navigator.vibrate) navigator.vibrate(12);
    positionGhost();
    updateTouchZone();
    requestAnimationFrame(autoScroll);
  }

  function positionGhost() {
    if (!touch?.ghost) return;
    touch.ghost.style.transform = `translate(${touch.x - touch.offX}px, ${touch.y - touch.offY}px) rotate(2deg) scale(1.03)`;
  }

  function updateTouchZone() {
    const el = document.elementFromPoint(touch.x, touch.y);
    const zone = el ? el.closest('[data-drop]') : null;
    if (zone === touch.zone) return;
    touch.zone?.classList.remove('over');
    zone?.classList.add('over');
    touch.zone = zone;
  }

  function autoScroll() {
    if (!touch?.active) return;
    const topLimit = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 65) +
                     (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--strip-h')) || 80) + 30;
    const bottomLimit = window.innerHeight - 90;
    let dy = 0;
    if (touch.y < topLimit) dy = -Math.min(18, (topLimit - touch.y) / 3 + 4);
    else if (touch.y > bottomLimit) dy = Math.min(18, (touch.y - bottomLimit) / 3 + 4);
    if (dy) window.scrollBy(0, dy);

    const el = document.elementFromPoint(touch.x, touch.y);
    const cols = el ? el.closest('.cols') : null;
    if (cols && cols.scrollWidth > cols.clientWidth) {
      const r = cols.getBoundingClientRect();
      if (touch.x < r.left + 44) cols.scrollLeft -= 10;
      else if (touch.x > r.right - 44) cols.scrollLeft += 10;
    }
    updateTouchZone();
    requestAnimationFrame(autoScroll);
  }

  function cleanupTouch() {
    if (!touch) return;
    clearTimeout(touch.timer);
    touch.ghost?.remove();
    touch.zone?.classList.remove('over');
    touch.card.classList.remove('dragging', 'lifting');
    document.body.classList.remove('is-dragging');
    draggingId = null;
    touch = null;
  }
  function cancelTouch() { cleanupTouch(); }

  // Keep sticky bars and scroll targets aligned as the header changes size
  function measureBars() {
    const root = document.documentElement.style;
    root.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px');
    root.setProperty('--strip-h', $('#daystrip').offsetHeight + 'px');
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measureBars);
    ro.observe($('.topbar'));
    ro.observe($('#daystrip'));
  }
  window.addEventListener('resize', measureBars);

  // ---------- Top-level controls ----------
  function goToWeek(offset) {
    const next = Math.max(0, Math.min(MAX_WEEKS_AHEAD, offset));
    if (next === viewOffset) return;
    viewOffset = next;
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(render);
    else render();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  $('#prevWeek').addEventListener('click', () => goToWeek(viewOffset - 1));
  $('#nextWeek').addEventListener('click', () => goToWeek(viewOffset + 1));
  $('#todayBtn').addEventListener('click', () => goToWeek(0));
  $('#newTaskBtn').addEventListener('click', () => openTaskModal());
  $('#fab').addEventListener('click', () => openTaskModal());

  $('#pastToggle').addEventListener('click', () => {
    ui.showPast = !ui.showPast;
    saveUI();
    update(() => {});
  });

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    const id = b.dataset.filter;
    if (id === 'all') ui.filter = [];
    else ui.filter = ui.filter.includes(id) ? ui.filter.filter((f) => f !== id) : [...ui.filter, id];
    saveUI();
    update(() => {});
  });

  $('#daystrip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    const i = Number(b.dataset.jump);
    const isPast = viewOffset === 0 && i < new Date().getDay();
    if (isPast && !ui.showPast) { ui.showPast = true; saveUI(); render(); }
    document.getElementById('day-' + i)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTaskModal(); }
    else if (e.key === 'ArrowRight' && e.shiftKey) goToWeek(viewOffset + 1);
    else if (e.key === 'ArrowLeft' && e.shiftKey) goToWeek(viewOffset - 1);
  });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    const btn = $('#toastAction');
    $('#toastText').textContent = msg;
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    btn.onclick = action ? () => { el.classList.remove('show'); action(); } : null;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), actionLabel ? 6000 : 3200);
  }

  // ---------- Clock tick ----------
  function tick() {
    renderCountdown();
    if (draggingId) return;
    const rolled = checkRollover();
    const moved = shiftOverdue();
    if (rolled) toast('New week, clean slate ✨');
    else if (moved) toast(`${moved} unfinished task${moved === 1 ? '' : 's'} moved to the next day`);
    if (rolled || moved) update(() => {});
    else if (signature() !== lastSig) render();
  }

  // Keep multiple open tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = loadState(); render(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  // ---------- Boot ----------
  checkRollover();
  measureBars();
  const movedOnLoad = shiftOverdue();
  render();
  if (movedOnLoad) toast(`${movedOnLoad} unfinished task${movedOnLoad === 1 ? '' : 's'} moved to the next day`);
  setInterval(tick, 20000);
  // Also fire exactly at Saturday midnight so the reset is instant
  (function scheduleReset() {
    const ms = addDays(startOfWeek(new Date()), 7) - new Date();
    setTimeout(() => { tick(); scheduleReset(); }, Math.min(ms + 500, 2 ** 31 - 1));
  })();
})();
