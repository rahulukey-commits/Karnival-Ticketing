# Karnival Dashboard (full portal replica)

A faithful, self-contained replica of **https://sbdashboard.karnival.com** — every sidebar module, page, and setup screen, rebuilt from a live click-through of the sandbox (Athlete's Co AG account). No build step, no external dependencies (charts are hand-rolled SVG; fonts are the only CDN call). Everything runs in-memory.

The full exploration record (every page's layout, filters, columns, and real data captured from the live portal) is in [`exploration-notes.md`](exploration-notes.md).

## Run

```bash
cd /Users/rahulukey/Ticketing
python3 -m http.server 4173
# open http://localhost:4173
```

## Shell

- Top bar: hamburger, KARNIVAL logo, customer search combo (Phone Number / Email / Customer ID), **brand switcher** ("Athlete's Co AG" ▾ with a real brand list dropdown), RU avatar.
- Sidebar: full 16-module **accordion nav** (one group open at a time, section labels inside Loyalty/Settings), active-route highlight, auto-opens the owning group on deep links.
- Extras replicated from the live portal: "Minor update available ✨" banner (appears after ~45s, Update dismisses it), footer with social icons + version, floating chat FAB, hash routes matching the real app (`#/survey-designer/list`, `#/settings/store-config`, …).
- Full-page layers (no sidebar, like the real app): Survey Analytics, CX Report, Live Dashboard, POS Uploads, Generate Reports.

## Modules & pages (all live)

| Module | Pages |
|---|---|
| **Home** | Live Stores/POS tiles, Bill Overview (filters, stat tiles, multi-series chart), Invoices Count Summary (B2C), Sales Overview |
| **CX Management** | Surveys (search/sort/paginate, status chips, Create with AI), Dashboard Creator (CES/Other widget), Forms, NPS & Smart Feedback (28 inactive grouped questions), Feedback Ticketing (score buckets), Opt-In repository, KPI widget, Surveys (Legacy) |
| **Ticketing** | The original ticketing subsystem — All Tickets, Projects, Overview, Support, Agents Reports, Ticket Source, Ticket Logs (floating-sheet UX, unchanged) |
| **Loyalty (Raffle)** | Campaign (split Create button, pill tabs), Draw, Winners List (filter row + export) |
| **CRM Campaigns** | Campaign Builder (journeys, pill filters), SR Offers, Carousel Campaigns, Coupon Vault, Smart Web App (19 drafts, paginated), Dynamic QR |
| **Website** | Testimonials (published widget-card grid), Collections |
| **POS** | COGS (date-matrix table + table/chart toggle), Inventory, Reports (8 report sub-tabs + Downloads), Uploads (full-page radio-card + dropzone flow) |
| **UGC** | Reviews, Instagram (connect gate), Uploaded, Albums, Visualize |
| **Product Insights** | Catalogue (stat strip), Analytics & Moderation (Enable-Now gates), Setup (Proceed gate) |
| **Customers** | Registration (setting rows + View API/Import), Audiences (22 predefined segments: Profile/Location/Bill amount/Loyalty/NPS) |
| **Utilities** | Uploads |
| **Analytics** | Store (Stores/Channels/Smart Receipt Adoption, 124 stores), Customer Profile (stat cards + profile-data completeness), Retention (14 customers, block list), Communication (SMS/Email consumption charts), **Survey Analytics** (5 analysis tabs: Progressive Drilldown w/ NPS gauge + business units, AI Sentiment, Area of Improvements, Metrics Comparison, Channel Analysis), **CX Report** (17-section monthly insight report incl. funnel, NPS gauge, weekly trends, detractor drilldown, sentiment, country/store rankings), **Live Dashboard** (APPAREL GROUP org view, ticket metrics, trend/insight/performance sections) |
| **Reports** | Reports (27 selectable report-type cards → **Generate Reports** overlay with dual-month calendar; generated reports land in Downloads), Downloads, Report Mailer |
| **Audits** | One Audit hub with 11 tabs — Transactions (170 rows, paginated), SMS, WhatsApp, Email (316 rows w/ SUBMITTED/FAILED), Survey Audits, Email (Portal), Advance Transactions, Webhook/Event Audits, Event, RCS |
| **Design** | Bill Design (Global Elements: logos, T&C rich-text w/ EN+AR refund policy + Add Language, 10 social links, brand colours, YouTube promo; Web/Pdf tabs), Email Design, Smart Popup (toggle, config, Full Screen/Overlay design picker, live iPhone preview) |
| **Settings** | General profile, Account Defaults, Activity Logs · Monitoring: Live Health Check · Admin Setup: Store Config (125 stores, wide table), Sales Person Config, Groups (L1/L2/L3), Webhooks, Profile Data (24 field definitions), Admin Reports, Report Management (permission matrix) · User Management: Users (42-user summary + list), Roles · Communication Setup: SMS/WhatsApp/Email/RCS connections (Twilio, Gupshup, MSG91, ValueFirst, Facebook, YellowMessenger, CleverTap, SES…) · Filter Lists: E-mail/Mobile/Domain block lists, Unblock User · System Setup: Organization Config (20 orgs), Brand Config (421 brands), Path Mapping (Angular/Qwik brand→path table), UI Config, Health Config, User Management (admin API tool) |

## Interactions

Tab switching, pagination (rows/page + page nav), live search filters (Surveys, Brand Config, Path Mapping), report selection → Generate flow with calendar range → toast + Downloads entry, Smart Popup toggle/design switching with live preview, POS upload flow, brand switching, accordion nav, view toggles, sortable-looking headers, per-row Action/Analytics/Edit buttons (sandbox-stubbed with toasts where the real app opens deeper editors).

## Files

| File | Role |
|------|------|
| `index.html` | App shell — top bar, full sidebar nav tree, footer, overlay mounts |
| `styles.css` | Design system (purple palette) + `m-*` module component kit |
| `modules.js` | All portal modules: UI kit, mock data mirroring the live sandbox, 55+ page views, full-page layers |
| `app.js` | Hash router, home dashboard, the entire Ticketing subsystem |
| `data.js`, `charts.js` | Ticketing seed data · hand-rolled SVG charts |
| `exploration-notes.md` | Complete page-by-page record of the live dashboard |

State is in-memory — reload resets to seed data.
