# productive. — Weekly Planner

A smooth, week-by-week task tracker built with plain HTML, CSS and JavaScript. Each week starts as a fresh, empty page. You plan the tasks you want to finish that week, move them through **Create → In progress → Done**, and at Saturday midnight the week resets for a clean start.

![Productive weekly planner — desktop](docs/screenshot-desktop.png)

---

## Table of contents
- [Features](#features)
- [Getting started](#getting-started)
- [How it works](#how-it-works)
  - [The weekly cycle](#the-weekly-cycle)
  - [Days and columns](#days-and-columns)
  - [Overdue tasks auto-shift](#overdue-tasks-auto-shift)
  - [Saving your data](#saving-your-data)
- [Using the app](#using-the-app)
  - [Creating a task](#creating-a-task)
  - [Moving tasks](#moving-tasks)
  - [Editing and deleting](#editing-and-deleting)
  - [Categories and colors](#categories-and-colors)
  - [Priority levels](#priority-levels)
  - [Filters and navigation](#filters-and-navigation)
  - [Keyboard shortcuts](#keyboard-shortcuts)
- [Using it on your phone](#using-it-on-your-phone)
- [Pages](#pages)
- [Error handling](#error-handling)
- [Contact form](#contact-form)
- [Accessibility & color contrast](#accessibility--color-contrast)
- [Security](#security)
- [Why there's no sign-in](#why-theres-no-sign-in)
- [Design](#design)
- [Project structure](#project-structure)
- [Technical details](#technical-details)
- [Browser support](#browser-support)
- [Limitations](#limitations)
- [Ideas for future versions](#ideas-for-future-versions)

---

## Features

| | |
|---|---|
| 🗓️ **Weekly pages** | Each week (Sunday → Saturday) is its own page. You can see the current week and any week ahead, but never the past. |
| 📋 **3 columns per day** | Every day has **Create**, **In progress** and **Done** columns. |
| 🎨 **Color-coded categories** | Work (red), Gym (orange), Miscellaneous (blue), Appointment (purple), Personal (teal), Study (yellow). Fully customizable. |
| 🔢 **Priority 1–5** | 1 is most urgent. Cards sort automatically by priority, then by time. |
| 📝 **Task details** | Optional time, location (opens in Google Maps) and notes on every task. |
| ↪️ **Auto-shift** | Unfinished tasks whose time has passed move to the next day at the same time, until the end of the week. |
| 💾 **Persistent** | Data survives page reloads and browser restarts, for the whole week. |
| 🔄 **Weekly reset** | At Saturday midnight the finished week is cleared and the new week starts empty. |
| 🖱️ **Drag & drop** | Drag cards between columns and between days, with a mouse or by press-and-hold on touch screens. |
| ❓ **How-to guide** | A full [how-to page](help.html) with a quick start, FAQ and troubleshooting. Reachable from the **How to** button in the top bar, the welcome banner, the footer, or the `?` key. |
| 🛟 **Friendly error page** | Missing pages and unexpected app errors show a clear page that tells people their tasks are safe, with one-tap problem reporting. |
| 🙌 **No account, no setup** | No sign-up or password. Open it and plan. Tasks save in the browser and reset every week. Bookmark it or keep it open in a tab. |
| ✉️ **Contact form** | A [contact page](contact.html) that opens the visitor's email app (or Gmail / Outlook / Yahoo Mail) with their message addressed and ready to send. No backend or third-party form service. |
| 🔒 **Privacy & Terms** | Plain-language [Privacy Policy](privacy.html) and [Terms of Use](terms.html) pages. |
| 📱 **Mobile friendly** | Built for phones too: swipeable columns, bottom-sheet forms, a floating + button, big tap targets, and it can be added to your home screen like an app. |
| ⚡ **No setup** | No frameworks, no build step, no install. Just open `index.html`. |

---

## Getting started

### Option 1 — Visual Studio Code with Live Server (recommended)
1. Clone or download this repository.
2. Open the folder in **Visual Studio Code**.
3. Install the **Live Server** extension (Extensions panel → search "Live Server" by Ritwick Dey).
4. Right-click `index.html` → **Open with Live Server**.
5. The app opens in your browser and reloads automatically when you edit the code.

### Option 2 — Open the file directly
Double-click `index.html` to open it in any modern browser.

### Option 3 — Host it free on GitHub Pages (to use it on your phone)
1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and click **Save**.
4. After a minute, your app is live at `https://<your-username>.github.io/<repo-name>/`.
5. Open that link on your phone and add it to your home screen (see [Using it on your phone](#using-it-on-your-phone)).

### Option 4 — Any static server
```bash
# Python
python3 -m http.server 8000
# then visit http://localhost:8000

# Node
npx serve .
```

---

## How it works

### The weekly cycle
- A week runs from **Sunday 00:00** to **Saturday 23:59**.
- When the app opens, it shows **this week**. Use the arrows at the top to look at **next week** and beyond (up to 52 weeks ahead). The "previous week" arrow is disabled on the current week, so past weeks can never be viewed.
- At **Saturday midnight** (the moment Saturday turns into Sunday):
  - The week that just ended is **permanently deleted**.
  - The new week becomes "This week".
  - If you already planned tasks for that new week, **they're kept**. Only past weeks are removed.
- A countdown in the top bar ("Week resets in 2d 14h 59m") shows how long is left before the reset.
- The reset happens even if the tab stays open overnight (a timer fires at midnight), and also when you open the app after being away.

### Days and columns
Each of the 7 days is shown as its own section with three columns:

| Column | Meaning |
|---|---|
| **Create** | Planned, not started yet |
| **In progress** | Currently working on it |
| **Done** | Finished (the title is shown crossed out) |

- **Today** is highlighted with a lime outline and a "Today" label.
- **Days already past** in the current week are folded into a single "Earlier this week" bar so the board stays focused on what's left. Click it (or "Show earlier days") to expand them. You can't add new tasks to past days.
- Each day header shows how many tasks it has and how many are done.
- The **day strip** under the filters gives a quick overview of the week (open tasks per day and colored category dots). Click a day to jump to it.

### Overdue tasks auto-shift
If a task isn't finished by its time, it moves **to the next day at the same time**. This repeats every day until **Saturday**, the end of the week.

**Rules**
- Only tasks in **Create** or **In progress** shift. **Done** tasks never move.
- A task **with a time** is overdue once that time passes (e.g. Tuesday 2:00 PM).
- A task **without a time** is overdue at the end of its day (midnight).
- If several days have passed, the task skips ahead to the first day where its time is still in the future.
- A shifted task shows a lime **"from Tue"** badge so you know where it started.
- On **Saturday** there's no next day, so an unfinished task stays on Saturday and gets a red **Overdue** badge. At midnight it's cleared with the rest of the week.
- If you manually drag or edit a task onto a day, the "from" badge resets.
- A toast message tells you when tasks were moved (e.g. "4 unfinished tasks moved to the next day").

**Example**

| Task | Originally | You open the app on… | It moves to |
|---|---|---|---|
| Dentist appointment | Tue 2:00 PM | Thu 9:00 AM | Thu 2:00 PM (from Tue) |
| Groceries (no time) | Wed | Thu 9:00 AM | Thu (from Wed) |
| Push day | Thu 7:00 AM | Thu 9:00 AM | Fri 7:00 AM (from Thu) |
| Sprint report | Fri 5:00 PM | Sat 11:30 PM | Sat 5:00 PM, marked **Overdue** |

The app checks for overdue tasks when it loads, every 20 seconds while open, and whenever you switch back to the tab.

### Saving your data
- Everything saves **automatically** to your browser's `localStorage`. There's no save button.
- Reloading the page, closing the tab or restarting the browser keeps all your tasks for the week.
- If the app is open in **multiple tabs**, they stay in sync.
- Your filter and "show earlier days" choices are remembered too.

---

## Using the app

### Creating a task
Click **New task** (or press **N**), the **+ Add** button on any day, or **Add a task** inside an empty Create column.

| Field | Required | Notes |
|---|---|---|
| **What needs doing?** | ✅ | The task title (up to 120 characters). |
| **Day** | ✅ | Sun–Sat of the week you're viewing. Past days of the current week are locked. |
| **Time** | Optional | Used for sorting and for the auto-shift rules. You can't pick a time that has already passed today. |
| **Status** | ✅ | Create, In progress or Done. Defaults to Create. |
| **Category** | ✅ | Pick a color-coded category. |
| **Priority** | ✅ | 1 (Urgent) to 5 (Someday). Defaults to 3. |
| **Location** | Optional | Great for appointments. On the card it becomes a link that opens Google Maps. |
| **Notes** | Optional | Details, links, things to bring (up to 2,000 characters). The first two lines show on the card. |

After you add a task, the board scrolls to that day and a confirmation appears.

### Moving tasks
- **Drag and drop** a card into another column, or into any column on another day.
- **On a phone or tablet:** press and hold a card for about a third of a second until it lifts, then drag it. The page scrolls automatically when you drag near the top or bottom of the screen, and a day's columns slide sideways when you drag toward the left or right edge. A quick swipe still scrolls normally.
- Click the **arrow button** on a card (it appears on hover, and is always visible on touch screens) to move it forward:
  - Create → In progress (→)
  - In progress → Done (✓)
  - Done → back to Create (↺)
- Or open the task and change its **Status** or **Day**.

### Editing and deleting
- Click (or press **Enter** on) any card to open it for editing.
- Click **Delete** in the edit window to remove it. An **Undo** button appears for 6 seconds in case it was a mistake.

### Categories and colors
Create your own categories with any name and color: use the **+ New category** chip at the end of the category filter row (pinned as **+ New** on phones), or **+ New category** in the task window, which also selects it for that task. The **Categories** window also lets you create, rename, recolor and delete them.

Click **Categories** in the top bar to:
- **Recolor** a category: click its color swatch.
- **Rename** it: type in the name field.
- **Add** a new one: choose a color, type a name and click **Add**.
- **Delete** one: click the trash icon. Any tasks in that category move to *Miscellaneous* (or the first remaining category). At least one category must always exist.

Changes apply instantly to every card.

Default categories:

| Category | Color |
|---|---|
| Work | 🔴 `#FF4D4F` |
| Gym | 🟠 `#FF9F1C` |
| Miscellaneous | 🔵 `#3A86FF` |
| Appointment | 🟣 `#C04CFD` |
| Personal | 🟢 `#2EC4B6` |
| Study | 🟡 `#FFD60A` |

### Priority levels

| Level | Label | Card badge |
|---|---|---|
| 1 | Urgent | Solid lime **P1** |
| 2 | High | Lime outline **P2** |
| 3 | Medium | Grey **P3** |
| 4 | Low | Grey **P4** |
| 5 | Someday | Grey **P5** |

Inside each column, tasks are sorted by **priority first**, then by **time** (earliest first; tasks without a time go last), then by when they were created.

### Filters and navigation
- **Category filters:** click one or more category chips to show only those tasks. Click **All** to clear.
- **Week arrows:** go forward to future weeks. The label shows "This week", "Next week" or "In 3 weeks".
- **Today button:** appears when you're viewing a future week and jumps back to the current one.
- **Progress bar and stats:** show how much of the week you've finished and how many tasks are To do, In progress and Done.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New task |
| `?` | Open the how-to page |
| `Shift` + `→` | Next week |
| `Shift` + `←` | Previous week (back to the current week) |
| `Enter` / `Space` | Open the focused card |
| `Esc` | Close a dialog |

---

## Using it on your phone
The app adapts to small screens automatically:

| On phones | What changes |
|---|---|
| **Header** | Shrinks to one row: logo, week switcher, How to (?) and Categories. Week dates shorten to "Oct 11 – 17" when both ends are in the same month. |
| **New task** | A floating lime **+** button in the bottom-right corner, within easy reach of your thumb. |
| **Columns** | Each day's Create, In progress and Done columns become a sideways swipe carousel. The next column peeks in from the right so you know it's there. |
| **Forms** | The task and Categories windows slide up from the bottom as a sheet. Text fields use 16px text so iPhones don't zoom in when you tap them. |
| **Buttons** | Every button is at least 40–44px tall for easy tapping. The move-forward arrow on cards is always visible (no hover needed). |
| **Filters** | Category chips scroll sideways in one row instead of wrapping. |
| **Moving tasks** | Press and hold a card to drag it (see [Moving tasks](#moving-tasks)), or tap the arrow on the card. |
| **Reset countdown** | Shown under the progress bar. |
| **Notches** | Content stays clear of the notch, rounded corners and home indicator. |

### Add it to your home screen
The app includes a web app manifest and icons, so it can be installed like a regular app (full screen, no browser bar):
- **iPhone (Safari):** open the site → tap **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the site → tap the **⋮** menu → **Add to Home screen** or **Install app**.

This works when the app is served from a web address (such as GitHub Pages), not when opening the file directly.

> Your tasks are stored per browser. Tasks on your phone and tasks on your laptop are separate lists.

## Pages

| Page | File | What it's for |
|---|---|---|
| **Planner** | `index.html` | The app itself. |
| **How to use** | `help.html` | Step-by-step instructions: quick start, reading a task card, adding/moving/editing tasks, the weekly reset, overdue tasks, categories and priority, phone tips, shortcuts, FAQ and troubleshooting. Topic chips at the top jump straight to each section. |
| **Privacy Policy** | `privacy.html` | Explains that tasks stay on the device, what's stored, the third-party services involved (GitHub Pages, Google Fonts, Google Maps, and email if they contact you), retention and how to delete data. |
| **Terms of Use** | `terms.html` | Usage rules, the weekly deletion, no warranty, limitation of liability, and Nova Scotia governing law. |
| **Contact** | `contact.html` | Contact form that emails alimustafa189@yahoo.com (see below). |
| **Error page** | `404.html` | Shown for missing pages and for app errors (see below). |

### Making the how-to page easy to find
New users can't miss it:
- **How to** button (a **?** icon on phones) in the top bar of the planner, always visible.
- A **"New here?" welcome banner** with a *Read the how-to* button. It shows until the user dismisses it or adds their first task.
- **Footer links** on every page: How to use · Privacy · Terms · Contact.
- The **`?`** keyboard shortcut.
- The error page and 404 page also link to it.

All pages share the app's look (`styles.css` plus `pages.css`), work on phones, and have a sticky top bar with a **Back to planner** button.

## Why there's no sign-in

**Productive deliberately has no accounts.** It's built to be as simple as possible:

- **No setup.** No sign-up, no password, no email. Open the page and start planning.
- **Saves automatically.** Tasks are stored in the browser (`localStorage`), so they're still there after a reload or restart.
- **Resets every week.** Saturday at midnight the finished week clears, so there's never a backlog.
- **Private by default.** Nothing is sent to a server, so there's no personal data to protect, leak or sell.

The trade-off is that each browser and device keeps its own planner. The app tells users this, and encourages them to **bookmark it or keep it open**:

- An in-app **"No account · No setup"** section near the bottom of the planner explains the idea and shows a bookmark tip that fits the visitor's device: <kbd>⌘</kbd>+<kbd>D</kbd> on Mac, <kbd>Ctrl</kbd>+<kbd>D</kbd> on Windows/Linux, *Add to Home Screen* on iPhone and Android, and a friendly note if it's already installed.
- The how-to page has **No account needed** and **Bookmark it or keep it open** sections, with steps for every device, including pinning the tab.
- The first-visit welcome banner says "No sign-up needed".

## Contact form

`contact.html` lets visitors reach the owner at **alimustafa189@yahoo.com** with a question, idea or problem.

- The form has a topic (Question, Idea, Problem, Other), an optional name and reply email, and a message of up to 1,500 characters.
- **Send message** opens the visitor's email app with the subject (`[Productive] Idea: …`) and body filled in. They press Send.
- If no email app opens, one-click buttons open the same message in **Gmail**, **Outlook** or **Yahoo Mail** on the web, plus a **Copy message** button.
- For **Problem** reports, technical details (browser, screen, and the last app error) can be included with a checkbox. Never task content.
- The error page's **Report this problem** button and the 404 page's **Report a broken link** both open the contact form pre-filled.
- Nothing is stored or sent by the website itself, and no third-party form service is used.
- The address is assembled by JavaScript rather than written in the HTML, to reduce spam from address-harvesting bots.

To change the address, edit the `EMAIL` line in `contact.html` (and in the small scripts at the bottom of `privacy.html` and `terms.html`).

## Accessibility & color contrast

All text meets **WCAG 2.1 AA** contrast (at least 4.5:1, or 3:1 for large text), checked with an automated audit of every page and window.
- `--muted` `#a4a9b8` and `--faint` `#8b90a0` pass on every background shade the app uses.
- Past days are shown with dashed outlines instead of being faded, so their text stays readable.
- Category tag text is calculated per color (`catTextColor()` in `app.js`), so even dark custom colors stay readable.
- Form field outlines (`--field-line`) have at least 3:1 contrast so fields are easy to see.

## Security

### What there is to protect
Productive is a **static website**: no server, no database, no accounts, no shared data. Each visitor's tasks live only in their own browser. That rules out most attacks by design:

| Concern | Why it isn't a risk here |
|---|---|
| Someone seeing other users' tasks | No user data exists anywhere except each person's own browser, and browsers never share it between websites or people. |
| Bots or fake users | There's nothing for a bot to do: no sign-up, no posting, no shared database, and the contact form can't send email by itself (a person has to press Send in their own email app). A CAPTCHA would only slow down real people. |
| Overloading / denial of service | Pages are static files served by GitHub Pages' global CDN, which absorbs heavy traffic. There's no backend to overload. |
| Stealing secrets | The repository contains no passwords, API keys or private data. The only personal detail is the public contact email, which is assembled by script to hide it from simple spam bots. |

### Protections built in
- **Content Security Policy** on every page: the browser only runs scripts from this site's own files, so injected or third-party code is blocked. It also forbids connections to any outside server (`connect-src 'none'`), so the app can't leak data even if something went wrong. Other restrictions include no plugins, no frames, no `<base>` changes and no form submissions to other sites. Only Google Fonts is allowed from outside.
- **No inline scripts.** Page scripts live in `app.js`, `pages.js` and `contact.js`. The one exception, `404.html`, is allowed by its SHA-256 hash (it must stay self-contained so it works from any broken address).
- **All user text is escaped** before it's shown (task titles, notes, locations, category names), so typing HTML or code just shows it as text.
- **Saved data is strictly checked on load** (`sanitize()` in `app.js`): it's rebuilt from known fields only, IDs must match `[A-Za-z0-9_-]`, colors must be `#rrggbb`, times must be valid, lengths are clipped, duplicates and junk are dropped, and the cleaned data is saved back immediately. Tampering with browser storage can't inject code or crash the app.
- **Limits** stop anyone flooding the app: 300 tasks per week, 30 categories, 60 weeks of saved data, title 120 / location 160 / notes 2,000 / category name 30 characters, enforced in code as well as in the form fields.
- **Anti-framing (clickjacking):** if another website loads Productive inside a frame, the page clears itself and shows only an "Open Productive in its own tab" link.
- **No referrer leaks:** `referrer` is `no-referrer`, so sites like Google Maps or Gmail don't learn which page you came from.
- **Safe links:** every link that opens a new tab uses `rel="noopener"`. Location links can only ever be a Google Maps search (`javascript:` tricks are impossible).
- **Error page** shows error details as plain text, and the contact form treats link parameters as plain text.

### Tested
An automated attack suite (31 checks) tries script injection through every input, tampered and oversized storage (`__proto__` keys, bad IDs, bad colors, garbage rows), crafted URLs, framing by another site, flooding a week, and loading scripts or sending data to an outside server. All are blocked, and the policy blocks nothing the app needs.

### Keeping it secure (owner checklist)
1. **Turn on two-factor authentication on your GitHub account.** Whoever controls the repo controls the website, so this matters most.
2. In the repo go to **Settings → Pages** and tick **Enforce HTTPS**.
3. Never commit passwords or API keys. Nothing in this app needs any.
4. If you edit the `<script>` at the bottom of `404.html`, update its hash in that file's `Content-Security-Policy` line. The browser console shows the exact value it expects, or run:
   ```bash
   python3 -c "import re,hashlib,base64;s=open('404.html').read();print(base64.b64encode(hashlib.sha256(re.search(r'<script>(.*?)</script>',s,re.S).group(1).encode()).digest()).decode())"
   ```
5. **Developing with Live Server:** its auto-refresh works by injecting a script, which the security policy (correctly) blocks. Pages still load fine. Just press refresh (⌘/Ctrl + Shift + R) after saving a change.

## Error handling

`404.html` has two modes:

| Mode | When | What the user sees |
|---|---|---|
| **Page not found** | Any address that doesn't exist (GitHub Pages serves `404.html` automatically) | "This page took the week off." Their tasks are safe, plus buttons back to the planner and the how-to page. *Report a broken link* opens the contact form with the bad address filled in. |
| **App error** | `404.html?type=error`: the app sends people here if anything breaks | "Something went wrong. I'm on it." Their tasks are safe, with buttons to **Try again**, **Report this problem** (opens the contact form with the error details ready, never task content), **Download backup** of tasks as JSON, and a two-tap **Reset app** if it keeps failing. A *Technical details* section shows the error. |

How it works in `app.js`:
- A safety net at the top of the file listens for uncaught errors and failed promises from the app's own code. It saves the last 10 error details on the device (`productive.errors.v1`) and redirects to the error page. Errors from browser extensions and harmless cancelled animations are ignored.
- **Damaged data can't crash the app.** On load, `sanitize()` checks every saved task and category, and repairs or drops anything malformed before rendering.
- `404.html` is fully self-contained (inline styles, links calculated at runtime), so it still looks right when GitHub Pages serves it from a deep broken address like `/Productive/a/b/c`.

Reports go through the [contact form](#contact-form) to your email. No GitHub account is needed.

## Design
- **Two-color scheme:** deep ink (`#0C0D11`) and electric lime (`#D6FF3D`). Category colors appear only as small tags and card accents.
- **Typography:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) for headings and [Inter](https://fonts.google.com/specimen/Inter) for body text, with system fonts as a fallback when offline.
- **Smoothness:** cards glide to their new spot when moved (View Transitions API), pop in when created, and lift on hover. Dialogs slide in with a soft spring, and a blurred, sticky top bar keeps controls in reach.
- **Accessibility:** keyboard-navigable cards and dialogs, visible focus rings, ARIA labels, and support for the system "reduce motion" setting (animations are turned off).
- **Responsive:** tested on desktop (1440px), iPhone (390px) and small Android (360px) screen sizes, with no sideways page scrolling at any size.

![Productive on mobile](docs/screenshot-mobile.png)

---

## Project structure

```
Productive/
├── index.html      # The planner: page layout, task dialog and categories dialog
├── help.html       # How-to guide
├── privacy.html    # Privacy Policy
├── terms.html      # Terms of Use
├── contact.html    # Contact form (opens the visitor's email app)
├── 404.html        # Page-not-found + app error page (self-contained)
├── styles.css      # Theme, layout, animations and responsive rules
├── pages.css       # Extra styles for the how-to, privacy and terms pages
├── pages.js        # Shared script for the how-to, privacy, terms and contact pages
├── contact.js      # Contact form logic
├── app.js          # All app logic (weeks, storage, auto-shift, drag & drop, touch drag)
├── manifest.webmanifest   # Lets the app be installed to a phone's home screen
├── icons/
│   ├── icon.svg            # Browser tab icon
│   ├── icon-192.png        # Android home-screen icon
│   ├── icon-512.png        # Android splash / large icon
│   └── apple-touch-icon.png  # iPhone home-screen icon
├── docs/
│   ├── screenshot-desktop.png
│   └── screenshot-mobile.png
└── README.md
```

---

## Technical details

**Stack:** vanilla HTML5, CSS3 and JavaScript (ES2020). No dependencies, no build tools.

**Drag & drop:** devices with a mouse or trackpad use the browser's built-in HTML5 drag and drop. Touch devices use a custom press-and-hold drag built on touch events, because mobile browsers don't support HTML5 drag and drop reliably.

**Storage keys** (`localStorage`):

| Key | Contents |
|---|---|
| `productive.v1` | Categories, the active week and all tasks, grouped by week |
| `productive.ui.v1` | UI preferences (active filters, show/hide earlier days, welcome banner dismissed) |
| `productive.errors.v1` | The last 10 app errors, used only by the error page's report button |

**Data shape**
```json
{
  "version": 1,
  "activeWeek": "2026-09-27",
  "categories": [{ "id": "work", "name": "Work", "color": "#FF4D4F" }],
  "weeks": {
    "2026-09-27": [
      {
        "id": "tmg4k2x9ab12",
        "title": "Dentist appointment",
        "day": 2,
        "time": "14:00",
        "status": "create",
        "cat": "appointment",
        "priority": 1,
        "location": "123 Spring Garden Rd, Halifax",
        "notes": "Bring insurance card.",
        "createdAt": 1790000000000,
        "originalDay": 1
      }
    ]
  }
}
```
- Weeks are keyed by the date of their **Sunday** (`YYYY-MM-DD`, local time).
- `day` is `0` (Sunday) to `6` (Saturday).
- `status` is `create`, `progress` or `done`.
- `originalDay` exists only on tasks that were auto-shifted.

**Main pieces of `app.js`**
- The error safety net (top of the file) and `sanitize()` keep problems from leaving users stuck.
- `checkRollover()` deletes every week older than the current one when a new week starts.
- `shiftOverdue()` applies the auto-shift rules to the current week.
- `render()` rebuilds the header, summary, filters, day strip and board from state.
- `update()` changes the data, saves it and re-renders with a smooth view transition.
- The touch-drag section handles press-and-hold dragging on phones and tablets, with auto-scrolling.
- `tick()` runs every 20 seconds, on tab focus, and exactly at Saturday midnight to handle resets, shifts and the countdown.

All dates use the device's local time zone.

---

## Browser support
Works in current versions of **Chrome, Edge, Firefox and Safari** (desktop and mobile).
- The animated card moves use the View Transitions API. Browsers without it still work, just without that animation.
- Mobile: iOS Safari 15+ and Chrome for Android. Touch drag, bottom sheets and home-screen install are all supported.

---

## Limitations
- By design there are no accounts, so data lives in **one browser on one device**, and clearing browser data erases it.
- Past weeks are deleted by design, so there's no history or statistics across weeks.
- There are no reminders or notifications.

## Ideas for future versions
- Browser notifications before a task's time
- Recurring tasks (e.g. "Gym every Mon/Wed/Fri")
- Light theme toggle
- Weekly summary before the reset (what got done, what carried over)
- Import a backup file (the error page can already export one)

---

Built by Mustafa Ali.
