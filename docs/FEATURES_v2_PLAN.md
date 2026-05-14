# Colab Keepalive v2.0 — Feature Implementation Plan

## Executive Summary

This plan implements 8 user-facing features across 3 architectural layers (content script, service worker, popup) while maintaining the extension's privacy-first boundary: zero external network calls, minimal permissions, and no data leakage. Every feature has been critiqued against Chrome Web Store policies, Colab Terms of Service, MV3 constraints, storage quotas, and accessibility requirements.

**Version bump:** `1.0.0` → `2.0.0` (semver minor → major due to manifest permission addition and persistent data schema changes).

---

## 1. Pre-Implementation Audit & Constraints

### 1.1 Storage Quota Analysis

| Area                     | Quota                   | Current Usage        | v2 Headroom      | Risk |
| ------------------------ | ----------------------- | -------------------- | ---------------- | ---- |
| `chrome.storage.sync`    | 100 KB total, 8 KB/item | ~300 B (settings)    | ~99 KB remaining | Low  |
| `chrome.storage.local`   | 10 MB total             | ~0 B                 | ~10 MB           | None |
| `chrome.storage.session` | 10 MB total (in-memory) | ~2 KB (tab statuses) | ~10 MB           | None |

**Decision:** All lifetime stats and custom CSS themes **must** live in `chrome.storage.local`, not sync. A custom theme could easily exceed the 8 KB per-item sync limit. Settings stay in sync for cross-device portability.

### 1.2 Permission Impact Assessment

| Permission      | Current | v2 Change       | CWS Review Risk | Justification                                                                                               |
| --------------- | ------- | --------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `storage`       | Yes     | No change       | None            | Already required                                                                                            |
| `alarms`        | Yes     | No change       | None            | Already required                                                                                            |
| `notifications` | Yes     | No change       | None            | Already required                                                                                            |
| `contextMenus`  | No      | **Add**         | Low             | Required for Feature 5. Chrome docs explicitly state `"contextMenus"` permission is mandatory.              |
| `tabs`          | No      | **Keep absent** | N/A             | Feature 3 uses internal registry + `chrome.tabs.query({url})` which works with existing `host_permissions`. |
| `scripting`     | No      | Keep absent     | N/A             | Policy: never add.                                                                                          |
| `activeTab`     | No      | Keep absent     | N/A             | Policy: never add.                                                                                          |

**Decision:** Add only `"contextMenus"` to manifest permissions. No other permissions required.

### 1.3 Popup Size Architecture

Chrome extension popups have a hard limit of **800×600 px**. However, usability drops sharply above **400×500 px**. Current popup dimensions: **~350×420 px** (estimated from existing CSS).

Adding 8 feature control groups to the existing popup would push dimensions to **~350×850 px**, which:

- Exceeds practical usability limits
- Requires scrolling within a popup (awkward UX)
- May trigger Chrome's popup truncation on small displays

**Decision:** Implement a **tabbed popup interface** with 3 tabs:

- **Main**: Core controls (enable/disable, interval, humanization) + quick stats
- **Features**: Toggle grid for all 8 v2 features + per-feature quick config
- **Stats & Theme**: Lifetime stats, export/import, custom theme editor

Tab heights: ~350×480 px per tab. This keeps the popup compact while providing room for all controls.

### 1.4 Manifest Changes

```json
// manifest.json — additions only
{
  "manifest_version": 3,
  "version": "2.0.0",
  "permissions": ["storage", "alarms", "notifications", "contextMenus"]
  // ... rest unchanged
}
```

---

## 2. Feature Implementation Details

### 2.1 Feature 1: Humanization Strength Presets

**Status:** Low risk, UI-only change.

**Problem:** Current slider (±0–100%) is abstract. Users don't know what values to pick.

**Solution:** Map 4 named presets to concrete ranges, preserving the slider for fine-tuning.

| Preset   | Jitter Range | Wait Range | Description         |
| -------- | ------------ | ---------- | ------------------- |
| `subtle` | ±2%          | 0–5s       | Barely noticeable   |
| `normal` | ±5%          | 0–10s      | Recommended default |
| `strong` | ±10%         | 0–20s      | Clearly irregular   |
| `max`    | ±20%         | 0–30s      | Maximum variance    |

**Files modified:**

**`shared.js`** (line ~72, after DEFAULT_SETTINGS):

```javascript
const HUMANIZATION_PRESETS = {
  subtle: { jitterPercent: 2, waitMax: 5000 },
  normal: { jitterPercent: 5, waitMax: 10000 },
  strong: { jitterPercent: 10, waitMax: 20000 },
  max: { jitterPercent: 20, waitMax: 30000 },
};
```

