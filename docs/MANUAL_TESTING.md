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
- Confirm `notifications` is **not** listed in manifest permissions (it is requested at runtime).

## Popup — General

- Open the popup with no Colab tabs open.
- Confirm the Colab tab count is `0`.
- Confirm **Test Click Now** is disabled.
- Toggle **Enabled** off and on; reopen the popup and confirm the setting persists.
- Navigate the popup entirely with the keyboard.
- Confirm focus indicators are visible.

## Popup — Theme

- Click the theme toggle button (◐) and confirm the popup cycles through **Auto**, **Light**, and **Dark**.
- In Light mode, confirm the background is light and text is dark.
- In Dark mode, confirm the background is dark and text is light.
- In Auto mode, confirm the popup follows the OS/browser color scheme.
- Reopen the popup and confirm the selected theme persists.

## Popup — Timing and Jitter

- Move the **Check interval** slider; confirm the number input updates immediately.
- Edit the interval number input; confirm the slider updates and values clamp to 30-300 seconds.
- Move the **Jitter** slider; confirm the percentage output updates immediately.
- Edit the jitter number input; confirm the slider updates and values clamp to 5-35%.
- Confirm autosave updates the save state after roughly 300 ms.
- Click **Save** after editing and confirm the saved state is shown.
- Click **Reset to Defaults** and confirm enabled is on, interval is 60 seconds, and jitter is 15%.

## Popup — Humanization Settings

- Confirm **Humanize signals** toggle is on by default.
- Turn **Humanize signals** off and confirm **Simulate activity** and **Dismiss dialogs** become disabled or visually inactive.
- Turn **Humanize signals** back on and confirm the sub-toggles are re-enabled.
- Toggle **Simulate activity** off and on; confirm it persists after reopening the popup.
- Toggle **Dismiss dialogs** off and on; confirm it persists after reopening the popup.

## Popup — Notifications

- Confirm the **Notifications** panel shows a permission pill.
- When browser notifications are not yet granted, confirm the pill shows "Blocked" or "Unknown".
- Toggle **Browser notifications** on; if permission is not granted, confirm Chrome prompts for notification permission.
- After granting permission, reopen the popup and confirm the pill shows "Granted".
- Toggle **Keyboard shortcuts** off and on; confirm it persists after reopening the popup.

## Popup — Status and Uptime

- Open a Colab tab and confirm the popup shows tab count `1` or more.
- Confirm the **Uptime** field shows an increasing duration (e.g., `1m 30s`).
- Confirm the **Last click** field shows a timestamp after the first tick or test click.
- Confirm the **Humanization bar** shows indicators for Wake Lock, Activity, and Dismiss.
- When humanization is enabled and a Colab tab is active, confirm at least one indicator shows as active.

## Colab Tab Behavior

- Open `https://colab.research.google.com/`.
- Open or create a notebook.
- Confirm the popup tab count increases.
- Confirm the content script is active on both `https://colab.research.google.com/*` and Colab subdomain URLs.
- Confirm the badge is green `ON` when enabled.
- Turn the extension off and confirm the badge becomes gray `OFF`.
- Turn it back on and confirm open Colab tabs receive the setting without reload.
- Set the interval to 30 seconds and watch the content script status update after ticks.
- Click **Test Click Now** while a Colab notebook tab is open.
- Confirm the visible Connect/Reconnect control is clicked only when it is visible and enabled.
- Confirm Disconnect, Connected, Connecting, and Connection detail controls are not clicked.
- Confirm the failure count stays at zero when a control is found.

## Reconnect and Error States

- Disconnect a runtime from the Colab UI.
- Confirm **Test Click Now** attempts the visible Reconnect/Connect control.
- Hide or remove the Connect/Reconnect control in DevTools and run **Test Click Now**.
- Confirm the failure count increases.
- Repeat failures past the configured threshold and confirm the badge becomes red `ERR`.
- Restore the control and confirm a successful click clears the warning after the next tick or test click.

## Humanization Features

### Jittered Intervals

- Set the interval to 60 seconds and jitter to 15%.
- Open the browser console for the Colab tab content script.
- Confirm tick timestamps vary slightly (roughly 51-69 seconds apart) rather than exactly 60 seconds.

### Screen Wake Lock

- With humanization enabled, open a Colab notebook.
- Confirm the popup **Wake Lock** indicator shows active.
- Lock the device screen or let the OS idle timer approach; confirm the display stays awake.
- Turn off humanization and confirm the wake lock is released.

### Activity Simulation

- With **Simulate activity** enabled, open a Colab notebook.
- In the Colab page console, add a listener such as `window.addEventListener('mousemove', e => console.log('mv', e.clientX, e.clientY))`.
- Confirm synthetic mousemove events fire at irregular intervals with randomized coordinates.
- Confirm synthetic keydown/keyup events fire with randomized key codes.
- Turn off **Simulate activity** and confirm synthetic events stop.

### Dismiss Dialog Handling

- With **Dismiss dialogs** enabled, trigger a Colab idle dialog (e.g., leave the tab idle for an extended period or simulate a dialog in DevTools).
- Confirm the extension detects the dialog and clicks the dismiss button automatically.
- Confirm the popup **Dismiss** indicator briefly highlights when a dialog is handled.
- Confirm the failure count does not increase when a dismiss dialog is handled.

## Shadow DOM Robustness

- Inspect the Colab toolbar and runtime controls.
- Confirm controls inside open shadow roots are detected.
- Confirm no excessive console errors appear from selector traversal.

## Keyboard Shortcuts

- Open `chrome://extensions/shortcuts`.
- Confirm three commands are listed: **Toggle enabled**, **Trigger click**, and **Toggle humanize**.
- Assign a keyboard shortcut to each and confirm they work:
  - **Toggle enabled** changes the badge between `ON` and `OFF`.
  - **Trigger click** performs an immediate keepalive click.
  - **Toggle humanize** enables or disables humanization features.

## Privacy and Network

- Inspect extension service worker and content script network activity.
- Confirm there are no analytics, tracking, telemetry, or external fetches.
- Confirm no remote scripts, remote styles, or remote images are loaded by the popup.
- Confirm extension activity is limited to matching Colab URLs.

## Store Readiness

- Confirm `README.md` includes permissions rationale, privacy statement, limitations, trademark disclaimer, icon pipeline, and humanization features.
- Confirm `LICENSE` is present.
- Confirm all generated icons are valid PNGs with correct dimensions.
- Confirm `python3 -m json.tool manifest.json` succeeds.
- Confirm `node --check background.js content.js popup/popup.js` succeeds.
- Confirm `node --check shared.js background.js content.js popup/popup.js` succeeds.
- Confirm `node --test tests/*.test.mjs` succeeds.
- Confirm no forbidden permissions are present in `manifest.json`.
- Confirm `icon.png` is unchanged from the source asset supplied to the repository.
