# Colab Keepalive — Fix Plan

## Overview

Apply all review findings from the honest-review, simplify, and convention checks. This plan covers **4 P1 correctness bugs**, **4 P2 design issues**, and **6 P3 simplifications** across `shared.js`, `content.js`, `background.js`, and `popup.js`. All changes are behavior-preserving except where they fix incorrect behavior.

## Phase 1: Critical Correctness Fixes (P1)

### 1.1 Fix broken notification icon path

- **File:** `background.js:576`
- **Current:** `iconUrl: options.iconUrl || chrome.runtime.getURL("icons/icon128.png")`
- **Fix:** `iconUrl: options.iconUrl || chrome.runtime.getURL("icons/icon-128.png")`
- **Rationale:** The generated icon files use hyphenated names (`icon-128.png`), not `icon128.png`. The manifest also references `icons/icon-128.png`. Without this fix, browser notifications show a broken image on all platforms.

### 1.2 Fix `KeyboardEvent.code` values in synthetic events

- **File:** `content.js:598-604`
- **Current:** `new KeyboardEvent(type, { bubbles: true, cancelable: true, key, code: key, ... })` where `key` is `"a"`, `"s"`, `"d"`, `"w"`, `" "`, or `"Enter"`
- **Fix:** Map `key` to proper `code` values:
  ```js
  const KEY_TO_CODE = {
    a: "KeyA",
    s: "KeyS",
    d: "KeyD",
    w: "KeyW",
    " ": "Space",
    Enter: "Enter",
  };
  // Then pass code: KEY_TO_CODE[key] || key
  ```
- **Rationale:** The `code` property of `KeyboardEvent` must be a physical key code (e.g., `"KeyA"`), not the character `"a"`. While Colab may not strictly check this, it is incorrect DOM API usage and could break if Colab adds stricter event validation.

### 1.3 Fix uptime aggregation to sum instead of max

- **File:** `background.js:614-624`
- **Current:**
  ```js
  let totalMs = 0;
  for (const status of Object.values(statuses)) {
    if (status?.uptimeMs && typeof status.uptimeMs === "number") {
      totalMs = Math.max(totalMs, status.uptimeMs);
    }
  }
  totalMs = Math.max(totalMs, persisted.totalUptimeMs || 0);
  ```
- **Fix:**
  ```js
  let totalMs = 0;
  for (const status of Object.values(statuses)) {
    if (status?.uptimeMs && typeof status.uptimeMs === "number") {
      totalMs += status.uptimeMs;
    }
  }
  totalMs += persisted.totalUptimeMs || 0;
  ```
- **Rationale:** The function is named `getAggregateUptime` and the return key is `totalUptimeMs`, both implying summation. Using `Math.max` returns the single largest tab uptime, which is misleading when multiple Colab tabs are open.

### 1.4 Remove dead code `computeJitteredInterval` from shared.js

- **File:** `shared.js:242-247`
- **Current:** Exported function `computeJitteredInterval(baseSeconds, jitterRatio)` is never imported.
- **Fix:** Delete the function.
- **Rationale:** Pure dead code. The content script computes jitter inline in `startActivitySimulation`.

## Phase 2: Design Improvements (P2)

### 2.1 Remove duplicate `formatUptime` from content.js

- **File:** `content.js:640-669`
- **Current:** Local `formatUptime` and `getUptime` functions exist but are unused; `buildStatus` at line 744 calls `globalThis.ColabKeepaliveShared.formatUptime`.
- **Fix:** Delete local `formatUptime` and `getUptime`.
- **Rationale:** Dead code duplication. The shared module is the single source of truth.

### 2.2 Derive jitter UI bounds from shared constants

- **File:** `popup.js:269-271`
- **Current:** `syncJitterInputs` hardcodes `min = 5, max = 35`.
- **Fix:**
  ```js
  const min = Math.round(JITTER_MIN * 100);
  const max = Math.round(JITTER_MAX * 100);
  ```
