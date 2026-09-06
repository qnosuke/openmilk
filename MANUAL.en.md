[日本語](./MANUAL.md) | **English** | [中文](./MANUAL.zh.md)

# openmilk User Manual (for first-time users)

openmilk is a task manager that runs entirely in your browser. No account, no install,
no server — all data stays inside your browser (IndexedDB) and is never sent anywhere.

This manual is written for first-time users. Use the section headings as a reference.

---

## Table of contents

1. [Your first 5 minutes](#your-first-5-minutes)
2. [Adding tasks (quick add)](#adding-tasks-quick-add)
3. [Completing, postponing, deleting](#completing-postponing-deleting)
4. [Editing details](#editing-details)
5. [INBOX and triage mode](#inbox-and-triage-mode)
6. [Managing lists](#managing-lists)
7. [Finding tasks (search & filters)](#finding-tasks-search--filters)
8. [Sort order](#sort-order)
9. [Time tracking and Pomodoro](#time-tracking-and-pomodoro)
10. [Stats](#stats)
11. [Trash](#trash)
12. [Backup and restore](#backup-and-restore)
13. [Owning your data](#owning-your-data)
14. [FAQ](#faq)

---

## Your first 5 minutes

1. **Add a task** — type `report tomorrow 30m !1 #work` in the input at the top and press
   Enter. Due date, estimate, priority and tag are all parsed from that single line.
2. **Complete it** — tick the checkbox on the task row, then click "Complete {n}" on the
   bar that appears above the list.
3. **Edit it** — click a task title to open the edit dialog (notes, due date, time,
   reminder, priority, list, estimate, tags).
4. **Find things** — type in the search box on the left; matching text is highlighted.
5. **Back up** — click the ⚙ icon (bottom left) → "Export" to save a JSON file.

That's it. Read on as needed.

> **Switching language**: ⚙ → "Language" at the bottom offers 日本語 / English / 中文.
> The UI language and your input language are independent — you can type Japanese quick-add
> syntax even with the UI in English.

---

## Adding tasks (quick add)

Type one line into the input at the top and press Enter. Parsing works even without
spaces, and Japanese / English / Chinese all work regardless of the UI language:

```
report tomorrow 30m !1 #work
```

| What | Examples |
|---|---|
| Due date | `today` `tomorrow` `next fri` `9/15` `2026-10-01` / `明日` `金曜` `明天` `周三` |
| Time | `9:30` `2pm` `10時` `午後3時` `10点` |
| Estimate | `30m` `45min` `1h30min` `1h30m` `0.5h` / `30分` `2時間` `30分钟` |
| Priority | `!1` (highest) `!2` `!3` |
| Tags | `#work` `#home` (multiple allowed) |

- Date and time combine: `tomorrow 2pm`. A time without a date means today
- Tasks are added to the **list you are viewing**. While viewing "All" or INBOX,
  they go to INBOX
- Anything that can't be parsed simply stays in the title — nothing is lost
- **Multi-line paste**: paste text containing line breaks into the input (or drop a
  .txt / .md file on the window) and each line becomes one task (up to 100 lines).
  Great for pouring in a TODO list you jotted down elsewhere

### One-shot adding via URL

Opening a URL like `https://qnosuke.github.io/openmilk/?add=call mom tomorrow`
adds the task immediately (the same line within 10 minutes is skipped to keep retries
safe). Handy for phone shortcuts and automation.

---

## Completing, postponing, deleting

Checkboxes in openmilk mean **selection**, not "done":

1. Tick the checkbox of the task(s) you want to act on
2. Click "Complete {n}" on the bar above the list
3. "Clear selection" to unselect everything

The same bar also offers:

- **Postpone**: "Postpone {n}" shifts the due date by one day (undated tasks become tomorrow)
- **Bulk tag add/remove**: type a tag name, then "+ Tag" or "− Tag" — applied to every
  selected task

To delete a task (move it to Trash), open its edit dialog and click "Delete".
You can restore it from the Trash ([see Trash](#trash)).

---

## Editing details

Click a task title to open the edit dialog:

- **Notes**: multiple lines allowed; only the first line shows as a preview in the list
- **Due date & time**: the time picker steps by 5 minutes, but typed values (e.g. 9:23)
  are kept as entered
- **Reminder**: 5 min to 1 day before the due time. The first time you set one, the app
  asks for notification permission. Notifications only arrive while the browser/PWA is
  open — there is no push server
- **Priority**: `!1` is highest. !1 tasks are emphasized in the list (bold title + red bar)
- **List**: move the task to another list (empty = INBOX)
- **Estimate / tracked**: parses natural input like "1h 30m"
- **Subtasks (split)**: type one line each into the "Subtasks" box and click "Split & add".
  Each line accepts quick-add syntax; children inherit the parent's list and tags,
  appear indented below the parent, and the parent shows progress like "▸ 1/3".
  Subtasks are **one level deep** — a subtask cannot be split further

"Cancel" discards changes; "Save" or clicking the backdrop saves them.

---

## INBOX and triage mode

INBOX is where you **dump thoughts first** and sort them later.

- Opening INBOX activates **triage mode** (a dark banner appears and the INBOX button
  in the sidebar inverts its colors)
- Each task gets one-click buttons — `next action`, `waiting`, `someday` — to move it
  to that list instantly
- INBOX order is **fixed to added order (oldest first)**, so you process what came in first
  (sorting other views is covered in [Sort order](#sort-order))

Write first, think later. An empty INBOX feels great — that's the idea.

---

## Managing lists

- Switch lists in the left sidebar: `All` / `INBOX` / the fixed lists
  (`next action`, `waiting`, `someday`) + your own lists
- **Create**: open ⚙ and use the "New list" input. The app switches to the new list so
  you can start adding tasks right away
- **Delete**: the × next to a list name. **Tasks are not lost — they return to INBOX**
- The fixed lists cannot be deleted

---

## Finding tasks (search & filters)

- **Search**: the box on the left covers titles, notes and tags, with matches highlighted
- **Period tiles**: the 2×2 tiles (Overdue / Today / Tomorrow / 1 week) filter by due date;
  click again to clear
- **Tag filter**: click a `#work` chip on a task row or in the sidebar tag cloud. Clear it
  with the "#work ✕" button that appears at the top
- **Hidden tags**: mute (⊘) noisy tags from the ⚙ tag list — tasks carrying them disappear
  from every view until you unmute

---

## Sort order

- Outside INBOX, use the sort selector at the top right:
  **by due date** (soonest first; timed tasks ordered within the day) / **by priority** /
  **newest first**. Your choice is remembered
- INBOX is always added order (see above)
- Completed tasks always gather at the end of the list

---

## Time tracking and Pomodoro

- Press **▶** on a task row to start tracking, **⏸** to stop. Only one task can be tracked
  at a time (starting another stops the previous one and banks its time)
- If a task completes while tracking, the elapsed time is saved as tracked time automatically
- While tracking, elapsed time is shown live — it turns red once it exceeds the estimate
  (shown as "25m / 30m")

### Pomodoro

While tracking, a Pomodoro cycle runs automatically:

- A 🍅 chip appears in the header counting down ("Round 1, 24:59 left")
- When a focus block ends you get a "Time for a break" notification; after the break,
  "Back to focus"
- Every 4th break is a longer one (15 minutes)
- Settings (focus 25m / break 5m / long break 15m / long break every 4 rounds) live in ⚙
  under "Pomodoro"

> Not getting notifications? Check the browser's notification permission. They are requested
> when you first set a reminder or when a Pomodoro break fires.

---

## Stats

The "Stats" tab in the header summarizes completed work:

- Completed count for **today / this week / this month / this year**
- Total estimate vs total tracked time
- **On-time rate**: how often tracked time stayed within the estimate

The goal is noticing when your estimates are too optimistic. Light estimates via quick add
make this more useful.

---

## Trash

- Deleted tasks stay in the Trash for **30 days** (⚙ → "Trash" toggles the view)
- Tick items in the Trash and click "Restore {n}" to bring them back
- Items older than 30 days are purged automatically on startup

---

## Backup and restore

⚙ → "Export" saves everything (including deleted tasks) into a single JSON file.

- **Restore / migrate**: "Import" merges idempotently — for the same task, the **newer**
  copy wins — so it is safe both to restore into an empty state and to merge with
  existing data
- **Recommended habit**: export weekly and keep the file in Dropbox / iCloud Drive
- To clear out completed tasks: ⚙ → "Delete completed tasks" (two-step confirm).
  Export first for extra safety

---

## Owning your data

openmilk's guiding principle is **own your data**.

- Data lives only in your browser (IndexedDB). Nothing is sent to any cloud or server
- **Clearing site data deletes your tasks**: the browser's "clear site data" wipes openmilk
  too, so export regularly
- **Use it as a PWA**: open https://qnosuke.github.io/openmilk/ in Chrome / Safari and
  choose "Install" — it then launches like an app and works offline
  (the dev server on localhost:5173 does not support offline mode)
- Automatic cross-device sync is not implemented yet. To move data, export the JSON and
  import it on the other device

---

## FAQ

**Q. Where is my data stored?**
In your browser's IndexedDB only. It never reaches a server or this repository.

**Q. Can I use the same data on phone and desktop?**
Not automatically yet. Export the JSON and import it on the other device.

**Q. I don't see a "complete" button on rows**
By design: tick the checkbox(es), then use "Complete {n}" on the bar above the list.

**Q. No notifications arrive**
They only arrive while the browser/PWA is open (no push server), and require the OS/browser
notification permission. Installing as a PWA is recommended.

**Q. A task I added is missing**
It went into the list you were viewing. Check INBOX or "All", and make sure none of its tags
are muted.

**Q. I added the same task twice by mistake**
`?add=` URLs skip re-runs within 10 minutes. For manual duplicates, open the edit dialog
and "Delete" the extra copy.

---

See [DEVELOPMENT_FLOW.md](./DEVELOPMENT_FLOW.md) and [AGENTS.md](./AGENTS.md) (Japanese)
for design, roadmap and developer notes, or the [README](./README.en.md) for a short overview.
