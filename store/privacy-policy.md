# Privacy Policy

**Last Updated:** May 15, 2026

## Introduction

Colab Keepalive ("we", "our", or "the extension") is a browser extension designed to reduce Google Colab local browser idle disconnects by interacting with visible Connect/Reconnect controls on Colab pages. This privacy policy explains what information the extension stores and what it does not collect.

## Information We Collect

**We collect NO personal information.**

The extension operates entirely within your browser and does not transmit data to extension-operated servers. Extension data is stored in Chrome's extension storage. If you have Chrome Sync enabled, Chrome may sync `chrome.storage.sync` data through your Google account according to Chrome's own settings and policies.

### Local Storage

The extension stores the following information locally in your browser:

- **Extension settings**: Preferences such as timing intervals, schedules, theme, and notification settings
- **Lifetime statistics**: Local counters such as total clicks, total uptime, and failures
- **Session status**: Volatile per-tab activity status used for badge display and multi-tab coordination

This data is stored using Chrome's built-in storage APIs (`chrome.storage.sync` and `chrome.storage.session`). The extension does not send this data to any external endpoint.

### What We Do NOT Collect

We do NOT collect or transmit:

- Personal identifiers (name, email, address, phone number)
- Browsing history
- Website content or data
- Notebook source, outputs, prompts, files, or execution results
- Google account information
- IP addresses
- Device information
- Location data
- Any data from websites other than colab.research.google.com

## How We Use Information

Since we collect no personal information, there is no usage of personal data by the extension.

Local settings are used solely to:

- Remember your preferences between browser sessions
- Coordinate multi-tab behavior (if enabled)
- Display lifetime statistics in the popup
- Show the current status badge and optional browser notifications

## Data Sharing

**We do not share any data with third parties.**

The extension:

- Has no external API calls
- Has no analytics or tracking
- Has no remote logging
- Has no extension-operated data synchronization with external services
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

The extension does not request broad host access, `tabs`, `activeTab`, `scripting`, `webRequest`, or access to all websites.

## Your Rights

Since the extension collects no personal data, there is no extension-collected personal data to access, modify, sell, or delete.

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

For privacy concerns or questions, use GitHub Issues:

- GitHub Issues: https://github.com/wyattowalsh/colab-keepalive/issues

## Open Source

This extension is open source. You can audit the code at:
https://github.com/wyattowalsh/colab-keepalive

## Compliance

This extension complies with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) — no personal data collected
- California Consumer Privacy Act (CCPA) — no personal information sold or shared

## Disclaimer

Google Colab is a trademark of Google LLC. Colab Keepalive is not affiliated with, endorsed by, or sponsored by Google. The extension does not bypass Colab quotas, maximum runtime limits, account restrictions, CAPTCHAs, rate limits, payment tiers, abuse protections, or other server-side enforcement.