**`popup.html`** (line ~35, inside #controls):
Add a `<select id="humanization-preset">` with 4 `<option>` elements.

**`popup.js`** (line ~95, inside render()):
Add event listener: on preset change, update `humanization.jitterPercent` and `humanization.waitMax` in settings, then call `applySettings()`.

**`popup.css`** (line ~50):
Add `.preset-select { width: 100%; margin-bottom: 8px; }`.

**Edge cases:**

- User selects preset then manually adjusts slider → preset dropdown shows "custom" (add a 5th option)
- Settings loaded from sync don't have `humanizationPreset` field → default to `normal`, migrate on load

**Testing:**

1. Select each preset, verify slider values update
2. Manually move slider, verify dropdown switches to "custom"
3. Reload popup, verify last selection persists
4. Verify preset values match the table above

---

### 2.2 Feature 2: Next Click Countdown Timer

**Status:** Low risk, content script enhancement.

**Problem:** Users don't know when the next keepalive click will happen.

**Solution:** Inject a small, dismissible countdown overlay into the Colab page.

**Files modified:**

**`shared.js`** — Add to MESSAGE_TYPES:

```javascript
CKA_COUNTDOWN_UPDATE: "CKA_COUNTDOWN_UPDATE",
```

Add to DEFAULT_SETTINGS (line ~45):

```javascript
showCountdown: false,
countdownPosition: "bottom-right", // "top-left", "top-right", "bottom-left", "bottom-right"
```

**`content.js`** (line ~215, inside tick()):
After computing `nextDelay`, if `settings.showCountdown` is true, update or create a countdown DOM element showing `Math.ceil(nextDelay / 1000)` seconds. Update it every second via a secondary `setInterval` (separate from main `setTimeout` to avoid interfering with jitter logic).

**`content.js`** (new function, line ~300):

```javascript
function createCountdownOverlay(position) {
  // Create a <div> with fixed positioning
  // Position based on countdownPosition setting
  // Style: semi-transparent background, small font, z-index: 9999
  // Content: "Next click: Ns"
  // Add a small X button to dismiss (sets a session flag)
}
```

**`content.js`** (cleanup, line ~180, stopKeepAlive()):
Remove countdown overlay from DOM.

**`popup.html`** (line ~60, inside settings form):
Add checkbox: `<label><input type="checkbox" id="show-countdown"> Show countdown timer</label>`
Add position select: 4-corner dropdown.

**`popup.js`** (line ~110, inside event listeners):
Bind `showCountdown` and `countdownPosition` to settings.

**`popup.css`**:
No changes needed (standard form controls).

**Edge cases:**

- User dismisses countdown via X → store dismissal in `sessionStorage` only (per-tab, resets on reload)
- Colab page has its own elements at z-index 9999 → use z-index: 2147483647 (max safe)
- Timer shows negative during jitter wait → clamp to 0, show "Clicking..."
- Extension disabled while countdown visible → countdown must disappear immediately

**Testing:**

1. Enable countdown, verify overlay appears
2. Verify countdown decrements every second
3. Verify position changes with dropdown
4. Verify X button dismisses it for that tab session
5. Verify disabling extension removes overlay
6. Verify overlay doesn't interfere with Colab UI clicks

---

### 2.3 Feature 3: Multi-Tab Coordination

**Status:** Medium risk. Requires careful message routing to avoid broadcast storms.

**Problem:** Extension only works on one Colab tab at a time. Users running multiple notebooks need per-tab control.

**Solution:** Track active tabs in an internal registry. Allow users to enable/disable individual tabs from the popup.

**Architecture decision:** Use `chrome.storage.session` for tab registry (volatile, resets on browser restart) to avoid sync bloat. Use `chrome.tabs.query({url: "*://colab.research.google.com/*"})` to discover tabs (no extra permissions needed — uses existing host_permissions).

**Files modified:**

**`shared.js`** — Add to MESSAGE_TYPES:

```javascript
CKA_TAB_REGISTRY_UPDATE: "CKA_TAB_REGISTRY_UPDATE",
CKA_TOGGLE_TAB: "CKA_TOGGLE_TAB",
```

Add to DEFAULT_SETTINGS:

```javascript
multiTabMode: false,
```

**`background.js`** (new section, line ~180):

```javascript
// Tab registry: Map<tabId, {enabled: boolean, url: string, lastSeen: timestamp}>
// Stored in memory only (service worker global), not persisted.
// Rebuild on service worker startup via chrome.tabs.query.

async function rebuildTabRegistry() {
  const tabs = await chrome.tabs.query({ url: COLAB_URL_PATTERNS });
  // ... populate registry, send CKA_TAB_REGISTRY_UPDATE to popup
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isColabUrl(changeInfo.url)) {
    registry.set(tabId, { enabled: false, url: tab.url, lastSeen: Date.now() });
    broadcastRegistryUpdate();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  registry.delete(tabId);
  broadcastRegistryUpdate();
});
```

**`background.js`** (message handler, line ~210):
Add handler for `CKA_TOGGLE_TAB`: lookup tab, toggle `enabled`, send `CKA_APPLY_SETTINGS` to that tab's content script.

**`content.js`** (line ~60, startKeepAlive):
Before starting, check if another tab is already active in registry. If `multiTabMode` is false and another tab is enabled, show a warning notification: "Keepalive is active on another tab. Enable multi-tab mode to run on multiple tabs."

**`popup.html`** (new tab or section):
Add a "Multi-Tab" section with:

- Toggle: "Enable multi-tab mode"
- List of detected Colab tabs (title + URL truncated)
- Per-tab enable/disable toggle
- Visual indicator: green dot = active, gray = inactive

**`popup.js`** (line ~130):
Add `renderTabList()` function. Listen for `CKA_TAB_REGISTRY_UPDATE` messages from background. Update DOM list dynamically.

**`popup.css`**:
Add tab list styling: flex row with title, URL, and toggle switch.

**Edge cases:**

- Service worker restarts → registry lost → rebuild via `rebuildTabRegistry()` on startup
- 20+ Colab tabs open → list becomes long → add `max-height: 200px; overflow-y: auto`
- User closes popup while toggling → toggle must be atomic and self-contained
- Tab navigates away from Colab → `tabs.onUpdated` detects, removes from registry
- Extension reloaded mid-session → all content scripts lose state → on reconnect, they re-register

**Performance note:** `chrome.tabs.query()` on every popup open is cheap (<1ms for <100 tabs). No polling needed.

**Testing:**

1. Open 3 Colab tabs, verify all appear in popup list
2. Enable tab 1, verify tab 2 shows warning when trying to enable (multi-tab off)
3. Enable multi-tab mode, verify both can be active
4. Close a tab, verify it disappears from list
5. Reload extension, verify registry rebuilds correctly
6. Test with 10+ tabs, verify scroll behavior

---

### 2.4 Feature 4: Click Statistics & Lifetime Stats

**Status:** Medium risk. Storage write frequency must be throttled.

**Problem:** Users don't know how many times the extension has clicked or how long it has been running.

**Solution:** Track per-session and lifetime stats. Display in popup. Exportable.

**Storage strategy:**

- **Per-session stats** (clicks this session, session start time): `chrome.storage.session` (resets on extension reload)
- **Lifetime stats** (total clicks, total runtime, longest session): `chrome.storage.local` (persists until extension uninstalled)
- **Daily/weekly aggregation** (for export charts): `chrome.storage.local` under key `statsHistory`

**Data schema:**

```javascript
// chrome.storage.local
{
  "statsLifetime": {
    "totalClicks": 0,
    "totalRuntimeMs": 0,
    "longestSessionMs": 0,
    "sessionsCount": 0,
    "firstUsed": "2026-01-15T10:00:00Z"
  },
  "statsHistory": {
    "daily": { "2026-01-15": { clicks: 45, runtimeMs: 3600000 } },
    "weekly": { "2026-W03": { clicks: 120, runtimeMs: 10800000 } }
  }
}
```

**Files modified:**

**`shared.js`** — Add to MESSAGE_TYPES:

```javascript
CKA_STATS_UPDATE: "CKA_STATS_UPDATE",
```

**`content.js`** (line ~220, inside tick()):
After a successful click, send `CKA_STATS_UPDATE` to background with `{type: "click", timestamp: Date.now()}`.

**`content.js`** (line ~170, startKeepAlive):
Send `CKA_STATS_UPDATE` with `{type: "session_start", timestamp: Date.now()}`.

**`content.js`** (line ~185, stopKeepAlive):
Send `CKA_STATS_UPDATE` with `{type: "session_end", timestamp: Date.now(), durationMs: ...}`.

**`background.js`** (new handler, line ~220):

```javascript
async function handleStatsUpdate(message) {
  // Read current stats from chrome.storage.local
  // Update in-memory cache (don't write to storage yet)
  // Flush to storage every 60 seconds or on session_end
}

// Flush timer
setInterval(flushStatsToStorage, 60000);
```

**Performance justification:** Writing to `chrome.storage.local` on every click (every ~60s) is acceptable, but flushing every 60s is safer and reduces I/O. If service worker restarts, in-memory cache is lost, but worst case we lose <60s of stats — acceptable tradeoff.

**`popup.html`** (new "Stats" tab):

- Lifetime: total clicks, total runtime (formatted as "3h 12m"), sessions count, longest session
- Current session: clicks this session, session duration (live-updating)
- 7-day mini chart (simple CSS bar chart, no external libraries)

**`popup.js`** (line ~150):
Add `renderStats()` function. Listen for `CKA_STATS_UPDATE` to refresh current session numbers live.

**`popup.css`**:
Add stats grid styling, bar chart styling with CSS flex.

**Edge cases:**

- Storage quota exceeded (10MB) → highly unlikely (stats are tiny), but handle by pruning oldest daily history entries
- Service worker restart during session → session stats lost → content script re-sends session_start on reconnect
- User clears browser data → `chrome.storage.local` cleared → stats reset. This is acceptable (privacy feature).
- Date line changes mid-session → ensure daily bucket uses UTC date to avoid timezone issues

**Testing:**

1. Run for 5 minutes, verify stats increment correctly
2. Verify lifetime stats persist across popup reopens
3. Verify session stats reset on extension reload
4. Verify daily aggregation bucket is correct
5. Verify long runtime formats correctly (e.g., "47h 32m")

---

### 2.5 Feature 5: Right-Click Context Menu

**Status:** Low risk. Well-documented MV3 API.

**Problem:** Users must open the popup to toggle the extension.

**Solution:** Add a context menu item on Colab pages for quick toggle.

**Files modified:**

**`manifest.json`** (line ~12, permissions array):
Add `"contextMenus"`.

**`background.js`** (new section, line ~250):

```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cka-toggle",
    title: "Toggle Colab Keepalive",
    contexts: ["page"],
    documentUrlPatterns: COLAB_URL_PATTERNS,
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "cka-toggle") {
    const settings = await getSettings();
    const newEnabled = !settings.enabled;
    await saveSettings({ ...settings, enabled: newEnabled });
    await broadcastSettingsUpdate();
    // Optional: show notification confirming state change
  }
});
```

**Edge cases:**

- User right-clicks on non-Colab page → menu item hidden (via `documentUrlPatterns`)
- Extension updated → `onInstalled` fires again → `create()` may throw if ID exists → wrap in try/catch or use `chrome.contextMenus.update`
- Service worker restarts → context menu persists (created once on install)
- User disables extension via popup while context menu is open → next click uses stale state, but that's a race condition inherent to all context menus

**Testing:**

1. Right-click on Colab page, verify "Toggle Colab Keepalive" appears
2. Click it, verify extension state toggles
3. Right-click on google.com, verify menu item is absent
4. Verify menu title updates to reflect current state (optional enhancement)

---

### 2.6 Feature 6: Smart Scheduling (Work Hours)

**Status:** Medium risk. Timezone handling is tricky.

**Problem:** Extension runs 24/7 even when user is away.

**Solution:** Allow users to define "active hours" (e.g., 9 AM – 6 PM) and days of week. Outside these windows, extension pauses automatically.

**Settings schema:**

```javascript
schedule: {
  enabled: false,
  startTime: "09:00", // 24-hour format, local time
  endTime: "18:00",
  days: [1, 2, 3, 4, 5], // 0=Sun, 6=Sat
  timezone: "auto", // "auto" uses browser timezone, or explicit IANA string
}
```

**Files modified:**

**`shared.js`** — Add to DEFAULT_SETTINGS:

```javascript
schedule: {
  enabled: false,
  startTime: "09:00",
  endTime: "18:00",
  days: [1, 2, 3, 4, 5],
  timezone: "auto",
},
```

Add validation function:

```javascript
function isWithinSchedule(schedule) {
  if (!schedule.enabled) return true;
  const now = new Date();
  const tz =
    schedule.timezone === "auto"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : schedule.timezone;

  // Use Intl.DateTimeFormat to get local day/hour/minute in target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "numeric", // 1=Sun in JS Date, but we need to check
  });
  // ... parse and compare
}
```

**`content.js`** (line ~140, inside shouldRun() or equivalent):
Before starting a tick, call `isWithinSchedule(settings.schedule)`. If false, skip tick and schedule next check at start of next active window.

**`background.js`** (optional enhancement):
Set a `chrome.alarms` alarm for the next schedule boundary (start or end of active window) to wake up the service worker and broadcast state changes.

**`popup.html`** (new section in "Features" tab):

- Toggle: "Enable work schedule"
- Time inputs: `<input type="time">` for start and end
- Day checkboxes: M T W T F S S
- Timezone select: "Auto-detect" + common IANA zones (UTC, America/New_York, Europe/London, Asia/Tokyo)

**`popup.js`** (line ~170):
Bind schedule controls. Validate that startTime < endTime (or allow overnight shifts like 22:00–06:00).

**Edge cases:**

- Overnight schedule (22:00–06:00) → logic must handle wraparound
- Daylight Saving Time transition → `Intl.DateTimeFormat` handles this automatically
- User in timezone without DST → still works
- Browser timezone changes (travel) → if "auto", updates on next check; if explicit, stays fixed
- Schedule boundary exactly at tick time → inclusive of start, exclusive of end (or vice versa — document clearly)
- All days unchecked → treat as no active days (extension never runs)

**Testing:**

1. Set schedule to current time ±1 hour, verify extension pauses/resumes correctly
2. Test overnight schedule (e.g., 23:00–01:00)
3. Test with timezone set to different region
4. Test DST transition day
5. Verify popup shows correct "next active" time when paused

---

### 2.7 Feature 7: Customizable Target Picker

**Status:** HIGH RISK. User-provided selectors executed via `document.querySelector()` is a self-XSS vector.

**Problem:** Colab may change button selectors. Users want to override or add custom targets.

**Solution:** Allow users to define custom CSS selectors. Validate them strictly before execution.

**Security analysis:**

| Threat            | Vector                                                                      | Mitigation                                                                                               |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Self-XSS          | User enters `body > script[src="evil.com"]`                                 | Reject selectors containing `script`, `javascript:`, `data:`, or `src` attributes                        |
| Clickjacking      | Selector matches hidden overlay                                             | Verify element is visible (`offsetParent !== null`, `getBoundingClientRect().width > 0`) before clicking |
| DoS               | Selector matches 1000+ elements                                             | Reject if `document.querySelectorAll()` returns >1 element (we only want unique targets)                 |
| Data exfiltration | Selector reads attributes and sends them... wait, no network calls allowed. | Not applicable due to extension's zero-network architecture                                              |

**Selector validation rules:**

1. Must be a valid CSS selector (test with `document.querySelector()` in a try/catch)
2. Must not contain `script`, `javascript:`, `data:`, `expression`, `eval(`, `@import`
3. Must match exactly 1 element (`.length === 1`)
4. Matched element must be a `<button>`, `<div>` with `role="button"`, or `<span>` with `role="button"`
5. Element must be visible (non-zero bounding rect)
6. Element must be within the Colab page (not inside an iframe from a different origin)

**Files modified:**

**`shared.js`** — Add to DEFAULT_SETTINGS:

```javascript
customTargets: [],
// Array of { id: string, selector: string, label: string, enabled: boolean }
```

Add validation function:

```javascript
function validateCustomTarget(selector) {
  const errors = [];
  if (!selector || typeof selector !== "string")
    errors.push("Selector is required");
  if (selector.length > 200) errors.push("Selector too long (max 200 chars)");
  if (/script|javascript:|data:|expression|eval\(|@import/i.test(selector)) {
    errors.push("Selector contains forbidden patterns");
  }
  return errors;
}
```

**`content.js`** (line ~90, findConnectButton):

```javascript
function findConnectButton() {
  // 1. Try custom targets first (enabled ones, in order)
  for (const target of settings.customTargets.filter((t) => t.enabled)) {
    try {
      const el = document.querySelector(target.selector);
      if (el && isValidTarget(el)) return el;
    } catch (e) {
      console.warn(`[Colab-Keepalive] Invalid selector: ${target.selector}`);
    }
  }
  // 2. Fall back to built-in selectors
  // ... existing logic
}

function isValidTarget(el) {
  if (!el.offsetParent) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  if (tag === "button" || role === "button") return true;
  return false;
}
```

**`popup.html`** (new section in "Features" tab):

- List of custom targets (selector + label + enabled toggle + delete button)
- "Add target" button → opens inline form with selector input and label input
- "Test" button next to each target → sends `CKA_TEST_CLICK` message to content script

**`popup.js`** (line ~190):
Add target management functions. Validate selector on add (using a lightweight regex check in popup, full validation in content script).

**`popup.css`**:
Add target list styling, inline form styling.

**Edge cases:**

- User adds invalid selector → show inline error, don't save
- Custom target stops matching (Colab UI changes) → extension falls back to built-in selectors automatically
- User adds 20+ custom targets → cap at 10 to avoid performance issues
- Two custom targets match the same element → first one wins
- Built-in selectors also match → custom targets take priority

**Testing:**

1. Add a valid selector for a real Colab button, verify it works
2. Add invalid selector, verify error shown and not saved
3. Test "Test" button, verify content script attempts click and reports success/failure
4. Disable all custom targets, verify built-in selectors still work
5. Verify target list persists across popup reopens

---

### 2.8 Feature 8: Custom Theme Support

**Status:** Medium risk. CSS injection requires strict sanitization.

**Problem:** Users want to customize the popup appearance.

**Solution:** Allow custom CSS that only affects the popup. Validate/sanitize input strictly.

**Storage:** `chrome.storage.local` under key `customThemeCss`.

**CSS sanitization rules (whitelist approach):**

1. Parse CSS text into rules using a lightweight parser (or regex-based split)
2. Reject any rule containing:
   - `url(` (prevents loading external images/fonts)
   - `@import` (prevents loading external stylesheets)
   - `@font-face` (prevents font loading)
   - `behavior:` (IE expression vector)
   - `-moz-binding:` (XBL vector)
   - `javascript:` (protocol handler)
   - `expression(` (IE CSS expression)
   - `eval(`
3. Reject selectors that target outside popup:
   - `body` (acceptable, only affects popup body)
   - `html` (acceptable)
   - Any selector starting with `*` or without proper scoping is fine since popup is isolated
4. Reject `position: fixed` or `position: absolute` with coordinates that could escape popup (e.g., `top: -9999px`)
5. Cap total CSS length at 5000 characters

**Files modified:**

**`shared.js`** — Add to DEFAULT_SETTINGS:

```javascript
customThemeEnabled: false,
```

Add sanitization function:

```javascript
function sanitizeCustomCss(css) {
  if (!css || typeof css !== "string") return "";
  if (css.length > 5000) throw new Error("CSS too long (max 5000 chars)");

  const forbidden =
    /url\(|@import|@font-face|behavior:\s*|-moz-binding:|javascript:|expression\(|eval\(/gi;
  if (forbidden.test(css)) throw new Error("CSS contains forbidden patterns");

  // Additional: reject absolute positioning tricks
  const absoluteTrick =
    /position:\s*(fixed|absolute)\s*;\s*[a-z-]+:\s*-?\d{4,}/gi;
  if (absoluteTrick.test(css))
    throw new Error("CSS contains suspicious positioning");

  return css.trim();
}
```

**`popup.html`** (new section in "Stats & Theme" tab):

- Toggle: "Enable custom theme"
- `<textarea>` for CSS input (rows=10)
- Live preview: apply sanitized CSS to a preview `<iframe>` or a preview `<div>`
- "Reset to default" button

**`popup.js`** (line ~210):
On popup load, if `customThemeEnabled` and `customThemeCss` exist, inject CSS into popup `<head>` via `<style id="cka-custom-theme">`. Update on change.

**`popup.css`**:
No changes needed (custom theme overrides).

**Edge cases:**

- Invalid CSS syntax → browser ignores invalid rules, no crash
- CSS breaks popup layout → user can disable via options page (add fallback link)
- CSS references popup element IDs that don't exist → harmless
- User enters empty CSS → treat as disabled

**Testing:**

1. Enter valid CSS (e.g., `body { background: #333; color: white; }`), verify popup updates
2. Enter forbidden pattern (e.g., `url(...)`), verify error and rejection
3. Enter too-long CSS (>5000 chars), verify error
4. Disable theme, verify popup reverts to default
5. Verify theme persists across popup reopens

---

### 2.9 Feature 9: Export/Import Settings

**Status:** Low risk. JSON serialization/deserialization.

**Problem:** Users want to backup or share settings across devices without using Chrome Sync.

**Solution:** Export settings + stats to JSON file. Import from JSON file.

**Export schema (v2):**

```json
{
  "version": "2.0.0",
  "exportedAt": "2026-01-15T10:00:00Z",
  "settings": {
    /* full settings object */
  },
  "statsLifetime": {
    /* lifetime stats */
  },
  "customThemeCss": "/* optional */"
}
```

**Import validation:**

1. Parse JSON → catch SyntaxError
2. Validate `version` is a known version (≥ 1.0.0)
3. Validate settings using existing `validateSettings()`
4. Validate `statsLifetime` has expected keys (optional — can skip if missing)
5. Validate `customThemeCss` using `sanitizeCustomCss()`
6. Warn if importing stats would overwrite existing stats (show confirmation)
7. Warn if importing from older version (may have missing fields)

**Files modified:**

**`shared.js`** — Add to MESSAGE_TYPES:

```javascript
CKA_EXPORT_SETTINGS: "CKA_EXPORT_SETTINGS",
CKA_IMPORT_SETTINGS: "CKA_IMPORT_SETTINGS",
```

**`popup.html`** (new section in "Stats & Theme" tab):

- "Export settings" button → triggers download of `.json` file
- "Import settings" button → `<input type="file" accept=".json">`
- Import status: success/warning/error message area

**`popup.js`** (line ~230):

```javascript
document.getElementById("export-btn").addEventListener("click", async () => {
  const settings = await getSettings();
  const stats = await chrome.storage.local.get([
    "statsLifetime",
    "customThemeCss",
  ]);
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: chrome.runtime.getManifest().version,
          exportedAt: new Date().toISOString(),
          settings,
          ...stats,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `colab-keepalive-settings-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
```

**`popup.js`** (import):

```javascript
document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showError("Invalid JSON");
    return;
  }

  if (!data.version || !data.settings) {
    showError("Invalid export file");
    return;
  }

  const errors = validateSettings(data.settings);
  if (errors.length) {
    showError(`Invalid settings: ${errors.join(", ")}`);
    return;
  }

  if (data.customThemeCss) {
    try {
      sanitizeCustomCss(data.customThemeCss);
    } catch (e) {
      showError(e.message);
      return;
    }
  }

  // Confirm overwrite
  await saveSettings(data.settings);
  if (data.statsLifetime)
    await chrome.storage.local.set({ statsLifetime: data.statsLifetime });
  if (data.customThemeCss)
    await chrome.storage.local.set({ customThemeCss: data.customThemeCss });
  showSuccess("Settings imported successfully");
});
```

**Edge cases:**

- User imports v1.0 settings → missing v2 fields → apply defaults via `validateSettings()`
- User imports corrupted JSON → show clear error
- User imports settings with invalid types → caught by validator
- User imports file >1MB → could be malicious → cap file size at 100KB
- Import overwrites current settings without confirmation → add confirmation dialog
- Browser blocks downloads from popup → use `URL.createObjectURL` + `<a>` click (works in popups)

**Testing:**

1. Export settings, verify JSON file downloads with correct content
2. Import valid JSON, verify settings apply
3. Import corrupted JSON, verify error
4. Import v1.0 settings, verify v2 defaults applied
5. Import file with oversized CSS, verify rejection
6. Verify export includes stats and theme

---

## 3. Data Flow Diagrams

### 3.1 Settings Change Flow

```
User changes setting in popup
  → popup.js calls saveSettings()
  → chrome.storage.sync updated
  → chrome.storage.onChanged fires in background.js
  → background.js sends CKA_SETTINGS_UPDATED to all Colab tabs
  → content.js receives message, updates local settings object
  → content.js adjusts behavior (e.g., starts/stops timer, updates countdown)