- **Rationale:** If `JITTER_MIN`/`JITTER_MAX` change in `shared.js`, the UI slider becomes inconsistent. Deriving from constants keeps them in sync.

### 2.3 Add retry limit to wake lock release handler

- **File:** `content.js:476-481`
- **Current:** Wake lock release handler retries indefinitely every 5s with no cap.
- **Fix:** Add a retry counter (max 3 attempts). After max retries, stop re-requesting and optionally log/send a status update.
- **Rationale:** In battery-saver mode, non-secure contexts, or permission-denied states, the browser may permanently deny wake lock. An infinite retry loop wastes CPU and spams the console.

### 2.4 Remove redundant message type `CKA_GET_UPTIME`

- **File:** `shared.js`, `content.js:97-103`, `background.js`
- **Current:** `CKA_GET_UPTIME` is a separate message type that only returns uptime. `CKA_GET_STATUS` already returns `uptimeMs` and `uptimeFormatted`.
- **Fix:**
  1. Remove `CKA_GET_UPTIME` from `MESSAGE_TYPES` in `shared.js`.
  2. Remove the handler case in `content.js`.
  3. Update any callers in `popup.js` or `background.js` to use `CKA_GET_STATUS` instead.
- **Rationale:** Reduces protocol surface area and cognitive load. One message type for all status needs is cleaner.

## Phase 3: Simplification & Cleanup (P3)

### 3.1 Collapse identical switch cases in content.js message handler

- **File:** `content.js:89-103`
- **Current:** Six separate case labels each returning the same `okResponse(buildStatus("ignored"))`.
- **Fix:** Stack the case labels:
  ```js
  case MSG.CKA_RECONCILE_BADGE:
  case MSG.CKA_STATUS_UPDATE:
  case MSG.CKA_ERROR:
  case MSG.CKA_SHOW_NOTIFICATION:
  case MSG.CKA_DISMISS_DIALOG_DETECTED:
    return okResponse(buildStatus("ignored"));
  ```
- **Rationale:** Reduces vertical bloat without changing behavior.

### 3.2 Remove redundant `beforeunload` listener

- **File:** `content.js:64-65`
- **Current:** Both `pagehide` and `beforeunload` call `cleanup()`.
- **Fix:** Remove the `beforeunload` listener; keep only `pagehide`.
- **Rationale:** `pagehide` fires in all modern browsers (including mobile) and covers all cases `beforeunload` handles. Keeping both is legacy cruft.

### 3.3 Use shared `SYNTHETIC_EVENT_TYPES` in content.js

- **File:** `content.js:516-517`
- **Current:** Defines local `const EVENT_TYPES = ["mousemove", "mousedown", ...]`
- **Fix:** Import and use `SYNTHETIC_EVENT_TYPES` from `shared.js`.
- **Rationale:** The shared constant already exists and is exported. Using it eliminates a second source of truth.

### 3.4 Replace manual number validation with `validNumber` in popup.js

- **File:** `popup.js:228-255`
- **Current:** `syncIntervalInputs` manually checks `!Number.isFinite(value)` and clamps.
- **Fix:** Use the shared `validNumber(value, min, max, fallback)` helper.
- **Rationale:** The helper exists in `shared.js` and is already imported. Reusing it removes duplicated logic.

## Phase 4: Verification

After all edits:

1. Run `node --test tests/extension.test.mjs` — all 8 tests must pass.
2. Run `python3 scripts/generate-icons.py` to verify icon paths remain valid.
3. Verify manifest.json is valid JSON (no trailing commas).
4. Do a quick grep for `icon128` (should find zero results outside generated comments).
5. Do a quick grep for `CKA_GET_UPTIME` (should find zero results after cleanup).

## Rollback

All changes are confined to 4 files. If any test fails, revert the affected file and re-run tests individually to isolate the offending change.
