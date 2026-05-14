# Chrome Web Store Listing Configuration

## Product Details

### Title (from manifest — already set)

**Colab Keepalive**

### Summary (from manifest — already set)

Prevents Google Colab idle disconnects by safely clicking Connect/Reconnect with configurable timing.

### Description

```
Keep your Google Colab notebooks running without interruption.

Colab Keepalive safely prevents idle-session disconnects by periodically clicking the Connect/Reconnect button — exactly when needed, with human-like timing patterns.

✅ HUMANIZED SIGNALS
• Screen Wake Lock API keeps your session alive at the OS level
• Synthetic mouse, keyboard, scroll & focus events mimic real user activity
• Smart jitter adds natural randomness to click intervals (5–35% variance)
• Auto-dismisses "Session Expired" dialogs instantly

✅ CONFIGURABLE TIMING
• Adjustable interval: 1–60 minutes between keepalive clicks
• Optional jitter randomization for natural-looking patterns
• Manual "Test Click" button for instant verification

✅ CLEAN POPUP DASHBOARD
• Live status with uptime counter
• Light / Dark / Auto theme support
• One-toggle enable/disable
• Permission status indicators

✅ KEYBOARD SHORTCUTS
• Toggle on/off: Ctrl+Shift+K (Cmd+Shift+K on Mac)
• Trigger immediate click: Ctrl+Shift+J
• Toggle humanization: Ctrl+Shift+H

✅ PRIVACY-FIRST
• No analytics, tracking, or external network calls
• No data collection whatsoever
• Open source — full transparency

PERMISSIONS EXPLAINED
• Storage — saves your timing & settings preferences
• Alarms — lightweight background reconciliation
• Notifications — optional alerts for errors & dialogs

SUPPORT & SOURCE
• GitHub: https://github.com/wwadge/colab-keepalive
• Issues & feature requests welcome
```

### Category

**Productivity**

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

Capture these scenes on a Google Colab notebook page:

1. **Screenshot 1 — "Popup Dashboard (Dark)"**
   Open the extension popup with the dark theme active while on a Colab page.
   Shows: enabled status, uptime counter, humanization indicators, jitter slider.

2. **Screenshot 2 — "Popup Dashboard (Light)"**
   Same popup with light theme active.

3. **Screenshot 3 — "Settings & Timing"**
   Focus on the interval controls and toggle switches (Humanize, Simulate Activity, Dismiss Dialogs).

4. **Screenshot 4 — "Colab Page In Action"**
   The Colab notebook page with the Connect button visible and the extension badge showing "ON".

5. **Screenshot 5 — "Keyboard Shortcuts"**
   Screenshot of Chrome's `chrome://extensions/shortcuts` page showing the three bound shortcuts.

### Small Promo Tile (Optional but recommended)

Size: 440×280 px | JPEG or 24-bit PNG (no alpha)

**Design spec:**

- Background: dark gradient (#1a1a2e to #16213e)
- Left side: Colab orange/yellow flame icon stylized
- Right side: large white text "KEEP COLAB ALIVE"
- Subtext: "Humanized · Configurable · Private"
- Bottom-right: small extension badge "Chrome Extension"

### Marquee Promo Tile (Optional but recommended)

Size: 1400×560 px | JPEG or 24-bit PNG (no alpha)

**Design spec:**

- Background: same dark gradient
- Left 40%: laptop/browser mockup showing Colab page with active status
- Right 60%: headline "Never Lose a Colab Session Again"
- Bullet points: "Humanized Activity · Smart Timing · Auto-Reconnect"
- Bottom: CTA button style text "Free on Chrome Web Store"

---

## Additional Fields

### Official URL

**None** (unless you register the GitHub repo via Search Console — then select it)

### Homepage URL

`https://github.com/wwadge/colab-keepalive`

### Support URL

`https://github.com/wwadge/colab-keepalive/issues`

### Mature Content

**No** — leave toggle off. This extension contains no mature content.

---

## Item Support

### Visibility

**Public** (default after publishing)

---

## Privacy Practices Tab (fill separately)

- **Single purpose**: Yes — prevents Colab idle disconnects
- **Permission justification**: Already covered in description
- **Data collection**: Does NOT collect or transmit any user data
- **Remote code**: No remote code execution
- **Affiliate / financial**: No payment processing or affiliate ads
