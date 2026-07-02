# Karnival Ticketing

A faithful, self-contained mockup of the **Karnival Ticketing** subsystem — built from the screen recording and `karnival-ticketing-reference.md`. No build step, no external dependencies (charts are hand-rolled SVG, fonts are the only CDN call). Open it and everything works in-memory.

## Shell (matches the recording)

The base layer is the **Karnival portal** — topbar + sidebar + the *Bill Overview* home dashboard. Every ticketing screen (All Tickets, ticket detail, Support, Projects, Agents Reports, Ticket Source, Ticket Logs, Overview) opens as a **large floating white card overlaying the dimmed app, with a circular ✕ close button at the top-right corner** — exactly as in the video. Launch a view from the **Ticketing** group in the sidebar; ✕ returns you to the home dashboard. Asset URLs carry a `?v=` query so edits reload reliably under `python -m http.server`.

## Run

```bash
cd /Users/rahulukey/Ticketing
python3 -m http.server 4173
# open http://localhost:4173
```

## What's inside

| File | Role |
|------|------|
| `index.html` | App shell — Karnival top bar + sidebar nav |
| `styles.css` | Design system (purple palette, status/priority colors, components) |
| `data.js` | Mock data + enums mirroring the `support_ticket` model |
| `charts.js` | Tiny SVG charts (donut, bars, line, stacked) |
| `app.js` | Hash router, state, all views & interactions |

## Views & interactions (all live)

- **Overview** — KPI cards, status donut, created-vs-resolved trend, source bars, recent tickets.
- **All Tickets** — 6 KPI cards, search + assignee/priority/status/tags filters, *More Options* (brand/project/date), rich ticket cards with SLA-breach badges, pagination.
- **Create Ticket** — full multi-section modal: Brand/Project → customer lookup (search `9021785090`) → related invoices → source channel (conditional **Store** field + incident date/time) → title/priority/assignee/rich-text description/SKU → categories + suggested/custom tags → drag-drop attachments. Live validation; creating adds the ticket and routes to its detail.
- **Ticket Detail** — editable status/priority/assignee/due-date, store location, customer (with PII masking), collaborators & group collaborators, tags, attachments (+ Add File), and tabs for **Comments** (internal toggle + tags), **Communication audit**, **History timeline**, and **Escalation** (project matrix + force-escalate). *Reply to Customer* logs comms.
- **Support** — ticket list + conversation pane with Email/WhatsApp/SMS channel switcher; messages log to the communication audit.
- **Projects** — cards with escalation-level pills; create/edit modal with an **escalation matrix builder** (level/duration/target/channel) and collaborators; delete.
- **Agents Reports** — sortable KPI table (volume, SLA %, avg response, resolution rate) with bar gauges.
- **Ticket Source** — source distribution donut + auto-vs-manual volume + share table.
- **Ticket Logs** — audit trail of every mutation; logs update live as you act elsewhere.

State is in-memory — reload resets to seed data.
