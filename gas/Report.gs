// =============================================================================
// AIBP CETH — POST-SHOW REPORT BACKEND (standalone, Thailand)
//
// Adapted from the CEID (Indonesia) report backend, itself adapted from the
// CEMY (Malaysia) one. Same pattern: no read-only link into a live
// operational CE app spreadsheet — everything this script reads — sessions,
// awards, networking, testimonials, sponsors, and the handful of event-level
// settings in EVENT_DEFAULTS below — lives on the one standalone
// "CETH_Report_Content" spreadsheet (REPORT_SHEET_ID).
//
// SETUP (one time):
//   1. Go to script.google.com → New project.
//   2. Delete the default Code.gs contents, paste this whole file in.
//   3. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
//   4. Copy the Web App URL it gives you.
//   5. In Vercel (aibp-ce-post-th project), set env var REPORT_GAS_URL to
//      that URL, redeploy the site.
//   That's it — REPORT_SHEET_ID below already points at the real content
//   sheet, so there's no createReportSpreadsheet step needed.
//
// This file touches NOTHING in the live id.aibp.sg, my.aibp.sg, or their GAS
// projects — it only ever opens REPORT_SHEET_ID, and only for reading.
// =============================================================================

// The one spreadsheet this whole script reads from. Editing any cell on it
// and waiting up to 5 minutes (the getReport() cache TTL below) — or hitting
// [WEB_APP_URL]?action=invalidateCache — is the entire "publish an update"
// workflow for this report.
const REPORT_SHEET_ID = '1S90-BGEp4dglA71g36wgImFJ-X-QuLVoxQI97A8ZotI';

// Event-level facts that don't live on any sheet tab because they're fixed
// for this event (won't change between now and the report going stale).
// REPORT_META can still override any of these — see getReportMeta() — by
// adding a row with that exact key (e.g. "Venue") and a value.
const EVENT_DEFAULTS = {
  eventName: '55th AIBP Conference & Exhibition Thailand',
  day1: '2026-09-02',
  day2: '2026-09-03',
  venue: 'W Hotel Bangkok'
};

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    let result;

    switch (action) {
      case 'getReport':
        result = getReport();
        break;
      case 'setupReportTabs':
        result = setupReportTabs();
        break;
      case 'invalidateCache':
        CacheService.getScriptCache().removeAll(['report', 'sponsors']);
        result = { ok: true, cleared: true };
        break;
      case 'ping':
        result = { ok: true, timestamp: new Date().toISOString() };
        break;
      default:
        result = { error: 'unknown_action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// Cache helper — this project's own ScriptCache, isolated from the main app.
// ---------------------------------------------------------------------------
function cachedGet(key, ttlSeconds, fetchFn) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) {}
  }
  const result = fetchFn();
  try { cache.put(key, JSON.stringify(result), ttlSeconds); } catch (_) {}
  return result;
}

// =============================================================================
// REPORT-ONLY SPREADSHEET — REPORT_SHEET_ID (declared up top) is the one and
// only spreadsheet this script ever opens. No Script Properties lookup and
// no createReportSpreadsheet step needed — the sheet already exists.
// =============================================================================

function getReportSheetId() {
  return REPORT_SHEET_ID;
}

// Turns whatever's typed into a Tier cell on SPONSORS_REFERENCE into one of
// the canonical keys page.tsx's TIER_ORDER/TIER_SECTION_LABELS knows about.
// Anything unrecognised falls back to EXHIBITOR so a sponsor never silently
// disappears just because its tier text doesn't match exactly.
function normalizeSponsorTier(raw) {
  const t = String(raw || '').toUpperCase();
  if (t.indexOf('PLATINUM') !== -1) return 'PLATINUM';
  if (t.indexOf('GOLD') !== -1) return 'GOLD';
  if (t.indexOf('SILVER') !== -1) return 'SILVER';
  if (t.indexOf('BRONZE') !== -1) return 'BRONZE';
  if (t.indexOf('WORKSHOP') !== -1) return 'WORKSHOP PARTNER';
  if (t.indexOf('AI SECURITY') !== -1) return 'AI SECURITY PARTNER';
  if (t.indexOf('PAVILION') !== -1) return 'PAVILION HOST';
  return 'EXHIBITOR';
}

