# Colab Keepalive v2.0 — Production Readiness Plan

## Objective

Make the extension fully robust, production-ready, and shippable by addressing correctness gaps, defensive programming, accessibility, test coverage, and edge-case handling.

## Current State Summary

- Extension: MV3, 2.0.0, narrow permissions
- Files: background.js (875 lines), content.js (985 lines), shared.js (608 lines), popup/popup.js (814 lines)
- Tests: 11 tests, all passing
- Architecture: Clean separation (content script = per-tab logic, service worker = coordination, popup = UI)

---

## Phase 1: Correctness & Defensive Programming

### 1.1 Fix Coordinated Mode Collision

**File:** `content.js:514-523`
**Problem:** `coordinated` mode hashes URL to a 0-15s delay. Same-URL tabs get identical delay → simultaneous clicks.
**Fix:** Add per-tab random salt (0-2000ms) to the delay:

```js
const delay = (Math.abs(hash) % 16000) + Math.floor(Math.random() * 2000);
```

**Priority:** High
**Test:** Add test verifying different delays for same URL.

### 1.2 Add Defensive chrome.storage Wrappers

**File:** `background.js`
**Problem:** `chrome.storage.session.get`/`set` and `chrome.storage.sync.get`/`set` can throw if storage is corrupted or quota exceeded.
**Fix:** Wrap all storage calls in try/catch with fallback:

```js
async function safeStorageGet(keys, area = "sync") {
  try {
    return await chrome.storage[area].get(keys);
  } catch (error) {
    console.error(LOG_PREFIX, "Storage read failed:", error);
    return {};
  }
}
```

**Priority:** High
**Test:** Add test mocking storage failure.

### 1.3 Add chrome.runtime.lastError Checks

**File:** `background.js:37-47`, `content.js:47-50`
**Problem:** Message handlers don't check `chrome.runtime.lastError` after sendMessage/sendResponse.
**Fix:** Add `if (chrome.runtime.lastError)` guards.
**Priority:** Medium

### 1.4 Validate Clipboard Paste Input

**File:** `popup/popup.js:395-422`
**Problem:** `pasteJsonFromClipboard` doesn't validate JSON shape before sending to background.
**Fix:** Add schema validation (check required fields exist, types are correct) before calling `CKA_IMPORT_SETTINGS`.
**Priority:** Medium

---

## Phase 2: Accessibility & UX

### 2.1 Add ARIA Live Regions

**File:** `popup/popup.html`
**Problem:** Status updates ("Saved", "Error", "Copied") are not announced to screen readers.
**Fix:** Add `aria-live="polite"` region for saveState and error messages.
**Priority:** Medium

### 2.2 Improve Keyboard Navigation

**File:** `popup/popup.js:305-325`
**Problem:** Tab switching requires mouse. No keyboard shortcut support within popup.
**Fix:** Add ArrowLeft/ArrowRight key handlers for tab switching; ensure focus is trapped in modal-like elements.
**Priority:** Low

### 2.3 Add Focus Indicators

**File:** `popup/popup.css`
**Problem:** Some interactive elements may lack visible focus rings.
**Fix:** Audit all `:focus-visible` styles, ensure 2px solid outline with 2px offset.
**Priority:** Low

---

## Phase 3: Test Coverage

### 3.1 Add Error-Path Tests for Background

**File:** `tests/extension.test.mjs`
**New Tests:**

- `CKA_EXPORT_SETTINGS` when storage is empty
- `CKA_IMPORT_SETTINGS` with invalid JSON shape
- `CKA_NOTIFY_COORDINATED` with no tabs open
- `CKA_TEST_CLICK` with no Colab tabs
- Message handler for unknown type
  **Priority:** High

### 3.2 Add Popup Tests

**File:** `tests/extension.test.mjs` or `tests/popup.test.mjs`
**New Tests:**

- `markDirty()` / `clearDirty()` state transitions
- `syncIntervalInputs()` clamps values correctly
- `nextTheme()` cycles through themes
- `validateSettings()` called before `applySettingsToUi()`
  **Priority:** High

