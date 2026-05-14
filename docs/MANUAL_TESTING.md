# Manual Testing Checklist

Use this checklist before publishing or relying on a local unpacked build.

## Load and Manifest

- Run `python3 scripts/generate-icons.py`.
- Open `chrome://extensions`.
- Enable Developer mode.
- Click **Load unpacked** and select the repository root.
- Confirm the extension loads without manifest, service worker, CSP, or icon errors.
- Confirm the displayed name is **Colab Keepalive** and version is **1.0.0**.

## Icons

- Confirm `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`, and `icons/icon-512.png` exist.
- Confirm the toolbar icon renders clearly in light and dark Chrome themes.
- Confirm no icon path points to `icon.png` directly from `manifest.json`.

## Permissions

- Confirm Chrome shows only the Colab site access plus `storage` and `alarms`.
- Confirm there are no permission warnings for all sites, tabs, activeTab, scripting, webRequest, or remote code.

## Popup

- Open the popup with no Colab tabs open.
- Confirm the Colab tab count is `0`.
- Confirm **Test Click Now** is disabled.
- Toggle **Enabled** off and on; reopen the popup and confirm the setting persists.
- Move the interval slider; confirm the number input updates immediately.
- Edit the number input; confirm the slider updates and values clamp to 30-300 seconds.
- Confirm autosave updates the save state after roughly 300 ms.
- Click **Save** after editing and confirm the saved state is shown.
- Click **Reset to Defaults** and confirm enabled is on and interval is 60 seconds.
- Navigate the popup entirely with the keyboard.
- Confirm focus indicators are visible.
- Confirm text remains readable with Chrome or OS dark mode enabled.

## Colab Tab Behavior

- Open `https://colab.research.google.com/`.
- Open or create a notebook.
- Confirm the popup tab count increases.
- Confirm the badge is green `ON` when enabled.
- Turn the extension off and confirm the badge becomes gray `OFF`.
- Turn it back on and confirm open Colab tabs receive the setting without reload.
- Set the interval to 30 seconds and watch the content script status update after ticks.
- Click **Test Click Now** while a Colab notebook tab is open.
- Confirm the visible Connect/Reconnect control is clicked only when it is visible and enabled.
- Confirm the failure count stays at zero when a control is found.

## Reconnect and Error States

- Disconnect a runtime from the Colab UI.
- Confirm **Test Click Now** attempts the visible Reconnect/Connect control.
- Hide or remove the Connect/Reconnect control in DevTools and run **Test Click Now**.
- Confirm the failure count increases.
- Repeat failures past the configured threshold and confirm the badge becomes red `ERR`.
- Restore the control and confirm a successful click clears the warning after the next tick or test click.

## Shadow DOM Robustness

- Inspect the Colab toolbar and runtime controls.
- Confirm controls inside open shadow roots are detected.
- Confirm no excessive console errors appear from selector traversal.

## Privacy and Network

- Inspect extension service worker and content script network activity.
- Confirm there are no analytics, tracking, telemetry, or external fetches.
- Confirm no remote scripts, remote styles, or remote images are loaded by the popup.
- Confirm extension activity is limited to matching Colab URLs.

## Store Readiness

- Confirm `README.md` includes permissions rationale, privacy statement, limitations, trademark disclaimer, and icon pipeline.
- Confirm `LICENSE` is present.
- Confirm all generated icons are valid PNGs with correct dimensions.
- Confirm `python3 -m json.tool manifest.json` succeeds.
- Confirm `node --check background.js content.js popup/popup.js` succeeds.
- Confirm no forbidden permissions are present in `manifest.json`.
- Confirm `icon.png` is unchanged from the source asset supplied to the repository.