```

### 3.2 Stats Collection Flow

```
Content script ticks / clicks
  → sends CKA_STATS_UPDATE to background.js
  → background.js accumulates in memory
  → every 60s (or on session_end), flushes to chrome.storage.local
  → popup reads from chrome.storage.local on render
```

### 3.3 Multi-Tab Coordination Flow

```
Tab opens to Colab URL
  → chrome.tabs.onUpdated fires in background.js
  → background.js adds tab to registry
  → popup requests registry via CKA_GET_STATUS
  → background.js sends CKA_TAB_REGISTRY_UPDATE
  → popup renders tab list

User toggles tab in popup
  → popup sends CKA_TOGGLE_TAB to background.js
  → background.js updates registry, sends CKA_APPLY_SETTINGS to that tab
  → content script starts/stops accordingly
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

| Module                             | Test Cases                                                                                      | Priority |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `shared.js:validateSettings()`     | Valid settings pass; invalid interval rejected; negative waitMax rejected; unknown keys ignored | High     |
| `shared.js:buildResponse()`        | All success/error shapes match protocol spec                                                    | High     |
| `shared.js:isWithinSchedule()`     | Active hours pass; inactive hours fail; overnight schedule works; DST transition correct        | High     |
| `shared.js:validateCustomTarget()` | Valid selector passes; forbidden patterns rejected; long selector rejected                      | High     |
| `shared.js:sanitizeCustomCss()`    | Valid CSS passes; forbidden patterns rejected; long CSS rejected                                | High     |
| `shared.js:HUMANIZATION_PRESETS`   | Each preset maps to correct values                                                              | Medium   |

