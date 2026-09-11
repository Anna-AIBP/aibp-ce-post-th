# AIBP C&E Indonesia 2026 — Post-Event Report

Standalone Next.js app serving the post-event report for AIBP Conference &
Exhibition Indonesia 2026. Structured the same way as its Malaysia sibling
(`aibp-ce-post-my`), but Indonesia has no live Sheets-backed operational app
to borrow Config/Sponsors from (id.aibp.sg runs on Firebase), so this repo's
GAS backend is fully self-contained — everything it serves lives on one
report content spreadsheet.

## What's here

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | The report itself (client component) |
| `app/report/page.tsx` | Alias so `/report` also works |
| `app/api/report/route.ts` | Server route that proxies the Apps Script backend |
| `middleware.ts` | Blocks direct/public hits to `/api/*` |
| `gas/Report.gs` | Google Apps Script backend (deploy separately — see `gas/DEPLOY.md`) |
| `public/CEID_Report_Preview.html` | Earlier static preview, kept for reference — superseded by this app |

## Content source

Everything on the report — sessions, awards, networking, testimonials,
participants, sponsors, and the hero copy/photos — comes from one Google
Sheet ("CEID_Report_Content"), read live by `gas/Report.gs` on every
`getReport` call (5-minute cache). Editing that sheet and waiting up to 5
minutes (or hitting `[GAS_URL]?action=invalidateCache`) is the entire publish
workflow — no redeploy needed for content changes.

Event name, dates, and venue are hardcoded as `EVENT_DEFAULTS` in
`gas/Report.gs` (since they don't change), but can be overridden by adding a
matching row to the sheet's `REPORT_META` tab (`Event Name` / `Event Day 1` /
`Event Day 2` / `Venue`) without touching the script.

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `REPORT_GAS_URL` | **Yes** | Web-app URL of the deployed `gas/Report.gs` Apps Script. Without it, `/api/report` returns `{"error":"no_gas_url"}` and the page renders empty. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 measurement ID for the shared "AIBP Apps" property. Omit to disable analytics. |

For local development, put the same values in a `.env.local` file (gitignored).

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Deploying

Vercel auto-detects Next.js — import the repo, add `REPORT_GAS_URL`, deploy.
The report is set to `noindex, nofollow`, so it won't appear in search
results even once a custom domain is attached.

## Colour scheme

Uses the Indonesia secondary brand colour (`#4B64AE`, "Indonesia Blue") in
place of Malaysia's orange — see `app/globals.css`. Everything else
(typography, layout, section structure) matches `aibp-ce-post-my` exactly.

## Known gaps to fill in

- `HERO_ENDORSEMENTS` in `app/page.tsx` is empty — no Indonesia
  endorsement/support-body logos confirmed yet.
- Exact event venue is unconfirmed — currently defaults to "Jakarta,
  Indonesia" in `gas/Report.gs`; add a `Venue` row to `REPORT_META` once
  known.
- Photos, videos, sponsor logos, awards results, and testimonials are still
  blank on the content sheet — fill in as they become available.
