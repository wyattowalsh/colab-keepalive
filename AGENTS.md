# colab-keepalive Agent Instructions

## Product Boundary

- This repository builds a privacy-first Chrome Manifest V3 extension named `colab-keepalive`, displayed as `Colab Keepalive`.
- The extension only mitigates local browser UI idle disconnects by safely clicking visible Google Colab Connect/Reconnect controls.
- Do not add behavior that bypasses Google Colab quotas, maximum runtime limits, account restrictions, CAPTCHAs, rate limits, payment tiers, abuse protections, or other server-side enforcement.
- Do not add analytics, tracking, external calls, remote code, dynamic code execution, broad host permissions, or artificial service-worker keep-alive hacks.

## Icon Canon

- The root `./icon.png` is the single source of truth for every extension icon.
- Never overwrite, replace, redraw, or regenerate `./icon.png`.
- Generate Chrome extension icon assets only with `python3 scripts/generate-icons.py`.
- Generated icon files must live under `icons/` and remain valid PNG files with exact dimensions.

## MV3 Architecture

- Manifest V3 only. Keep `minimum_chrome_version` at or above the currently supported baseline used by the manifest.
- The content script owns per-tab timers, DOM detection, MutationObserver setup, and actual clicks.
- The service worker owns defaults, storage validation, badge state, tab coordination, settings fan-out, and lightweight alarm reconciliation.
- The popup owns user controls and live status display.
- Use `chrome.storage.sync` for persisted settings and `chrome.storage.session` for volatile per-tab status.
- Use `chrome.alarms` only for lightweight reconciliation, never for driving keep-alive clicks.
- Register all service worker listeners at module top level.

## Message Protocol

- Every runtime message must include `source: "colab-keepalive"`, a `type`, optional `requestId`, and optional `payload`.
- Valid message types are `CKA_GET_STATUS`, `CKA_STATUS_UPDATE`, `CKA_SETTINGS_UPDATED`, `CKA_APPLY_SETTINGS`, `CKA_TEST_CLICK`, `CKA_RECONCILE_BADGE`, and `CKA_ERROR`.
- All handlers must return `{ ok: boolean, data?: any, error?: { code: string, message: string } }`.
- Background handlers must validate content-script senders against the allowed Colab origins before trusting tab status or error messages.
- Keep shared protocol constants, settings validation, response helpers, request ID creation, and Connect/Reconnect label classification in `shared.js`.
- Load `shared.js` before `content.js` and `popup.js`; import it at the top of the module service worker.

## Coding Conventions

- Use ES2023+ JavaScript with `"use strict"`, async/await, and clear JSDoc for non-trivial functions.
- Prefix logs with `[Colab-Keepalive]`.
- Keep Chrome permissions narrow: no `scripting`, `tabs`, `activeTab`, `webRequest`, or broad host patterns.
- Keep extension pages free of inline scripts, inline event handlers, eval, and remote assets.
- When a new project convention is discovered, update the closest relevant `AGENTS.md` so future agents inherit it.
