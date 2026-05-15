# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-05-14

### Added

- **Popup UI Overhaul**: Complete redesign of the popup with three tabs (Dashboard, Settings, Advanced)
- **Explicit Save Model**: Replaced auto-save with a single Save button that only enables when changes are made
- **Clipboard Export/Import**: Copy settings as JSON to clipboard and paste back (replaces file download)
- **Dark Mode Auto-Detect**: Theme now supports "auto" mode that follows system `prefers-color-scheme`
- **Custom Theme Colors**: Choose accent, background, and text colors with reset option
- **Schedule Settings**: Set work hours (start/end) and active days of the week
- **Smart Pause**: Automatically pause when outside scheduled hours
- **Multi-Tab Coordination**: Three sync modes:
  - `independent`: Each tab clicks freely
  - `primary`: Only the first active tab clicks
  - `coordinated`: Spreads clicks across tabs with per-tab salt to prevent collisions
- **Rate Limiting**: Minimum 10-second gap between automatic keep-alive clicks
- **Humanization Presets**: Choose from subtle (5% jitter), medium (15% jitter), or aggressive (25% jitter)
- **Keyboard Shortcuts**: `Ctrl+Shift+K` (or `Cmd+Shift+K` on Mac) for quick test click
- **Context Menu**: Right-click on Colab pages for "Test Click Now" action
- **Browser Notifications**: Optional notifications for failure warnings
- **Lifetime Stats**: Track total clicks, failures, uptime, success rate, and first used date
- **Error Clearing**: Manual clear button for error logs
- **Test Click**: Built-in button to verify the extension is working
- **14 Test Suite**: Comprehensive tests covering validation, security, and edge cases

### Changed

- **Settings Validation**: All inputs now strictly validated with clamping for numeric values
- **Message Protocol**: All runtime messages now include `source: "colab-keepalive"` and validated types
- **Storage Resilience**: Added defensive wrappers around `chrome.storage.session` with memory fallback
- **Clipboard Validation**: Paste now rejects non-objects, arrays, null, and unknown keys
- **Refresh Status**: No longer overwrites dirty form state

### Fixed

- **Critical**: `background.js` `sessionGet`/`sessionSet` were recursively calling themselves instead of `chrome.storage.session`
- **Critical**: `background.js:672` used undefined `sendMessageToTab` (should be `sendToTabSafely`)
- **Critical**: `popup.js` had 14 missing DOM element references causing `TypeError` on load
- **Coordinated Mode**: Same-URL tabs now use per-tab random salt to prevent identical delays
- **Test Failures**: Fixed 4 failing tests in validators, presets, and stats formatting
- **Icon Paths**: All manifest icon paths now use generated PNG files under `icons/`

### Security

- Strict Content Security Policy: `script-src 'self'; object-src 'self';`
- No inline scripts, eval, Function, or document.write anywhere
- Message sender validation against allowed Colab origins
- Settings validation rejects unknown keys and extreme values
- Narrow permissions: storage, alarms, notifications, contextMenus only
- Host permissions limited to `colab.research.google.com` and subdomains

### Performance

- Bounded DOM queries: max shadow depth 8, max roots 80, max text buttons 250
- Rate limiting prevents excessive CPU usage
- MutationObserver cleanup on disconnect/unload
- No external API calls or remote assets

## [1.0.0] - 2025-XX-XX

### Added

- Initial release of Colab Keepalive
- Content script for DOM detection and click simulation
- Service worker for background coordination
- Basic popup UI with enable/disable toggle
- Interval-based keep-alive mechanism
- Manifest V3 compliance

---

[2.0.0]: https://github.com/ww/colab-keepalive/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ww/colab-keepalive/releases/tag/v1.0.0
