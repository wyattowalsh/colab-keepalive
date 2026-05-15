# Chrome Web Store Listing

## Extension Name

Colab Keepalive

## Short Description (max 132 characters)

Reduce Google Colab local idle disconnects with private, configurable Connect/Reconnect assistance.

## Detailed Description

**Keep Colab's local browser connection prompt under control.**

Colab Keepalive is a privacy-first browser extension that helps reduce Google Colab disconnects caused by local browser UI idle timeouts. It works inside your browser, runs only on Colab pages, and stores settings with Chrome's built-in extension storage.

### How it works

When Google Colab shows a visible Connect or Reconnect control, Colab Keepalive can click it for you using your configured timing and schedule. It does not click connected-state controls, interact with notebook code, or run on non-Colab sites.

### Key Features

**Privacy First**

- No extension-operated external connections
- No analytics, tracking, or data collection
- No account or login required
- Open source and auditable

**Smart & Safe**

- Only clicks visible Connect/Reconnect buttons
- Respects your schedule—set active hours and days
- Optional jitter and local idle-signal controls
- Multi-tab coordination to avoid conflicts

**Customizable**

- Adjust timing intervals (30–300 seconds)
- Set work hours and active days
- Choose from local idle-signal presets
- Dark mode support (auto/light/dark)

**Transparent**

- Built-in test click button to verify functionality
- Lifetime stats tracking (clicks, uptime, success rate)
- Error logging with clear messages
- Export/import settings as JSON

### Important Limitations

Colab Keepalive is a local browser helper. It does **not** bypass Google Colab quotas, maximum runtime limits, account restrictions, CAPTCHAs, rate limits, payment tiers, abuse protections, or any other server-side enforcement. If Colab ends or restricts a runtime server-side, this extension cannot override that decision.

### Permissions

- **Storage**: Save your settings locally
- **Alarms**: Lightweight background scheduling
- **Notifications**: Optional browser notifications for errors
- **Context Menus**: Right-click menu for quick actions

### What we DON'T do

- We do NOT bypass Colab runtime limits or quotas
- We do NOT interact with any sites other than colab.research.google.com
- We do NOT collect or transmit any data
- We do NOT use remote code or external APIs

---

## Category

Developer Tools

## Language

English

## Website

https://github.com/wyattowalsh/colab-keepalive

## Support Email

Use GitHub Issues: https://github.com/wyattowalsh/colab-keepalive/issues

## Privacy Policy

See privacy-policy.md

## Screenshots Required

1. **Popup - Dashboard Tab** (1280x800)
   - Shows status, Colab tab count, uptime, next click timer, and test click action
   - Shows lifetime stats: clicks, success rate, total uptime, longest session
   - Shows privacy/limitation callout: local helper, quotas still apply

2. **Popup - Settings Tab** (1280x800)
   - Shows timing controls: interval, jitter range
   - Shows schedule controls and target selector
   - Shows local-signal and notification controls

3. **Popup - Advanced Tab** (1280x800)
   - Shows multi-tab sync options
   - Shows appearance controls
   - Shows backup and restore controls

4. **Popup - Dark Mode** (1280x800)
   - Same as screenshot 1 but in dark theme
   - Shows readable dark-mode contrast

5. **Context Menu** (1280x800)
   - Right-click on Colab page showing extension menu
   - Toggle Keepalive, Click Now, and Open Settings options visible

## Promotional Images

### Small Promo (440x280)

- Clean, minimal design
- Text: "Colab Keepalive"
- Subtext: "Reduce local idle disconnects"
- Blue accent color (#1a73e8)

### Large Promo (1400x560)

- Split screen: left side Colab interface, right side extension popup
- Text: "Reduce Colab Idle Disconnects"
- Subtext: "Private · Configurable · Colab-only"
- Include limitation note: "Quotas and runtime limits still apply"

### Marquee (1400x560)

- Similar to large promo but with more feature highlights
- Icons for: Privacy, Schedule, Multi-tab, Dark Mode
- Avoid claims that guarantee runtime continuity

## Video (optional)

30-second demo showing:

1. Extension icon in toolbar
2. Opening popup to show status
3. Test click functionality
4. Settings customization
5. Dark mode toggle

## Search Terms

google colab, colab keepalive, colab disconnect, notebook timeout, browser idle, colab session, keep alive, reconnect, colab extension, jupyter timeout

## Additional Fields

**Developer Name**: Use the Chrome Web Store developer account name

**Trader Status**: Non-trader (this app is not a trader)

**Content Rating**: Everyone

**Contact Email**: Use the Chrome Web Store developer account contact email

**Privacy Policy URL**: https://github.com/wyattowalsh/colab-keepalive/blob/main/store/privacy-policy.md

**Support URL**: https://github.com/wyattowalsh/colab-keepalive/issues

**Distribution**: Public

**Pricing**: Free

**Regions**: All regions
