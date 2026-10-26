// Shared setup for the security tests: a tiny static file server for the app,
// one Chromium browser for the whole run, and helpers to load the planner with
// saved data that has been tampered with on purpose.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const STORE_KEY = 'productive.v1';
const UI_KEY = 'productive.ui.v1';
const ERROR_KEY = 'productive.errors.v1';

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function launch() {
  const opts = {};
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

// The week key the app uses: the date of this week's Sunday, as YYYY-MM-DD.
function thisWeekKey() {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

// A normal task on Saturday with no time, so the app never auto-shifts it.
function task(fields = {}) {
  return { id: 'task1', title: 'Normal task', day: 6, status: 'create', priority: 3, cat: 'work', notes: '', location: '', createdAt: 1, ...fields };
}

function state(fields = {}) {
  const key = thisWeekKey();
  return {
    version: 1, activeWeek: key, routines: [],
    categories: [{ id: 'work', name: 'Work', color: '#FF4D4F' }],
    weeks: { [key]: [task()] },
    ...fields,
  };
}

// Opens a page with localStorage pre-filled (raw strings, so broken JSON can be tested too).
// Runtime errors on the page are collected in page.errors.
async function openWithStorage(browser, base, storage, pathname = '/index.html') {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript((items) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, storage);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(base + pathname);
  await page.waitForLoadState('load');
  return page;
}

const openWithState = (browser, base, s) => openWithStorage(browser, base, { [STORE_KEY]: JSON.stringify(s) });

async function saved(page, key = STORE_KEY) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

const savedTasks = async (page) => (await saved(page)).weeks[thisWeekKey()];

module.exports = {
  ROOT, STORE_KEY, UI_KEY, ERROR_KEY,
  startServer, launch, thisWeekKey, task, state, openWithStorage, openWithState, saved, savedTasks,
};
