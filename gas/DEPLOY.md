# Deploying the GAS Backend

1. Go to script.google.com
2. Click "New Project"
3. Paste the contents of `gas/Report.gs`
4. Click Deploy → New Deployment
5. Type: Web App
6. Execute as: Me
7. Who has access: Anyone
8. Click Deploy → Copy the Web App URL
9. In Vercel (the `aibp-ce-post-id` project), set env var `REPORT_GAS_URL` to
   that URL, then redeploy the site

No `createReportSpreadsheet` step is needed — `REPORT_SHEET_ID` at the top of
`gas/Report.gs` already points at the real "CEID_Report_Content" sheet.

## Testing the endpoint

```
[GAS_URL]?action=ping
[GAS_URL]?action=getReport
```

`getReport` is what `/api/report` actually calls — if it returns real data
here, the page will show it (allow up to 5 minutes for the cache, or hit
`invalidateCache` below to force it immediately).

## Redeploying after changes

- Go to Deployments → Manage Deployments
- Click the pencil icon on your existing deployment
- Change version to "New Version"
- Click Deploy

Note: After redeploying, the GAS_URL stays the same — no need to update
Vercel env vars.

## invalidateCache

The report payload is cached for 5 minutes. To see a content-sheet edit show
up immediately instead of waiting:

```
[GAS_URL]?action=invalidateCache
```