// Sponsors for Indonesia live on their own SPONSORS_REFERENCE tab on the
// report sheet (Company, Tier, Order, Logo URL) rather than being pulled from
// a live operational app spreadsheet the way CEMY's getSponsors() does —
// Indonesia's live app is Firebase-backed, so there's no equivalent sheet to
// read from. Logo URL starts blank (yellow-filled on the sheet) until filled
// in; a sponsor with no logo still won't render on the page (page.tsx skips
// sponsors with an empty logoUrl the same way it always has).
function getSponsorsFromReportSheet() {
  return cachedGet('sponsors', 120, function() {
    const ss = SpreadsheetApp.openById(getReportSheetId());
    const sheet = ss.getSheetByName('SPONSORS_REFERENCE');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const company = String(data[i][0] || '').trim();
      if (!company) continue;
      rows.push({
        spId: 'sponsor-' + i,
        company,
        sponsorTier: normalizeSponsorTier(data[i][1]),
        order: Number(data[i][2]) || 0,
        logoUrl: String(data[i][3] || '').trim() ? toDirectImageUrl(String(data[i][3]).trim()) : ''
      });
    }
    rows.sort(function(a, b) { return a.order - b.order; });
    return rows;
  });
}

// Re-runnable — adds any tabs that don't exist yet on the current report
// spreadsheet. Never touches a tab that's already there.
function setupReportTabs() {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const created = setupReportTabsOn(ss);
  return { ok: true, tabsCreated: created };
}

function setupReportTabsOn(ss) {
  const created = [];

  function ensureTab(name, headers) {
    let sheet = ss.getSheetByName(name);
    if (sheet) return;
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    created.push(name);
  }

  ensureTab('REPORT_META', ['Setting', 'Value']);
  ensureTab('STATS', ['Setting', 'Value']);
  ensureTab('STATS_BREAKDOWN', ['Type', 'Label', 'Percentage']);
  // Fully self-contained — no lookup into the main app's AGENDA/SPEAKERS
  // sheets required. Just fill in one row per session, in plain text.
  // Moderator: one line, e.g. "Sue Yuin Ho, VP, AIBP". Panelists: one
  // per line within the same cell (Alt+Enter / Cmd+Enter for a new line
  // inside a Sheets cell) — each line becomes one panelist on the page.
  ensureTab('SESSIONS', [
    'Day', 'Order', 'Title', 'Description', 'Moderator', 'Panelists',
    'LinkedIn URL', 'Video URL', 'Photo 1', 'Photo 2', 'Photo 3', 'Photo 4', 'Photo 5',
    'Session', 'Presentation', 'Session Title',
    'Logo 1', 'Logo 2', 'Logo 3', 'Logo 4', 'Logo 5', 'Logo 6',
    'Session Intro', 'Case Study', 'Website'
  ]);
  ensureTab('AWARDS', ['Category', 'Winner Company', 'Announcement Text', 'Photo 1', 'Photo 2', 'Photo Caption']);
  ensureTab('AWARDS_JUDGES', ['Category', 'Judge Name', 'Judge Title', 'Judge Company']);
  ensureTab('AWARDS_QUOTES', ['Winner Company', 'Quote Text', 'Quote Author Name', 'Quote Author Title']);
  ensureTab('NETWORKING_SESSIONS', ['Networking ID', 'Type', 'Title', 'Co Hosted With', 'Focus Bullets', 'Photo 1', 'Photo 2', 'Photo 3', 'Photo 4', 'Article Link', 'Co-Host Logo']);
  ensureTab('NETWORKING_PARTICIPANTS', ['Networking ID', 'Title', 'Company']);
  ensureTab('TESTIMONIALS', ['Quote Text', 'Name', 'Title', 'Company']);
  // Searchable past-participant directory. Deliberately just 3 plain-text
  // columns, no logo — Title (job title), Company, Classification (a
  // sector/industry label, same idea as the Stats breakdown categories).
  ensureTab('PARTICIPANTS', ['Title', 'Company', 'Classification']);
  ensureTab('SPONSORS_REFERENCE', ['Company', 'Tier', 'Order', 'Logo URL']);

  if (created.indexOf('REPORT_META') !== -1) {
    const sheet = ss.getSheetByName('REPORT_META');
    sheet.getRange(2, 1, 6, 2).setValues([
      ['Theme Tagline', ''],
      ['Hero Description', ''],
      ['Hero Photo 1', ''],
      ['Hero Photo 2', ''],
      ['Hero Photo 3', ''],
      ['Hero Photo 4', '']
    ]);
  }
  if (created.indexOf('STATS') !== -1) {
    const sheet = ss.getSheetByName('STATS');
    sheet.getRange(2, 1, 4, 2).setValues([
      ['Total Attendees', ''],
      ['Total Companies', ''],
      ['Pct Stat 3', ''],
      ['Pct Stat 3 Label', 'Local Enterprises']
    ]);
  }

  return created;
}