### 4.2 Integration Tests

| Scenario                        | Steps                                                         | Expected |
| ------------------------------- | ------------------------------------------------------------- | -------- |
| Full enable/disable cycle       | Enable → wait for click → disable → verify no more clicks     | High     |
| Settings persist across reloads | Change settings → reload extension → verify settings restored | High     |
| Multi-tab coordination          | Enable tab 1 → enable tab 2 (multi-tab off) → verify warning  | High     |
| Context menu toggle             | Right-click → toggle → verify state changes                   | Medium   |
| Stats accumulation              | Run for 2 intervals → verify stats show 2 clicks              | Medium   |
| Schedule pausing                | Set schedule outside current time → verify extension pauses   | Medium   |
| Custom target click             | Add valid selector → verify element clicked                   | Medium   |
| Theme application               | Enable custom theme → verify styles applied                   | Low      |
| Export/import roundtrip         | Export → clear settings → import → verify restored            | Medium   |

### 4.3 Manual QA Checklist

- [ ] All features work on Colab free tier
- [ ] All features work on Colab Pro
- [ ] Popup renders correctly at 320×400 (minimum reasonable size)
- [ ] Popup renders correctly at 800×600 (maximum)
- [ ] Extension works after browser restart
- [ ] Extension works after service worker restart (chrome://serviceworker-internals/)
- [ ] Context menu appears only on Colab pages
- [ ] No console errors in content script during normal operation
- [ ] No console errors in popup during normal operation
- [ ] No console errors in background during normal operation
- [ ] Settings sync across Chrome profiles (if sync enabled)
- [ ] Extension icon badge updates correctly for multiple tabs

---

## 5. Migration & Compatibility

### 5.1 Settings Migration

Existing users have settings in `chrome.storage.sync` without v2 fields. On load:

```javascript
// In getSettings():
const stored = await chrome.storage.sync.get("settings");
const merged = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
// v1 settings will merge correctly because field names haven't changed
// New v2 fields (showCountdown, multiTabMode, schedule, etc.) will use defaults
```

This is backward-compatible because:

- All v1 fields exist unchanged in v2 DEFAULT_SETTINGS
- New v2 fields have sensible defaults that don't break v1 behavior
- `customTargets` defaults to `[]` (no custom targets, built-in selectors still work)
- `schedule.enabled` defaults to `false` (no schedule restriction)

### 5.2 Stats Migration

v1 users have no stats. On first v2 run:

- `statsLifetime` is created with defaults (all zeros, `firstUsed` = now)
- No migration needed

---

## 6. Rollout & Versioning

### 6.1 Version Strategy

- **v2.0.0-alpha**: Internal testing. All 8 features implemented.
- **v2.0.0-beta**: Limited release (10–20 users). Gather feedback on UX.
- **v2.0.0**: Public release. Includes all features, docs updated.

### 6.2 Risk Mitigation

| Risk                                              | Impact | Mitigation                                         |
| ------------------------------------------------- | ------ | -------------------------------------------------- |
| Custom target picker breaks on Colab UI update    | High   | Fallback to built-in selectors always works        |
| Stats storage fills up                            | Low    | Cap daily history to 365 days; total size <50KB    |
| Context menu permission triggers CWS review delay | Medium | Submit early; permission is well-justified         |
| Popup becomes too complex                         | Medium | Tabbed interface keeps each view simple            |
| Service worker restart loses registry             | Medium | Registry rebuilds automatically on startup         |
| Schedule timezone bugs                            | Low    | Use `Intl.DateTimeFormat`, well-tested browser API |

---

## 7. Implementation Order

| Order | Feature                   | Effort | Risk   | Rationale                                     |
| ----- | ------------------------- | ------ | ------ | --------------------------------------------- |
| 1     | Humanization Presets (F1) | Small  | Low    | Simple UI change, builds foundation           |
| 2     | Countdown Timer (F2)      | Small  | Low    | Content script only, isolated                 |
| 3     | Context Menu (F5)         | Small  | Low    | Standalone background feature                 |
| 4     | Stats (F4)                | Medium | Medium | Requires storage architecture, flush logic    |
| 5     | Export/Import (F9)        | Medium | Low    | Builds on stats, isolated                     |
| 6     | Smart Schedule (F6)       | Medium | Medium | Time logic is tricky, test thoroughly         |
| 7     | Multi-Tab (F3)            | Large  | Medium | Complex coordination, registry management     |
| 8     | Target Picker (F7)        | Large  | High   | Security-critical, needs extensive validation |
| 9     | Custom Theme (F8)         | Medium | Medium | CSS sanitization must be bulletproof          |
| 10    | Popup Tabbed UI           | Medium | Medium | Required before features 4–9 are usable       |

**Note:** The popup tabbed interface should be implemented after F1–F3 (which fit in current popup) but before F4–F9 (which require the extra space).

---

## 8. Files Changed Summary

| File                       | Lines Added | Lines Modified | Description                                                                                    |
| -------------------------- | ----------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `manifest.json`            | +2          | 0              | Add `"contextMenus"` permission, bump version to `"2.0.0"`                                     |
| `shared.js`                | +180        | +15            | New constants (presets, message types, schedule validation, CSS sanitizer, target validator)   |
| `background.js`            | +120        | +10            | Context menu setup, tab registry, stats flush, schedule alarms                                 |
| `content.js`               | +150        | +20            | Countdown overlay, custom target resolution, schedule check, stats messages                    |
| `popup.html`               | +200        | +30            | Tabbed layout, all new feature controls, stats display, theme textarea                         |
| `popup.js`                 | +280        | +40            | Tab switching, preset logic, tab list rendering, stats display, import/export, theme injection |
| `popup.css`                | +150        | +20            | Tab styles, stats grid, target list, theme preview, scrollbar styling                          |
| `docs/FEATURES_v2_PLAN.md` | +800        | 0              | This plan document                                                                             |

**Estimated total:** ~1,080 lines added, ~115 lines modified across 6 source files.

---

## 9. Accessibility Considerations

- All new interactive elements must have `aria-label` or visible text labels
- Tab buttons must have `role="tab"`, `aria-selected`, and `aria-controls`
- Color contrast for stats charts: use only colors that meet WCAG AA (4.5:1) against popup background
- Custom theme CSS must not override focus indicators (warn users in UI)
- Countdown overlay must not trap focus (it's informational only)
- All form inputs must have associated `<label>` elements

---

## 10. Post-Implementation Checklist

- [ ] All 8 features implemented and manually tested
- [ ] Unit tests pass for all `shared.js` validation functions
- [ ] Integration tests pass for critical paths
- [ ] Manifest version bumped to `2.0.0`
- [ ] `README.md` updated with v2 feature list
- [ ] `AGENTS.md` updated with new message types and conventions
- [ ] Chrome Web Store screenshots updated to show new popup UI
- [ ] Extension submitted to CWS for review (contextMenus permission may require additional justification)
- [ ] Analytics/telemetry: none added (maintain privacy boundary)

---

_Plan generated: 2026-01-15_
_Status: Awaiting implementation approval_
