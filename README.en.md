[日本語](./README.md) | **English** | [中文](./README.zh.md)

# openmilk 🥛

A browser-based task management web app that aims to be a Remember The Milk alternative (in development).

- No server required, zero running costs (runs on static hosting alone)
- Data lives inside your browser (IndexedDB), with JSON backup/restore built in
- UI available in Japanese / English / 中文
- Designed to be easy for AI agents (OpenClaw, etc.) to operate through files and URLs

**New here? Read the [user manual](./MANUAL.en.md)** ([日本語](./MANUAL.md) / [中文](./MANUAL.zh.md))

## Development

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run check    # type checking (svelte-check + tsc)
npm run test     # unit tests
npm run build    # production build (dist/)
```

## Quick add syntax

```
Submit report tomorrow 30min !2 #work
```

Items are parsed whether separated by spaces or embedded in words (Japanese / English / Chinese input are all supported):

- Due date: `明日` `明天` `tomorrow` `金曜` `周三` `next fri` `9/15` `9月15日` `2026-10-01`
- Time: `10時` `午後3時` `9:30` `2pm` `10点` — can be combined with a date, as in `tomorrow 2pm`
  (a time without a date is treated as today)
- Estimate: `30分` `2時間` `1時間半` `45min` `1h30min` `1h30m` `0.5h` `30m` `2小时` `30分钟`
- Priority: `!1` (high) `!2` `!3`
- Tags: `#work` (multiple allowed)

## Features

- Switch lists from the sidebar. Tasks are added to the list you are viewing, and INBOX collects them for triage later
  (lists can also be deleted; their tasks are not lost — they go back to INBOX)
- Toggle sort order (by due date / priority / created). Your choice is remembered
- Click a task title to edit its details (notes, due date, priority, list, estimate, tags)
- Shows the total estimate of incomplete tasks due today or earlier (a rough guide to today's workload)

Design and roadmap: [DEVELOPMENT_FLOW.md](./DEVELOPMENT_FLOW.md) (Japanese).
Agent instructions: [AGENTS.md](./AGENTS.md) (Japanese).