// Turns whatever a person pastes into a "Photo" cell into a URL a web page
// can actually render — a normal Drive share link, a "open?id=" link, or a
// bare Drive file ID are all converted to the same lh3.googleusercontent.com
// format the live Photo Wall already uses. Anything else passes through
// unchanged (already a direct image URL).
// NOTE: the Drive file must be shared "Anyone with the link — Viewer".
function toDirectImageUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return 'https://lh3.googleusercontent.com/d/' + url;
  return url;
}

function readKeyValueTab(sheetName) {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i][0] || '').trim();
    if (!k) continue;
    out[k] = String(data[i][1] || '').trim();
  }
  return out;
}

function getReportMeta() {
  const meta = readKeyValueTab('REPORT_META');
  // REPORT_META can override any EVENT_DEFAULTS key by adding a row with
  // that exact key ("Event Name" / "Event Day 1" / "Event Day 2" / "Venue")
  // — used here mainly so Venue can be filled in later without a redeploy.
  return {
    eventName: meta['Event Name'] || EVENT_DEFAULTS.eventName,
    day1: meta['Event Day 1'] || EVENT_DEFAULTS.day1,
    day2: meta['Event Day 2'] || EVENT_DEFAULTS.day2,
    venue: meta['Venue'] || EVENT_DEFAULTS.venue,
    themeTagline: meta['Theme Tagline'] || '',
    heroDescription: meta['Hero Description'] || '',
    heroPhotos: [meta['Hero Photo 1'], meta['Hero Photo 2'], meta['Hero Photo 3'], meta['Hero Photo 4'], meta['Hero Photo 5'], meta['Hero Photo 6']]
      .filter(function(u) { return u && String(u).trim(); })
      .map(toDirectImageUrl),
    day1SummaryUrl: String(meta['Day 1 Link'] || '').trim(),
    day2SummaryUrl: String(meta['Day 2 Link'] || '').trim()
  };
}

function getReportStats() {
  const kv = readKeyValueTab('STATS');
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sheet = ss.getSheetByName('STATS_BREAKDOWN');
  const breakdown = [];
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const type = String(data[i][0] || '').trim();
      const label = String(data[i][1] || '').trim();
      if (!type || !label) continue;
      breakdown.push({ type, label, percentage: Number(data[i][2]) || 0 });
    }
  }
  return {
    totalAttendees: Number(kv['Total Attendees']) || 0,
    totalCompanies: Number(kv['Total Companies']) || 0,
    // "Pct Stat 3" is the new key; "Pct Local Enterprises" still works too,
    // for anyone who filled that in before this label became configurable.
    pctStat3: Number(kv['Pct Stat 3'] || kv['Pct Local Enterprises']) || 0,
    pctStat3Label: kv['Pct Stat 3 Label'] || 'Local Enterprises',
    breakdown
  };
}