### 3.3 Add Content Script Tests

**File:** `tests/content.test.mjs`
**New Tests:**

- `isVisibleAndEnabled()` with `display: none`, `visibility: hidden`, `aria-hidden="true"`
- `classifyConnectLabel()` edge cases (null, undefined, empty string)
- `findConnectControl()` with no matching elements
- `buildStatus()` serializes correctly
  **Priority:** Medium

### 3.4 Add Clipboard Operation Tests

**File:** `tests/extension.test.mjs`
**New Tests:**

- Copy JSON produces valid JSON string
- Paste JSON rejects malformed input
- Paste JSON handles empty clipboard
  **Priority:** Medium

---

## Phase 4: Edge Cases & Resilience

### 4.1 Handle Wake Lock Unsupported Browsers

**File:** `content.js:557-583`
**Problem:** `navigator.wakeLock` may not exist; current code checks but doesn't surface this to user.
**Fix:** Add a `wakeLockSupported` flag to status; show warning in popup if humanizeSignals is enabled but wake lock unavailable.
**Priority:** Low

### 4.2 Handle MutationObserver Cleanup

**File:** `content.js:800-824`
**Problem:** Observer is disconnected in `cleanup()` but may not be recreated on re-initialization.
**Fix:** Ensure `setupObserver()` is idempotent; call it in `initialize()` after DOM ready.
**Priority:** Medium

### 4.3 Handle Disconnected Runtime

**File:** `content.js:47-50`
**Problem:** If extension is reloaded/updated, content script's `chrome.runtime` port may be stale.
**Fix:** Add `chrome.runtime.onConnect` listener or periodic `chrome.runtime.sendMessage` ping to detect disconnect; auto-reload page if extension updated.
**Priority:** Low

### 4.4 Add Rate Limiting for Clicks

**File:** `content.js:186-229`
**Problem:** Manual test click + scheduled click could overlap; no minimum interval between clicks.
**Fix:** Add `lastClickAt` check: if last click was < 5s ago, skip scheduled click.
**Priority:** Medium

---

## Phase 5: Performance & Monitoring

### 5.1 Add Performance Marks

**File:** `background.js`, `content.js`
**Problem:** No timing data for click latency or DOM scan duration.
**Fix:** Add `performance.mark()` / `performance.measure()` around `findConnectControl()` and `clickElement()`.
**Priority:** Low

### 5.2 Reduce DOM Scan Frequency

**File:** `content.js:800-824`
**Problem:** MutationObserver fires on every DOM change; debounce is 500ms but could still be frequent on dynamic pages.
**Fix:** Increase debounce to 1000ms; add max frequency cap (max 1 scan per 2 seconds).
**Priority:** Low

---

## Phase 6: Documentation

### 6.1 Update README for v2.0

**File:** `README.md`
**Add:**

- New features: multi-tab coordination, scheduling, humanization presets, custom themes
- Keyboard shortcuts list
- Troubleshooting section
- Privacy policy (no data collection)
  **Priority:** Medium

### 6.2 Update CHANGELOG

**File:** `CHANGELOG.md`
**Add:** v2.0.0 entry with all new features and bug fixes.
**Priority:** Low

---

## Implementation Order

1. **Phase 1** (Critical): 1.1, 1.2, 1.4
2. **Phase 3** (Critical): 3.1, 3.2, 3.4
3. **Phase 2** (Important): 2.1
4. **Phase 4** (Important): 4.2, 4.4
5. **Phase 5** (Nice-to-have): 5.1, 5.2
6. **Phase 6** (Documentation): 6.1, 6.2

---

## Acceptance Criteria

- [ ] All 11 existing tests pass
- [ ] All new tests pass (minimum 10 new tests)
- [ ] No `eval`, `fetch`, or remote calls in source
- [ ] Manifest stays MV3 with narrow permissions
- [ ] Popup accessible via keyboard
- [ ] Error states handled gracefully (no unhandled exceptions)
- [ ] Code review complete with no P0/P1 findings
