# Chrome Web Store Listing Configuration

## Product Details

### Title (from manifest — already set)

**Colab Keepalive**

### Summary (from manifest — already set)

Reduces Google Colab local idle disconnects by safely clicking Connect/Reconnect with configurable timing.

### Description

```
Reduce Google Colab local idle disconnects without giving up privacy.

Colab Keepalive is a Manifest V3 browser extension that runs only on Google Colab pages. When Colab shows a visible Connect or Reconnect control, the extension can click it using your configured timing, schedule, and multi-tab preferences.

LOCAL IDLE HELP
• Clicks only visible, enabled Connect/Reconnect controls
• Avoids connected-state controls such as Disconnect, Connected, and Connecting
• Optional jitter and local idle-signal controls
• Optional dismiss handling for common Colab idle dialogs

CONFIGURABLE TIMING
• Adjustable interval: 30–300 seconds
• Jitter range: 5–35%
• Work-hour and active-day schedule
• Manual Test Click button for quick verification

POPUP DASHBOARD
• Live status with uptime counter
• Lifetime stats for clicks, failures, success rate, and uptime
• Light, dark, and auto theme support
• One-toggle enable/disable and error clearing

KEYBOARD SHORTCUTS
• Browser shortcuts available through chrome://extensions/shortcuts
• Commands for toggle on/off, immediate click, and local-signal controls

PRIVACY-FIRST
• No analytics, tracking, or external network calls
• No remote code or third-party content
• No account required
• Open source and auditable

IMPORTANT LIMITS
Colab Keepalive is a local browser helper. It does not bypass Google Colab quotas, maximum runtime limits, account restrictions, CAPTCHAs, rate limits, payment tiers, abuse protections, or any other server-side enforcement.

PERMISSIONS EXPLAINED
• Storage — saves your timing & settings preferences
• Alarms — lightweight background reconciliation
• Notifications — optional alerts for errors & dialogs
• Context menus — quick actions on Colab pages

SUPPORT & SOURCE
• GitHub: https://github.com/wyattowalsh/colab-keepalive
• Issues & feature requests welcome
```

### Category

**Developer Tools**

### Language

**English**

---

## Graphic Assets

### Store Icon

Use the existing `icons/icon-128.png` from the package.
• Size: 128×128 px
• Format: PNG
• Already included in the uploaded ZIP

### Screenshots (Required: at least 1, max 5)

Recommended specs: 1280×800 or 640×400, JPEG or 24-bit PNG (no alpha channel)

Use the generated assets in `store-assets/` or capture equivalent scenes on a Google Colab notebook page:

1. **Screenshot 1 — "Popup Dashboard"**
   `store-assets/screenshot-1-dashboard.png`
   Shows: enabled status, Colab tab count, uptime, next click, lifetime stats, test click, and limitation callout.

2. **Screenshot 2 — "Settings & Timing"**
   `store-assets/screenshot-2-settings.png`
   Shows: interval, jitter, schedule, target mode, local-signal controls, and notifications.

3. **Screenshot 3 — "Advanced Controls"**
   `store-assets/screenshot-3-advanced.png`
   Shows: multi-tab coordination, appearance controls, and backup/restore.

4. **Screenshot 4 — "Dark Mode Dashboard"**
   `store-assets/screenshot-4-dark-mode.png`
   Shows: same status flow in dark mode with readable contrast.

5. **Screenshot 5 — "Context Menu"**
   `store-assets/screenshot-5-context-menu.png`
   Shows: Colab-only right-click actions for Toggle Keepalive, Click Now, and Open Settings.

### Small Promo Tile (Optional but recommended)

Size: 440×280 px | JPEG or 24-bit PNG (no alpha)

**Design spec:**

- File: `store-assets/promo-small.png`
- Background: blue gradient (#1a73e8 to #0d47a1)
- Text: "Colab Keepalive"
- Subtext: "Reduce local idle disconnects"
- Trust badges: "Private" and "Colab-only"

### Marquee Promo Tile (Optional but recommended)

Size: 1400×560 px | JPEG or 24-bit PNG (no alpha)

**Design spec:**

- File: `store-assets/promo-marquee.png`
- Background: blue/dark gradient
- Left 40%: browser mockup showing Colab page and extension popup
- Right 60%: headline "Reduce Colab Idle Disconnects"
- Bullet points: "Visible controls only", "Zero telemetry", "Schedule-aware", "Quotas still apply"
- Bottom: limitation note: "Local helper for Colab UI idle prompts"

---

## Additional Fields

### Official URL

**None** (unless you register the GitHub repo via Search Console — then select it)

### Homepage URL

`https://github.com/wyattowalsh/colab-keepalive`

### Support URL

`https://github.com/wyattowalsh/colab-keepalive/issues`

### Mature Content

**No** — leave toggle off. This extension contains no mature content.

---

## Item Support

### Visibility

**Public** (default after publishing)

---

## Privacy Practices Tab (fill separately)

- **Single purpose**: Yes — reduces local Colab idle disconnects
- **Permission justification**: Already covered in description
- **Data collection**: Does NOT collect or transmit any user data
- **Remote code**: No remote code execution
- **Affiliate / financial**: No payment processing or affiliate ads
