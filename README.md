# colab-keepalive

`colab-keepalive` builds the Chrome extension **Colab Keepalive**. It is a privacy-first Manifest V3 helper that runs only on Google Colab pages and periodically clicks visible, enabled Connect/Reconnect controls with user-configurable timing.

Google Colab is a trademark of Google LLC. This project is not affiliated with, endorsed by, or sponsored by Google.

## What It Does

- Runs a content script only on `https://colab.research.google.com/*` and `https://*.colab.research.google.com/*`.
- Detects Colab Connect/Reconnect controls, including controls inside open shadow roots.
- Clicks only visible and enabled Connect/Reconnect controls.
- Stores user settings in `chrome.storage.sync`.
- Stores volatile tab status in `chrome.storage.session`.
- Shows toolbar badge state:
  - Green `ON`: enabled.
  - Gray `OFF`: disabled.
  - Red `ERR`: repeated failures or error state.
- Provides a popup with enable/disable, interval, live status, failure count, last click time, test click, and reset controls.

## What It Does Not Do

This extension does **not** bypass Google Colab quotas, maximum runtime limits, account restrictions, CAPTCHAs, rate limits, payment tiers, abuse protections, or any server-side enforcement. It is strictly a local browser helper for idle-disconnect mitigation when Colab exposes a normal UI Connect/Reconnect control.

## Privacy

The extension does not collect analytics, track users, call external services, or load remote code. It does not read notebook contents for upload or storage. The content script inspects the current Colab page DOM only to find visible Connect/Reconnect controls and report lightweight tab status to the extension service worker.

## Install Locally

1. Generate icons:

   ```sh
   python3 scripts/generate-icons.py
   ```

2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select this repository root.

If icon generation reports that Pillow is required, install it with:

```sh
python3 -m pip install pillow
```

## Permissions Rationale

- `storage`: persists user settings and stores volatile tab status.
- `alarms`: performs lightweight badge and tab reconciliation every five minutes.
- `https://colab.research.google.com/*` and `https://*.colab.research.google.com/*`: limits extension access to Google Colab pages.

The manifest intentionally does not request `scripting`, `tabs`, `activeTab`, `webRequest`, or broad host permissions.

## How Keepalive Works

The content script owns the keep-alive interval in each Colab tab. On each tick it searches for a click target in this priority order, then filters every candidate through shared Connect/Reconnect label classification so connected-state controls such as Disconnect, Connected, or Connecting are not clicked:

1. `colab-connect-button`
2. `#connect`
3. `[aria-label*="Connect" i]`
4. `[aria-label*="Reconnect" i]`
5. Visible button-like elements containing Connect/Reconnect text

The search walks the document and open shadow roots with strict recursion and node bounds. The script clicks only visible, enabled targets. Failures are tracked per tab and become warnings after the configured threshold.

The service worker does not drive clicks and does not try to stay alive artificially. It registers listeners at the top level, stores critical state in Chrome storage, fans out setting updates, and uses `chrome.alarms` only for lightweight reconciliation. This follows Chrome MV3 service-worker lifecycle guidance.

## Icon Pipeline

The root `icon.png` is the canonical source asset. Do not replace or edit it when generating extension icons.

Run:

```sh
python3 scripts/generate-icons.py
```

The script reads only `./icon.png` and writes:

- `icons/icon-16.png`
- `icons/icon-32.png`
- `icons/icon-48.png`
- `icons/icon-128.png`
- `icons/icon-512.png`

When Pillow is available, the script converts the source to RGBA, center-pads non-square input with transparent pixels, resizes using Lanczos resampling, preserves transparency, and validates PNG dimensions. If Pillow is unavailable, the script can use the macOS `sips` fallback only for already-square PNG input; that fallback does not guarantee Lanczos resampling and cannot perform transparent center-padding.

## Development Commands

```sh
python3 scripts/generate-icons.py
python3 -m json.tool manifest.json
node --check shared.js
node --check background.js
node --check content.js
node --check popup/popup.js
node --test tests/*.test.mjs
```

Additional local checks:

```sh
python3 - <<'PY'
from pathlib import Path
import struct
for size in (16, 32, 48, 128, 512):
    path = Path(f"icons/icon-{size}.png")
    data = path.read_bytes()[:24]
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert data[12:16] == b"IHDR"
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == (size, size), (path, width, height)
print("icon dimensions ok")
PY
```

## Troubleshooting

- **No Colab tabs detected**: open a page under `https://colab.research.google.com/` or reload existing Colab tabs after installing the extension.
- **Test Click Now is disabled**: no matching Colab tab is currently open.
- **Badge shows ERR**: the content script repeatedly failed to find or click a visible enabled Connect/Reconnect control. Colab may have changed its UI, a modal may be blocking the page, or the runtime may require user action.
- **Runtime still disconnects**: Colab server-side runtime limits, quotas, idle policies, account restrictions, and abuse protections still apply.
- **Icons are missing**: run `python3 scripts/generate-icons.py` from the repository root.

## Chrome Web Store Checklist

- Confirm all icons are generated from `icon.png`.
- Confirm the extension loads unpacked without manifest or service worker errors.
- Confirm content scripts are limited to Colab domains.
- Confirm the popup has no inline scripts and loads no remote assets.
- Confirm permissions are limited to `storage`, `alarms`, and Colab host permissions.
- Confirm README, `docs/MANUAL_TESTING.md`, and all `AGENTS.md` files match the final behavior.
- Confirm the package contains no analytics, tracking, external calls, dynamic code execution, or remote code.

## Limitations

Google Colab is a live web application and its DOM can change without notice. This extension uses robust bounded selectors and shadow-DOM traversal, but future UI changes can still break detection. It cannot solve server-side disconnects, quota exhaustion, maximum runtime shutdowns, CAPTCHA prompts, account restrictions, payment-tier limits, or rate limits.