// Fully self-contained — reads straight from the SESSIONS tab on the report
// spreadsheet, no join against the main app's AGENDA/SPEAKERS required.
// Rows with no Title are skipped.
//
// Three extra (optional) columns beyond the original 13:
//   Col N (13): Session       — segment number (e.g. 1-7). Purely a label
//                                grouping key — a "SESSION N: ..." header can
//                                be shown above whatever card(s) share it,
//                                whether that's one standalone panel or a
//                                merged multi-presentation card.
//   Col O (14): Presentation  — ONLY rows that have BOTH a Session number
//                                AND a Presentation number get merged into
//                                one multi-presentation card together (sort
//                                order = this value). Leave Presentation
//                                blank and the row always stays its own
//                                standalone "panel" card, even if it shares
//                                a Session number with something else.
//   Col P (15): Session Title — the segment header text, e.g.
//                                "SESSION 3: Governing AI Without Slowing It
//                                Down". Only needs to be filled in on ONE row
//                                per Session number — whichever row has it
//                                is used, and it's shown once, above the
//                                first card (by Order) under that Session
//                                number.
// Every session returned has a `presentations` array — length 1 for a plain
// standalone panel, length 2+ for a merged multi-presentation card — plus a
// `segmentLabel` (blank if this card has no Session number, or if its
// Session number's header already appeared on an earlier card).
function getReportSessions() {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sheet = ss.getSheetByName('SESSIONS');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();

  // Pass 0 — harvest the Session Title / Session Intro for each Session
  // number from EVERY row that has one, even a row with a blank Title used
  // purely to carry the group's header text (no presentation of its own).
  // Must run over the raw sheet data, not the Title-filtered list below —
  // otherwise a blank-Title "header row" is silently dropped before its
  // Session Title/Intro is ever read.
  const segmentLabelByKey = {};
  const segmentIntroByKey = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sessionKey = String(row[13] || '').trim();
    if (!sessionKey) continue;
    const k = 'day' + (Number(row[0]) || 1) + '-' + sessionKey;
    const sessionTitle = String(row[15] || '').trim();
    const sessionIntro = String(row[22] || '').trim();
    if (!segmentLabelByKey[k] && sessionTitle) segmentLabelByKey[k] = sessionTitle;
    if (!segmentIntroByKey[k] && sessionIntro) segmentIntroByKey[k] = sessionIntro;
  }

  // Pass 1 — parse every row that has a real presentation (Title filled in).
  const raw = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const title = String(row[2] || '').trim();
    if (!title) continue;

    const panelistsRaw = String(row[5] || '').trim();
    const panelists = panelistsRaw
      ? panelistsRaw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean)
      : [];
    const presentationRaw = String(row[14] || '').trim();

    raw.push({
      rowIndex: i,
      day: Number(row[0]) || 1,
      order: Number(row[1]) || (i + 1),
      title: title,
      description: String(row[3] || '').trim(),
      moderator: String(row[4] || '').trim(),
      panelists: panelists,
      linkedinUrl: String(row[6] || '').trim(),
      videoUrl: String(row[7] || '').trim(),
      photos: [row[8], row[9], row[10], row[11], row[12]]
        .map(function(v) { return String(v || '').trim(); })
        .filter(Boolean)
        .map(toDirectImageUrl),
      sessionKey: String(row[13] || '').trim(),
      presentationOrder: presentationRaw === '' ? null : (Number(presentationRaw) || 0),
      sessionTitle: String(row[15] || '').trim(),
      // Company logos for whoever's speaking on this row (moderator +
      // panelists) — up to 6, entered directly against the row they belong to.
      logos: [row[16], row[17], row[18], row[19], row[20], row[21]]
        .map(function(v) { return String(v || '').trim(); })
        .filter(Boolean)
        .map(toDirectImageUrl),
      // Optional intro paragraph for a whole Session group — same
      // "fill it in on any one row in the group" convention as Session Title.
      sessionIntro: String(row[22] || '').trim(),
      // Optional external case-study link for this specific presentation —
      // shows a "View Case Study" button when filled in.
      caseStudyUrl: String(row[23] || '').trim(),
      // Fallback CTA when there's no case study — a plain "Visit Website"
      // button, only shown when Case Study is blank (see presentation object
      // below).
      websiteUrl: String(row[24] || '').trim()
    });
  }

  // Pass 3 — build cards. Only merge when BOTH Session AND Presentation are
  // filled in; a blank Presentation always stays its own standalone card.
  const mergeGroups = {};
  const cards = [];
  raw.forEach(function(r) {
    const presentation = {
      title: r.title, description: r.description, moderator: r.moderator,
      panelists: r.panelists, linkedinUrl: r.linkedinUrl, videoUrl: r.videoUrl, photos: r.photos,
      logos: r.logos, caseStudyUrl: r.caseStudyUrl, websiteUrl: r.websiteUrl
    };

    if (r.sessionKey && r.presentationOrder !== null) {
      const mk = 'day' + r.day + '-' + r.sessionKey;
      if (!mergeGroups[mk]) {
        const card = { id: mk, day: r.day, order: r.order, sessionKey: r.sessionKey, presentations: [] };
        mergeGroups[mk] = card;
        cards.push(card);
      }
      mergeGroups[mk].order = Math.min(mergeGroups[mk].order, r.order);
      mergeGroups[mk].presentations.push({ sortOrder: r.presentationOrder, presentation: presentation });
    } else {
      cards.push({
        id: 'row-' + r.rowIndex, day: r.day, order: r.order, sessionKey: r.sessionKey,
        presentations: [{ sortOrder: 0, presentation: presentation }]
      });
    }
  });

  cards.forEach(function(c) {
    c.presentations.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
    c.presentations = c.presentations.map(function(p) { return p.presentation; });
  });

  // Pass 4 — attach the segment label, but only to the first card (by
  // Order) under each Session number, so it's never repeated.
  cards.sort(function(a, b) { return a.day - b.day || a.order - b.order; });
  const shownSegments = {};
  cards.forEach(function(c) {
    c.segmentLabel = '';
    c.segmentIntro = '';
    if (!c.sessionKey) return;
    const k = 'day' + c.day + '-' + c.sessionKey;
    if (shownSegments[k]) return;
    if (segmentLabelByKey[k]) {
      c.segmentLabel = segmentLabelByKey[k];
      c.segmentIntro = segmentIntroByKey[k] || '';
      shownSegments[k] = true;
    }
  });

  return cards;
}

