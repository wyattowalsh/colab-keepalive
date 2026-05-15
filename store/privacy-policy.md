# Privacy Policy

**Last Updated:** May 14, 2026

## Introduction

Colab Keepalive ("we", "our", or "the extension") is a browser extension designed to prevent Google Colab from disconnecting due to browser idle timeouts. This privacy policy explains what information we collect, how we use it, and your rights.

## Information We Collect

**We collect NO personal information.**

The extension operates entirely within your browser and does not transmit any data to external servers. All data stays local to your device.

### Local Storage

The extension stores the following information locally in your browser:

- **Extension settings**: Your preferences (timing intervals, schedules, theme, etc.)
- **Lifetime statistics**: Anonymous counters (total clicks, uptime, failures)
- **Session status**: Per-tab activity status for coordination

This data is stored using Chrome's built-in storage APIs (`chrome.storage.sync` and `chrome.storage.session`) and never leaves your browser.

### What We Do NOT Collect

We do NOT collect or transmit:

- Personal identifiers (name, email, address, phone number)
- Browsing history
- Website content or data
- Google account information
- IP addresses
- Device information
- Location data
- Any data from websites other than colab.research.google.com

## How We Use Information

Since we collect no personal information, there is no usage of personal data.

Local settings are used solely to:

- Remember your preferences between browser sessions
- Coordinate multi-tab behavior (if enabled)
- Display lifetime statistics in the popup

## Data Sharing

**We do not share any data with third parties.**

The extension:

- Has no external API calls
- Has no analytics or tracking
- Has no remote logging
- Has no data synchronization with external services
- Does not embed third-party content

## Permissions Justification

The extension requests the following permissions:

| Permission      | Purpose                                   |
| --------------- | ----------------------------------------- |
| `storage`       | Save your settings locally                |
| `alarms`        | Lightweight background scheduling         |
| `notifications` | Optional browser notifications for errors |
| `contextMenus`  | Right-click menu for quick actions        |

Host permissions are limited to `colab.research.google.com` and subdomains only.

## Your Rights

Since we collect no personal data, there is no personal data to access, modify, or delete.

You can:

- Clear extension data through Chrome's extension settings
- Uninstall the extension at any time (all local data is removed)
- Export your settings as JSON for backup
- Import settings from JSON

## Security

The extension follows security best practices:

- Content Security Policy (CSP) restricts script sources
- No inline scripts or event handlers
- No dynamic code execution (eval, Function, etc.)
- All messages validated before processing
- Sender validation for cross-origin communication

## Changes to This Policy

We may update this privacy policy as the extension evolves. Changes will be posted to the GitHub repository.

## Contact

For privacy concerns or questions:

- GitHub Issues: https://github.com/ww/colab-keepalive/issues
- Email: [Your contact email]

## Open Source

This extension is open source. You can audit the code at:
https://github.com/ww/colab-keepalive

## Compliance

This extension complies with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) — no personal data collected
- California Consumer Privacy Act (CCPA) — no personal information sold or shared
