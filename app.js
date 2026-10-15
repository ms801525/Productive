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

  // ---------- Anti-framing ----------
  // Stop other websites from loading the planner inside a frame (clickjacking).
  if (window.top !== window.self) {
    // Shown inside another website's frame: remove everything and offer only a link
    // that opens the real page in its own tab, so nothing can be click-jacked.
    document.body.innerHTML = '';
    const a = document.createElement('a');
    a.href = window.location.href;
    a.target = '_top';
    a.rel = 'noopener';
    a.textContent = 'Open Productive in its own tab';
    a.setAttribute('style', 'display:block;margin:40px auto;max-width:320px;padding:14px 20px;border-radius:999px;background:#d6ff3d;color:#0c0d11;font:600 16px system-ui,sans-serif;text-align:center;text-decoration:none');
    document.body.appendChild(a);
    return;
  }

  // ---------- Error safety net ----------
  // If anything in the app breaks, the error is saved on this device (last 10)
  // and the user is taken to the friendly error page (404.html?type=error),
  // where they can report it, back up their tasks, or reload.
  const ERROR_LOG_KEY = 'productive.errors.v1';
  let fatalShown = false;
  function reportFatal(err, source) {
    if (fatalShown) return;
    fatalShown = true;
    try {
      const log = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
      log.unshift({
        at: new Date().toISOString(),
        source,
        message: String((err && err.message) || err || 'Unknown error').slice(0, 300),
        stack: String((err && err.stack) || '').slice(0, 1200),
        page: location.pathname,
        browser: navigator.userAgent,
      });
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log.slice(0, 10)));
    } catch (_) { /* storage unavailable — still show the page */ }
    try { console.error('[Productive] fatal error:', err); } catch (_) {}
    location.replace('404.html?type=error');
  }
  window.addEventListener('error', (e) => {
    // Ignore failed images/fonts and errors from browser extensions or other scripts.
    if (!e.error && !e.message) return;
    if (e.filename && !/app\.js/.test(e.filename)) return;
    reportFatal(e.error || e.message, 'error');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && (r.name === 'AbortError' || r.name === 'InvalidStateError')) return; // skipped animations, not real errors
    reportFatal(r, 'promise');
  });

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
    bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    shift: '<svg viewBox="0 0 24 24"><path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
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
    return { version: 1, activeWeek: currentWeekKey(), categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), weeks: {}, routines: [] };
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === 'object' && s.weeks && typeof s.weeks === 'object' && Array.isArray(s.categories)) return sanitize(s);
    } catch (_) { /* ignore corrupt data */ }
    return freshState();
  }
  // ---------- Limits (keep the app fast and stop it being flooded) ----------
  const LIMITS = { title: 120, location: 160, notes: 2000, catName: 30, categories: 30, tasksPerWeek: 300, weeks: 60, routines: 50 };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const REMIND_MIN = 15;   // reminders pop up this many minutes before a task's time
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;   // ids are written into the page, so only these characters are allowed
  const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, n);

  // Rebuilds saved data from scratch using only known fields and valid values.
  // Anything malformed or tampered with (hand-edited storage, odd characters,
  // oversized data) is repaired or dropped, so it can't break or hijack the page.
  function sanitize(s) {
    const okDay = (d) => Number.isInteger(d) && d >= 0 && d <= 6;
    const cats = [];
    const catIds = new Set();
    for (const c of Array.isArray(s.categories) ? s.categories : []) {
      if (!c || typeof c.id !== 'string' || !SAFE_ID.test(c.id) || catIds.has(c.id)) continue;
      const name = clip(c.name, LIMITS.catName).trim();
      if (!name) continue;
      catIds.add(c.id);
      cats.push({ id: c.id, name, color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8D92A1' });
      if (cats.length >= LIMITS.categories) break;
    }
    const weeks = {};
    const seenTasks = new Set();
    const weekKeys = Object.keys(s.weeks && typeof s.weeks === 'object' ? s.weeks : {})
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(s.weeks[k]))
      .sort().slice(0, LIMITS.weeks);
    for (const key of weekKeys) {
      const list = [];
      for (const t of s.weeks[key]) {
        if (!t || typeof t !== 'object' || !okDay(t.day)) continue;
        let id = typeof t.id === 'string' && SAFE_ID.test(t.id) ? t.id : uid();
        if (seenTasks.has(id)) id = uid();
        seenTasks.add(id);
        const task = {
          id,
          title: clip(t.title, LIMITS.title).trim() || 'Untitled task',
          day: t.day,
          time: /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time || '') ? t.time : '',
          status: ['create', 'progress', 'done'].includes(t.status) ? t.status : 'create',
          cat: typeof t.cat === 'string' && SAFE_ID.test(t.cat) ? t.cat : 'misc',
          priority: [1, 2, 3, 4, 5].includes(t.priority) ? t.priority : 3,
          location: clip(t.location, LIMITS.location),
          notes: clip(t.notes, LIMITS.notes),
          createdAt: Number.isFinite(Number(t.createdAt)) ? Number(t.createdAt) : 0,
        };
        if (okDay(t.originalDay)) task.originalDay = t.originalDay;
        if (typeof t.routineId === 'string' && SAFE_ID.test(t.routineId)) task.routineId = t.routineId;
        if (t.remind === true && task.time) task.remind = true;
        if (Number.isFinite(t.remindedFor)) task.remindedFor = t.remindedFor;
        list.push(task);
        if (list.length >= LIMITS.tasksPerWeek) break;
      }
      weeks[key] = list;
    }
    // Repeating tasks: templates that are added to every new week
    const routines = [];
    const rIds = new Set();
    for (const r of Array.isArray(s.routines) ? s.routines : []) {
      if (!r || typeof r.id !== 'string' || !SAFE_ID.test(r.id) || rIds.has(r.id) || !okDay(r.day)) continue;
      const title = clip(r.title, LIMITS.title).trim();
      if (!title) continue;
      rIds.add(r.id);
      routines.push({
        id: r.id,
        title,
        day: r.day,
        time: TIME_RE.test(r.time || '') ? r.time : '',
        cat: typeof r.cat === 'string' && SAFE_ID.test(r.cat) ? r.cat : 'misc',
        priority: [1, 2, 3, 4, 5].includes(r.priority) ? r.priority : 3,
        location: clip(r.location, LIMITS.location),
        notes: clip(r.notes, LIMITS.notes),
        remind: r.remind === true && TIME_RE.test(r.time || ''),
        since: typeof r.since === 'string' && DATE_RE.test(r.since) ? r.since : '',
        skip: (Array.isArray(r.skip) ? r.skip : []).filter((k) => typeof k === 'string' && DATE_RE.test(k)).slice(-60),
      });
      if (routines.length >= LIMITS.routines) break;
    }
    // Last week's summary (numbers only, shown once on Sunday)
    const lw = s.lastWeek;
    const lastWeek = lw && typeof lw === 'object' && typeof lw.week === 'string' && DATE_RE.test(lw.week)
      && Number.isInteger(lw.total) && lw.total > 0 && lw.total <= LIMITS.tasksPerWeek
      && Number.isInteger(lw.done) && lw.done >= 0 && lw.done <= lw.total
      ? { week: lw.week, total: lw.total, done: lw.done, top: clip(lw.top, LIMITS.catName) } : null;

    s.categories = cats.length ? cats : DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    s.weeks = weeks;
    s.routines = routines;
    if (lastWeek) s.lastWeek = lastWeek; else delete s.lastWeek;
    s.version = 1;
    s.activeWeek = typeof s.activeWeek === 'string' && DATE_RE.test(s.activeWeek) ? s.activeWeek : '';
    for (const k of Object.keys(s)) if (!['version', 'activeWeek', 'categories', 'weeks', 'routines', 'lastWeek'].includes(k)) delete s[k];
    return s;
  }

  function loadUI() {
    const out = { filter: [], showPast: false, welcomeDismissed: false };
    try {
      const u = JSON.parse(localStorage.getItem(UI_KEY)) || {};
      if (Array.isArray(u.filter)) out.filter = u.filter.filter((f) => typeof f === 'string' && SAFE_ID.test(f)).slice(0, LIMITS.categories);
      out.showPast = u.showPast === true;
      out.welcomeDismissed = u.welcomeDismissed === true;
      if (typeof u.reviewSeen === 'string' && DATE_RE.test(u.reviewSeen)) out.reviewSeen = u.reviewSeen;
      if (typeof u.satDismissed === 'string' && DATE_RE.test(u.satDismissed)) out.satDismissed = u.satDismissed;
    } catch (_) { /* use defaults */ }
    return out;
  }
  // Saving problems are shown once as a clear notice instead of a toast on every action.
  let storageProblem = null;     // null | 'blocked' | 'full'
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      if (storageProblem) { storageProblem = null; renderNotices(); }
    } catch (err) {
      const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      const kind = full ? 'full' : 'blocked';
      if (storageProblem !== kind) { storageProblem = kind; renderNotices(); }
    }
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
  // Readable text color for a category tag: starts from the category color and
  // lightens it until it has at least 4.6:1 contrast on its tinted background.
  const catTextCache = new Map();
  function catTextColor(hex) {
    if (catTextCache.has(hex)) return catTextCache.get(hex);
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
    const c = /^#[0-9a-f]{6}$/i.test(hex) ? rgb(hex) : [141, 146, 161];
    const bg = mix([26, 29, 37], c, 0.16);           // tag background on a card (ink-3 + 16% color)
    let out = c, t = 0;
    while (ratio(out, bg) < 4.6 && t < 1) { t += 0.05; out = mix(c, [255, 255, 255], t); }
    const css = `rgb(${out.join(',')})`;
    catTextCache.set(hex, css);
    return css;
  }

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
    // Keep a tiny summary (numbers only) of the week that just ended, for the "week in review" card
    const prev = hadPrevious && state.weeks[state.activeWeek];
    if (prev && prev.length && state.activeWeek < key) {
      const doneTasks = prev.filter((t) => t.status === 'done');
      const counts = {};
      doneTasks.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
      const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      state.lastWeek = { week: state.activeWeek, total: prev.length, done: doneTasks.length, top: topId ? catById(topId).name : '' };
    } else if (hadPrevious) {
      delete state.lastWeek;
    }
    Object.keys(state.weeks).forEach((k) => { if (k < key) delete state.weeks[k]; });
    state.routines.forEach((r) => { r.skip = r.skip.filter((k) => k >= key); });
    state.activeWeek = key;
    save();
    if (viewOffset > 0) viewOffset = Math.max(0, viewOffset - 1);
    return hadPrevious;
  }

  // ---------- Repeating tasks ----------
  // Each repeating task is a template. Every week from the current one onward
  // gets one copy of it on its day, unless that week's copy was deleted (skip).
  const routineById = (id) => state.routines.find((r) => r.id === id);
  function ensureRoutines(key) {
    if (!state.routines.length || key < currentWeekKey()) return false;
    const isCurrent = key === currentWeekKey();
    const now = new Date();
    let added = false;
    for (const r of state.routines) {
      if (r.skip.includes(key) || (r.since && key < r.since)) continue;
      // Don't add a copy whose time has already passed (e.g. first visit mid-week),
      // so routines missed while you were away don't pile up as overdue tasks.
      if (isCurrent && dueDate(key, r) < now) continue;
      const tasks = state.weeks[key] || [];
      if (tasks.some((t) => t.routineId === r.id)) continue;
      if (tasks.length >= LIMITS.tasksPerWeek) break;
      (state.weeks[key] ||= []).push({
        id: uid(), routineId: r.id, title: r.title, day: r.day, time: r.time, status: 'create',
        cat: r.cat, priority: r.priority, location: r.location, notes: r.notes, createdAt: Date.now(),
        ...(r.remind ? { remind: true } : {}),
      });
      added = true;
    }
    return added;
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
    if (document.startViewTransition && !reduceMotion) animate(render);
    else render();
  }

  // Runs a DOM update inside a View Transition. Skipped animations are ignored;
  // a real error inside the update goes to the error page.
  function animate(fn) {
    const t = document.startViewTransition(fn);
    t.updateCallbackDone.catch((err) => reportFatal(err, 'render'));
    t.ready.catch(() => {});
    t.finished.catch(() => {});
  }

  // ---------- Rendering ----------
  function render() {
    const weekStart = viewWeekStart();
    const key = dateKey(weekStart);
    if (ensureRoutines(key)) {
      if (key === currentWeekKey()) shiftOverdue();
      save();
    }
    const tasks = weekTasks(key);
    const isCurrent = viewOffset === 0;
    const todayIdx = new Date().getDay();

    renderHeader(weekStart);
    renderSummary(tasks, isCurrent);
    renderFilters();
    renderStrip(weekStart, tasks, isCurrent, todayIdx);
    renderBoard(weekStart, key, tasks, isCurrent, todayIdx);
    renderCountdown();
    renderWelcome();
    renderNotices();
    lastSig = signature();
  }

  function renderHeader(weekStart) {
    const end = addDays(weekStart, 6);
    // "Oct 11 – 17" within one month, "Sep 27 – Oct 3" across months (keeps it short on phones)
    $('#weekRange').textContent = weekStart.getMonth() === end.getMonth()
      ? `${fmtShort(weekStart)} – ${end.getDate()}`
      : `${fmtShort(weekStart)} – ${fmtShort(end)}`;
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
      ).join('') +
      `<button class="filter filter-new" data-new-cat title="Create your own category" aria-label="Create a new category">+ New<span class="fn-long"> category</span></button>`;
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
    if (t.remind && t.time && t.status !== 'done') meta.push(`<span class="remind" title="Reminder ${REMIND_MIN} minutes before">${ICONS.bell}Reminder</span>`);
    if (t.location) {
      const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.location);
      meta.push(`<a href="${url}" target="_blank" rel="noopener" title="Open in Maps">${ICONS.pin}${esc(t.location)}</a>`);
    }
    if (t.originalDay != null && t.originalDay !== t.day && t.status !== 'done') {
      meta.push(`<span class="moved" title="Auto-moved because it wasn't finished in time">${ICONS.shift}from ${DAY_NAMES[t.originalDay].slice(0, 3)}</span>`);
    }
    if (t.routineId && routineById(t.routineId)) meta.push(`<span class="repeat" title="Repeats every ${DAY_NAMES[routineById(t.routineId).day]}">${ICONS.repeat}Weekly</span>`);
    if (overdue) meta.push(`<span class="overdue">${ICONS.alert}Overdue</span>`);

    const next = t.status === 'create' ? { icon: ICONS.arrow, label: 'Start (move to In progress)' }
      : t.status === 'progress' ? { icon: ICONS.check, label: 'Mark done' }
      : { icon: ICONS.undo, label: 'Reopen' };

    return `<article class="card ${t.status === 'done' ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}"
        ${CAN_NATIVE_DRAG ? 'draggable="true"' : ''} tabindex="0" data-id="${t.id}"
        style="--cat:${esc(cat.color)}; --cat-text:${catTextColor(cat.color)}; view-transition-name:${t.id}"
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
    const routine = removed.routineId ? routineById(removed.routineId) : null;
    update(() => {
      list.splice(idx, 1);
      if (routine && !routine.skip.includes(key)) routine.skip.push(key); // don't bring it back this week
    });
    const msg = routine ? `Removed from this week. It still repeats every ${DAY_NAMES[routine.day]}.` : 'Task deleted';
    toast(msg, 'Undo', () => {
      update(() => {
        ensureWeek(key).splice(Math.min(idx, ensureWeek(key).length), 0, removed);
        if (routine) routine.skip = routine.skip.filter((k) => k !== key);
      });
    });
  }

  // Stop a repeating task: remove the template and its untouched copies in later weeks.
  function stopRoutine(routineId, fromKey) {
    state.routines = state.routines.filter((r) => r.id !== routineId);
    for (const k of Object.keys(state.weeks)) {
      if (k <= fromKey) continue;
      state.weeks[k] = state.weeks[k].filter((x) => !(x.routineId === routineId && x.status === 'create'));
    }
  }

  // Move tasks to the same day next week (used by the task window and the Saturday notice).
  function moveToNextWeek(ids, key) {
    const nextKey = dateKey(addDays(parseKey(key), 7));
    const room = LIMITS.tasksPerWeek - weekTasks(nextKey).length;
    const list = weekTasks(key);
    const moving = list.filter((t) => ids.includes(t.id) && !t.routineId).slice(0, Math.max(0, room));
    if (!moving.length) return 0;
    state.weeks[key] = list.filter((t) => !moving.includes(t));
    for (const t of moving) {
      t.day = t.originalDay ?? t.day;   // back to the day it was planned for
      delete t.originalDay;
      ensureWeek(nextKey).push(t);
    }
    return moving.length;
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
    const routine = t && t.routineId ? routineById(t.routineId) : null;
    $('#fRepeat').checked = !!routine;
    $('#fRepeat').disabled = !routine && state.routines.length >= LIMITS.routines;
    // "Move to next week": for tasks that don't repeat (repeating ones come back on their own)
    $('#moveNextBtn').hidden = !t || !!routine || viewOffset >= MAX_WEEKS_AHEAD;
    $('#fTitle').value = t ? t.title : '';
    $('#fTime').value = t ? t.time || '' : '';
    $('#fLocation').value = t ? t.location || '' : '';
    $('#fNotes').value = t ? t.notes || '' : '';
    $('#fRemind').checked = !!(t && t.remind);
    syncRemind();
    $('#titleError').textContent = '';
    $('#timeError').textContent = '';

    // Day picker — past days of the current week are locked
    const weekStart = viewWeekStart();
    $('#fDays').innerHTML = DAY_NAMES.map((n, i) => {
      const locked = isCurrent && i < todayIdx && !(t && t.day === i);
      return `<button type="button" role="radio" data-v="${i}" ${locked ? 'disabled' : ''}>${n.slice(0, 3)}<small>${addDays(weekStart, i).getDate()}</small></button>`;
    }).join('');
    $('#fStatus').innerHTML = STATUSES.map((s) => `<button type="button" role="radio" data-v="${s.id}">${s.label}</button>`).join('');
    renderCatChips();
    closeCatCreate();
    $('#fPrio').innerHTML = [1, 2, 3, 4, 5].map((p) =>
      `<button type="button" role="radio" data-v="${p}"><b>${p}</b><small>${PRIORITY_LABELS[p]}</small></button>`).join('');
    syncPickers();
    updateRepeatHint();

    taskModal.showModal();
    requestAnimationFrame(() => $('#fTitle').focus());
  }

  function renderCatChips() {
    $('#fCats').innerHTML = state.categories.map((c) =>
      `<button type="button" role="radio" data-v="${esc(c.id)}" style="--c:${esc(c.color)}"><i></i>${esc(c.name)}</button>`).join('') +
      '<button type="button" class="cat-new" id="catNewBtn" aria-expanded="false">+ New category</button>';
  }

  // ---------- Create-your-own categories ----------
  const SWATCHES = ['#FF4D4F', '#FF9F1C', '#FFD60A', '#8AC926', '#2EC4B6', '#3A86FF', '#5E60CE', '#C04CFD', '#FF5D8F', '#A4A9B8'];
  const sameColor = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  // A color not used yet by any category, so new categories look distinct by default
  const nextFreeColor = () => SWATCHES.find((c) => !state.categories.some((k) => sameColor(k.color, c))) || SWATCHES[0];

  function renderSwatches(box, selected) {
    box.innerHTML = SWATCHES.map((c) =>
      `<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="Use color ${c}"></button>`).join('') +
      `<label class="swatch custom" title="Pick any color"><input type="color" aria-label="Pick any color" /><span aria-hidden="true">+</span></label>`;
    setSwatch(box, selected);
  }
  function setSwatch(box, color, fromPicker = false) {
    box.dataset.value = color;
    let preset = false;
    box.querySelectorAll('[data-color]').forEach((b) => {
      const on = !fromPicker && sameColor(b.dataset.color, color);
      preset ||= on;
      b.setAttribute('aria-pressed', String(on));
    });
    const custom = box.querySelector('.custom');
    custom.classList.toggle('is-on', !preset);
    custom.style.setProperty('--c', color);
    const input = custom.querySelector('input');
    if (input.value.toLowerCase() !== color.toLowerCase()) input.value = color;
  }
  function bindSwatches(box) {
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) setSwatch(box, b.dataset.color); });
    box.addEventListener('input', (e) => { if (e.target.type === 'color') setSwatch(box, e.target.value, true); });
  }

  function addCategory(rawName, color) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!name) return { error: 'Give your category a name.' };
    const dupe = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (dupe) return { error: `You already have a category called “${dupe.name}”.` };
    if (state.categories.length >= 30) return { error: 'You can have up to 30 categories. Delete one to add another.' };
    const cat = { id: 'c' + uid(), name, color: /^#[0-9a-f]{6}$/i.test(color) ? color : nextFreeColor() };
    state.categories.push(cat);
    save();
    return { cat };
  }

  // In the task window: "+ New category" → name + color → selected for this task
  function openCatCreate() {
    $('#catCreate').hidden = false;
    $('#catNewBtn')?.setAttribute('aria-expanded', 'true');
    $('#catNewBtn')?.classList.add('is-open');
    $('#newCatInline').value = '';
    $('#catCreateError').textContent = '';
    renderSwatches($('#inlineSwatches'), nextFreeColor());
    requestAnimationFrame(() => $('#newCatInline').focus());
  }
  function closeCatCreate() {
    $('#catCreate').hidden = true;
    $('#catNewBtn')?.setAttribute('aria-expanded', 'false');
    $('#catNewBtn')?.classList.remove('is-open');
  }
  function submitCatCreate() {
    const res = addCategory($('#newCatInline').value, $('#inlineSwatches').dataset.value);
    if (res.error) { $('#catCreateError').textContent = res.error; $('#newCatInline').focus(); return; }
    form.cat = res.cat.id;
    renderCatChips();
    syncPickers();
    closeCatCreate();
    render();
    toast(`Category “${res.cat.name}” added`);
  }
  bindSwatches($('#inlineSwatches'));
  $('#catCreateAdd').addEventListener('click', submitCatCreate);
  $('#catCreateCancel').addEventListener('click', closeCatCreate);
  $('#newCatInline').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitCatCreate(); }
  });

  function updateRepeatHint() {
    const full = $('#fRepeat').disabled;
    $('#repeatHint').textContent = full
      ? `You have ${LIMITS.routines} repeating tasks, the most allowed`
      : $('#fRepeat').checked
        ? `Comes back every ${DAY_NAMES[form.day]}, even after the weekly reset`
        : 'Turn on to have it come back every week on the same day';
  }
  $('#fRepeat').addEventListener('change', updateRepeatHint);

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
      if (b.id === 'catNewBtn') { $('#catCreate').hidden ? openCatCreate() : closeCatCreate(); return; }
      form[field] = field === 'day' || field === 'priority' ? Number(b.dataset.v) : b.dataset.v;
      syncPickers();
      if (field === 'day') { $('#timeError').textContent = ''; updateRepeatHint(); }
    });
  });

  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = clip($('#fTitle').value, LIMITS.title).trim();
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test($('#fTime').value) ? $('#fTime').value : '';
    const data = {
      title,
      day: form.day,
      time,
      status: form.status,
      cat: form.cat,
      priority: form.priority,
      location: clip($('#fLocation').value, LIMITS.location).trim(),
      notes: clip($('#fNotes').value, LIMITS.notes).trim(),
    };
    data.remind = !!time && $('#fRemind').checked;

    if (!title) {
      $('#titleError').textContent = 'Give your task a name.';
      $('#fTitle').focus();
      return;
    }

    const key = viewWeekKey();
    const existing = editing ? findTask(editing.id, editing.weekKey) : null;
    if (!existing && weekTasks(key).length >= LIMITS.tasksPerWeek) {
      $('#titleError').textContent = `This week already has ${LIMITS.tasksPerWeek} tasks, the most it can hold. Finish or delete some first.`;
      return;
    }
    const whenChanged = !existing || existing.day !== data.day || (existing.time || '') !== data.time;
    if (viewOffset === 0 && whenChanged && data.status !== 'done' && data.time) {
      if (dueDate(key, data) < new Date()) {
        $('#timeError').textContent = 'That time has already passed — pick a later time or another day.';
        $('#fTime').focus();
        return;
      }
    }

    const wantRepeat = $('#fRepeat').checked && !$('#fRepeat').disabled;
    const hadRoutine = existing && existing.routineId ? routineById(existing.routineId) : null;
    taskModal.close();
    update(() => {
      let task = existing;
      if (task) {
        if (task.day !== data.day) delete task.originalDay;
        Object.assign(task, data);
      } else {
        task = { id: uid(), createdAt: Date.now(), ...data };
        ensureWeek(key).push(task);
      }
      if (!task.remind) delete task.remind;
      const tpl = { title: data.title, day: data.day, time: data.time, cat: data.cat, priority: data.priority, location: data.location, notes: data.notes, remind: data.remind };
      if (wantRepeat) {
        if (hadRoutine) {
          // Changing a repeating task updates its future weeks too
          Object.assign(hadRoutine, tpl);
          for (const k of Object.keys(state.weeks)) {
            if (k <= key) continue;
            state.weeks[k].forEach((x) => { if (x.routineId === hadRoutine.id && x.status === 'create') Object.assign(x, tpl); });
          }
        } else {
          const r = { id: 'r' + uid(), ...tpl, since: key, skip: [] };
          state.routines.push(r);
          task.routineId = r.id;
        }
      } else if (hadRoutine) {
        // "Repeat every week" turned off: stop repeating, keep this week's task
        stopRoutine(hadRoutine.id, key);
        delete task.routineId;
      }
    });
    afterManualChange();
    if (data.remind) askNotificationPermission();
    scheduleNextReminder();
    if (wantRepeat && !hadRoutine) toast(`Repeats every ${DAY_NAMES[data.day]}`);
    else if (!wantRepeat && hadRoutine) toast('Stopped repeating. This week’s task stays.');
    if (!existing) {
      if (!wantRepeat) toast(`Added to ${DAY_NAMES[data.day]}`);
      setTimeout(() => {
        const el = document.getElementById('day-' + data.day);
        if (el && !isInView(el)) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }, 60);
    }
  });

  $('#moveNextBtn').addEventListener('click', () => {
    if (!editing) return;
    const { id, weekKey } = editing;
    taskModal.close();
    let n = 0;
    update(() => { n = moveToNextWeek([id], weekKey); });
    if (n) toast('Moved to next week', 'View', () => goToWeek(viewOffset + 1));
    else toast('Next week is full. Delete some tasks there first.');
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

  function openCatModal(focusNew = false) {
    renderCatList();
    $('#newCatName').value = '';
    $('#catAddError').textContent = '';
    renderSwatches($('#modalSwatches'), nextFreeColor());
    catModal.showModal();
    if (focusNew) requestAnimationFrame(() => $('#newCatName').focus());
  }
  $('#catBtn').addEventListener('click', () => openCatModal());

  $('#catList').addEventListener('input', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const c = state.categories.find((x) => x.id === li.dataset.cat);
    if (!c) return;
    if (e.target.matches('[data-cat-color]')) c.color = e.target.value;
    if (e.target.matches('[data-cat-name]')) c.name = clip(e.target.value, LIMITS.catName).trim() || c.name;
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

  bindSwatches($('#modalSwatches'));
  $('#catAddForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = addCategory($('#newCatName').value, $('#modalSwatches').dataset.value);
    if (res.error) { $('#catAddError').textContent = res.error; $('#newCatName').focus(); return; }
    $('#catAddError').textContent = '';
    $('#newCatName').value = '';
    renderSwatches($('#modalSwatches'), nextFreeColor());
    renderCatList(); render();
    toast(`Category “${res.cat.name}” added`);
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
    if (document.startViewTransition && !reduceMotion) animate(render);
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
    if (e.target.closest('[data-new-cat]')) { openCatModal(true); return; }
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
    else if (e.key === '?') { e.preventDefault(); location.href = 'help.html'; }
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
    checkReminders();
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

  // ---------- Reminders ----------
  // Simple by design: tasks with "Remind me" on get one notification 15 minutes
  // before their time, while Productive is open (tab, pinned tab or home-screen app).
  // If notifications aren't allowed, a small pop-up shows inside the app instead.
  const remindAt = (key, t) => dueDate(key, t).getTime() - REMIND_MIN * 60000;

  function checkReminders() {
    const now = Date.now();
    const key = currentWeekKey();
    const due = weekTasks(key).filter((t) => {
      if (!t.remind || !t.time || t.status === 'done') return false;
      const at = remindAt(key, t);
      return now >= at && now < at + REMIND_MIN * 60000 && t.remindedFor !== at; // only while it's still coming up
    });
    if (!due.length) return;
    due.forEach((t) => { t.remindedFor = remindAt(key, t); });
    save();  // saved first, so another open tab won't remind twice
    due.forEach((t) => showReminder(key, t));
  }

  // Wake up right when the next reminder is due (the 20-second tick is the safety net)
  let reminderTimer = null;
  function scheduleNextReminder() {
    clearTimeout(reminderTimer);
    const now = Date.now();
    const key = currentWeekKey();
    const next = Math.min(...weekTasks(key)
      .filter((t) => t.remind && t.time && t.status !== 'done')
      .map((t) => remindAt(key, t)).filter((at) => at > now), Infinity);
    if (next !== Infinity) reminderTimer = setTimeout(() => { checkReminders(); scheduleNextReminder(); }, Math.min(next - now + 250, 2 ** 31 - 1));
  }

  function showReminder(key, t) {
    const mins = Math.max(0, Math.round((dueDate(key, t).getTime() - Date.now()) / 60000));
    const text = `Starts at ${fmtTime(t.time)}${mins ? ` (in ${mins} min)` : ''}${t.location ? ` · ${t.location}` : ''}`;
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body: text, tag: 'productive-' + t.id, icon: 'icons/icon-192.png' };
      const plain = () => { try { new Notification('⏰ ' + t.title, opts); } catch (_) { popInApp(t, text); } };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification('⏰ ' + t.title, opts)).catch(plain);
      } else plain();
      if (!document.hidden) popInApp(t, text);   // also show it on screen if they're looking at the app
    } else {
      popInApp(t, text);
    }
  }

  // Small in-app pop-up (used when notifications are off, or the app is on screen)
  function popInApp(t, text) {
    const box = $('#alerts');
    box.querySelector(`[data-alert="${t.id}"]`)?.remove();
    const card = document.createElement('div');
    card.className = 'alert-card';
    card.dataset.alert = t.id;
    card.style.setProperty('--cat', catById(t.cat).color);
    card.setAttribute('role', 'alert');
    card.innerHTML = `<span class="alert-bell">${ICONS.bell}</span>
      <div class="alert-body"><span class="alert-kicker">Coming up</span><b></b><span class="alert-when"></span></div>
      <button type="button" class="icon-btn alert-close" aria-label="Dismiss reminder">${ICONS.close}</button>`;
    card.querySelector('b').textContent = t.title;          // plain text only
    card.querySelector('.alert-when').textContent = text;
    box.prepend(card);
    const close = () => { card.classList.add('leaving'); setTimeout(() => card.remove(), 220); };
    card.querySelector('.alert-close').addEventListener('click', close);
    setTimeout(close, 60000);                                // tidies itself away after a minute
  }

  let permissionAsked = false;
  function askNotificationPermission() {
    if (permissionAsked || !('Notification' in window)) return;
    permissionAsked = true;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        if (p !== 'granted') toast('Notifications are off, so reminders will pop up inside Productive while it’s open.');
      }).catch(() => {});
    }
  }

  // Task window: "Remind me" only makes sense with a time
  function syncRemind() {
    const hasTime = TIME_RE.test($('#fTime').value);
    $('#fRemind').disabled = !hasTime;
    if (!hasTime) $('#fRemind').checked = false;
    $('#remindHint').textContent = hasTime
      ? `Optional · get a notification ${REMIND_MIN} minutes before`
      : 'Optional · add a time to use it';
  }
  $('#fTime').addEventListener('input', syncRemind);
  $('#fTime').addEventListener('change', syncRemind);

  // ---------- Notices: storage problems, Saturday heads-up, week in review ----------
  function noticeHTML(kind, icon, title, text, actions) {
    return `<div class="notice notice-${kind}" role="status">
      <span class="notice-icon">${icon}</span>
      <div class="notice-text"><b>${title}</b><span>${text}</span></div>
      <div class="notice-actions">${actions}</div>
    </div>`;
  }
  function renderNotices() {
    const box = $('#notices');
    if (!box) return;
    const out = [];
    const key = currentWeekKey();
    const now = new Date();

    if (storageProblem === 'blocked') {
      out.push(noticeHTML('warn', ICONS.alert, 'Your browser isn’t letting Productive save',
        'This usually means a private/incognito window or blocked site data. Your tasks will disappear when you close this tab.',
        '<a class="ghost-btn" href="help.html#trouble">How to fix</a>'));
    } else if (storageProblem === 'full') {
      out.push(noticeHTML('warn', ICONS.alert, 'Browser storage is full',
        'Your latest changes couldn’t be saved. Download a backup, then delete some tasks or free up space.',
        '<button type="button" class="ghost-btn" data-open-data>Your data</button>'));
    }

    if (viewOffset === 0) {
      // Saturday: warn before the reset and offer to carry unfinished tasks forward
      const unfinished = weekTasks(key).filter((t) => t.status !== 'done' && !t.routineId);
      if (now.getDay() === 6 && unfinished.length && ui.satDismissed !== key) {
        const n = unfinished.length;
        out.push(noticeHTML('sat', ICONS.clock, `The week resets tonight at midnight`,
          `${n} unfinished task${n === 1 ? '' : 's'} will be cleared. Want to keep ${n === 1 ? 'it' : 'them'} for next week?`,
          `<button type="button" class="primary-btn" data-move-unfinished>Move ${n} to next week</button>
           <button type="button" class="icon-btn" data-dismiss="sat" aria-label="Dismiss">${ICONS.close}</button>`));
      }
      // Sunday (or first visit of a new week): last week's summary
      const lw = state.lastWeek;
      if (lw && ui.reviewSeen !== lw.week) {
        const pct = Math.round((lw.done / lw.total) * 100);
        const msg = pct === 100 ? 'Everything done. Great week!' : pct >= 60 ? 'Solid week.' : 'New week, fresh start.';
        out.push(noticeHTML('review', ICONS.check, `Last week: ${lw.done} of ${lw.total} done (${pct}%)`,
          `${esc(msg)}${lw.top ? ` Most finished: ${esc(lw.top)}.` : ''} Everything from last week has been cleared.`,
          `<button type="button" class="icon-btn" data-dismiss="review" aria-label="Dismiss">${ICONS.close}</button>`));
      }
    }
    box.innerHTML = out.join('');
  }
  $('#notices').addEventListener('click', (e) => {
    if (e.target.closest('[data-open-data]')) { openDataModal(); return; }
    const d = e.target.closest('[data-dismiss]');
    if (d) {
      if (d.dataset.dismiss === 'sat') ui.satDismissed = currentWeekKey();
      if (d.dataset.dismiss === 'review' && state.lastWeek) ui.reviewSeen = state.lastWeek.week;
      saveUI();
      renderNotices();
      return;
    }
    if (e.target.closest('[data-move-unfinished]')) {
      const key = currentWeekKey();
      const ids = weekTasks(key).filter((t) => t.status !== 'done' && !t.routineId).map((t) => t.id);
      let n = 0;
      update(() => { n = moveToNextWeek(ids, key); });
      if (n) toast(`Moved ${n} task${n === 1 ? '' : 's'} to next week`, 'View', () => goToWeek(1));
      else toast('Next week is full. Delete some tasks there first.');
    }
  });

  // ---------- Your data: backup, restore, erase ----------
  const dataModal = $('#dataModal');
  function openDataModal() {
    $('#dataError').textContent = '';
    resetErase();
    let bytes = 0;
    try { bytes = (localStorage.getItem(STORE_KEY) || '').length * 2; } catch (_) {}
    const tasks = Object.values(state.weeks).reduce((n, w) => n + w.length, 0);
    $('#storageUsed').textContent = `Right now: ${tasks} task${tasks === 1 ? '' : 's'}, ${state.routines.length} repeating, about ${Math.max(1, Math.round(bytes / 1024))} KB.`;
    dataModal.showModal();
  }
  $('#dataBtn').addEventListener('click', openDataModal);

  $('#exportBtn').addEventListener('click', () => {
    const payload = JSON.stringify({ app: 'Productive', exportedAt: new Date().toISOString(), data: state }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    a.download = `productive-backup-${dateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Backup downloaded');
  });

  $('#importBtn').addEventListener('click', () => { $('#importFile').value = ''; $('#importFile').click(); });
  $('#importFile').addEventListener('change', async () => {
    const file = $('#importFile').files[0];
    if (!file) return;
    const fail = (m) => { $('#dataError').textContent = m; };
    if (file.size > 2 * 1024 * 1024) return fail('That file is too big to be a Productive backup (over 2 MB).');
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch (_) { return fail('That file isn’t a valid backup (couldn’t read it).'); }
    const raw = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!raw || typeof raw !== 'object' || !raw.weeks || typeof raw.weeks !== 'object' || !Array.isArray(raw.categories)) {
      return fail('That file isn’t a Productive backup.');
    }
    const clean = sanitize(JSON.parse(JSON.stringify(raw)));      // same strict checks as everything else
    const key = currentWeekKey();
    Object.keys(clean.weeks).forEach((k) => { if (k < key) delete clean.weeks[k]; });
    clean.activeWeek = key;
    delete clean.lastWeek;
    const count = Object.values(clean.weeks).reduce((n, w) => n + w.length, 0);
    dataModal.close();
    state = clean;
    viewOffset = 0;
    update(() => { shiftOverdue(); });
    toast(`Backup restored: ${count} task${count === 1 ? '' : 's'}, ${clean.routines.length} repeating`);
  });

  let eraseArmed = false, eraseTimer;
  function resetErase() {
    eraseArmed = false;
    clearTimeout(eraseTimer);
    $('#eraseBtn').classList.remove('armed');
    $('#eraseBtn').textContent = 'Erase';
  }
  $('#eraseBtn').addEventListener('click', () => {
    if (!eraseArmed) {
      eraseArmed = true;
      $('#eraseBtn').classList.add('armed');
      $('#eraseBtn').textContent = 'Tap again to erase';
      eraseTimer = setTimeout(resetErase, 5000);
      return;
    }
    resetErase();
    try { [STORE_KEY, UI_KEY, ERROR_LOG_KEY].forEach((k) => localStorage.removeItem(k)); } catch (_) {}
    state = freshState();
    ui = loadUI();
    viewOffset = 0;
    dataModal.close();
    update(() => {});
    toast('Everything was erased from this browser');
  });
  if (location.hash === '#data') openDataModal();
  if (new URLSearchParams(location.search).get('new') === '1') {
    history.replaceState(null, '', location.pathname);   // so a reload doesn't reopen it
    setTimeout(() => openTaskModal(), 300);
  }

  // ---------- Welcome banner (first visit) ----------
  // Shown until the user dismisses it or adds their first task, so the
  // how-to page is impossible to miss for new users.
  function renderWelcome() {
    const hasTasks = Object.values(state.weeks).some((w) => w.length);
    $('#welcome').hidden = !!ui.welcomeDismissed || hasTasks;
  }
  $('#welcomeClose').addEventListener('click', () => {
    ui.welcomeDismissed = true;
    saveUI();
    renderWelcome();
  });
  $('#year').textContent = new Date().getFullYear();

  // ---------- Bookmark tip (fits the visitor's device) ----------
  (function bookmarkTip() {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isMac = /Mac/.test(navigator.platform || '') || /Macintosh|Mac OS X/.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    let html;
    if (standalone) html = 'You\u2019ve added Productive to your home screen. Nice, it\u2019s always one tap away.';
    else if (isIOS) html = 'Tap <b>Share</b> \u2192 <b>Add to Home Screen</b> to open it like an app, or keep this tab open.';
    else if (isAndroid) html = 'Tap <b>\u22ee</b> \u2192 <b>Add to Home screen</b> to open it like an app, or keep this tab open.';
    else html = `Press <kbd class="kbd">${isMac ? '\u2318' : 'Ctrl'}</kbd> + <kbd class="kbd">D</kbd> to bookmark it, or keep it open in a pinned tab.`;
    $('#bookmarkHint').innerHTML = html;
  })();

  // ---------- Offline support ----------
  // A small service worker keeps a copy of the app's files so a bookmarked or
  // home-screen Productive still opens without internet. It always tries the
  // network first, so updates show up straight away when online.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // ---------- Boot ----------
  save(); // store the cleaned-up (sanitized) data right away, so tampered data doesn't linger
  checkRollover();
  measureBars();
  const movedOnLoad = shiftOverdue();
  render();
  if (movedOnLoad) toast(`${movedOnLoad} unfinished task${movedOnLoad === 1 ? '' : 's'} moved to the next day`);
  checkReminders();
  scheduleNextReminder();
  setInterval(tick, 20000);
  // Also fire exactly at Saturday midnight so the reset is instant
  (function scheduleReset() {
    const ms = addDays(startOfWeek(new Date()), 7) - new Date();
    setTimeout(() => { tick(); scheduleReset(); }, Math.min(ms + 500, 2 ** 31 - 1));
  })();
})();