function getReportAwards() {
  const ss = SpreadsheetApp.openById(getReportSheetId());

  const awardsSheet = ss.getSheetByName('AWARDS');
  const awards = [];
  let openingText = '';
  if (awardsSheet) {
    const data = awardsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const category = String(data[i][0] || '').trim();
      if (!category) continue;
      // A row with Category "Opening" carries a shared intro paragraph
      // (typed into the Announcement Text column) that's shown above the
      // winners grid, instead of being rendered as its own winner card.
      if (category.toLowerCase() === 'opening') {
        openingText = String(data[i][2] || '').trim();
        continue;
      }
      awards.push({
        category,
        winnerCompany: String(data[i][1] || '').trim(),
        announcementText: String(data[i][2] || '').trim(),
        photos: [data[i][3], data[i][4]].map(function(v) { return String(v || '').trim(); }).filter(Boolean).map(toDirectImageUrl),
        photoCaption: String(data[i][5] || '').trim(),
        judges: [],
        quotes: []
      });
    }
  }

  const judgesSheet = ss.getSheetByName('AWARDS_JUDGES');
  if (judgesSheet) {
    const data = judgesSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const category = String(data[i][0] || '').trim();
      if (!category) continue;
      const award = awards.find(function(a) { return a.category === category; });
      if (award) {
        award.judges.push({
          name: String(data[i][1] || '').trim(),
          title: String(data[i][2] || '').trim(),
          company: String(data[i][3] || '').trim()
        });
      }
    }
  }

  const quotesSheet = ss.getSheetByName('AWARDS_QUOTES');
  if (quotesSheet) {
    const data = quotesSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const winnerCompany = String(data[i][0] || '').trim();
      if (!winnerCompany) continue;
      const award = awards.find(function(a) { return a.winnerCompany === winnerCompany; });
      if (award) {
        award.quotes.push({
          quoteText: String(data[i][1] || '').trim(),
          quoteAuthorName: String(data[i][2] || '').trim(),
          quoteAuthorTitle: String(data[i][3] || '').trim()
        });
      }
    }
  }

  return { openingText: openingText, items: awards };
}

function getReportNetworkingSessions() {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sessionsSheet = ss.getSheetByName('NETWORKING_SESSIONS');
  const sessions = [];
  if (sessionsSheet) {
    const data = sessionsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][0] || '').trim();
      if (!id) continue;
      const focusBullets = String(data[i][4] || '').trim();
      sessions.push({
        id,
        type: String(data[i][1] || '').trim(),
        title: String(data[i][2] || '').trim(),
        coHostedWith: String(data[i][3] || '').trim(),
        focusBullets: focusBullets ? focusBullets.split('\n').map(function(s) { return s.trim(); }).filter(Boolean) : [],
        photos: [data[i][5], data[i][6], data[i][7], data[i][8]].map(function(v) { return String(v || '').trim(); }).filter(Boolean).map(toDirectImageUrl),
        articleUrl: String(data[i][9] || '').trim(),
        coHostLogo: String(data[i][10] || '').trim() ? toDirectImageUrl(String(data[i][10]).trim()) : '',
        participants: []
      });
    }
  }

  const participantsSheet = ss.getSheetByName('NETWORKING_PARTICIPANTS');
  if (participantsSheet) {
    const data = participantsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][0] || '').trim();
      if (!id) continue;
      const session = sessions.find(function(s) { return s.id === id; });
      if (session) {
        session.participants.push({
          title: String(data[i][1] || '').trim(),
          company: String(data[i][2] || '').trim()
        });
      }
    }
  }

  return sessions;
}

// Searchable past-participant directory — Title, Company, Classification only.
function getReportParticipants() {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sheet = ss.getSheetByName('PARTICIPANTS');
  const participants = [];
  if (!sheet) return participants;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const title = String(data[i][0] || '').trim();
    const company = String(data[i][1] || '').trim();
    if (!title && !company) continue;
    participants.push({
      title,
      company,
      classification: String(data[i][2] || '').trim()
    });
  }
  return participants;
}

function getReportTestimonials() {
  const ss = SpreadsheetApp.openById(getReportSheetId());
  const sheet = ss.getSheetByName('TESTIMONIALS');
  const testimonials = [];
  if (!sheet) return testimonials;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const quoteText = String(data[i][0] || '').trim();
    if (!quoteText) continue;
    testimonials.push({
      quoteText,
      name: String(data[i][1] || '').trim(),
      title: String(data[i][2] || '').trim(),
      company: String(data[i][3] || '').trim()
    });
  }
  return testimonials;
}

// getReport — cached 300s. One consolidated payload for the whole /report page.
function getReport() {
  return cachedGet('report', 300, function() {
    return {
      meta: getReportMeta(),
      stats: getReportStats(),
      sessions: getReportSessions(),
      awards: getReportAwards(),
      networkingSessions: getReportNetworkingSessions(),
      testimonials: getReportTestimonials(),
      participants: getReportParticipants(),
      sponsors: getSponsorsFromReportSheet()
    };
  });
}
