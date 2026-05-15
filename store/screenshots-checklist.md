# Screenshots Checklist

## Chrome Web Store Requirements

- **Minimum**: 1 screenshot (1280x800 or 640x400)
- **Recommended**: 4-5 screenshots showing different features
- **Format**: PNG or JPEG
- **Aspect Ratio**: 16:10 (1280x800) or 4:3 (640x480)
- **Generated assets**: Run `python3 scripts/generate-store-assets.py` to create PNGs under `store-assets/`.

## Required Screenshots

### 1. Dashboard Tab (1280x800)

**Priority: REQUIRED**

- [ ] Shows extension popup open on a Colab page
- [ ] Dashboard tab is active
- [ ] Status section visible: Colab tabs, uptime, next click, last click, failures
- [ ] Lifetime stats visible: clicks, success rate, total uptime, longest session
- [ ] Next click countdown timer visible
- [ ] Test Click button visible
- [ ] Error count (if any) visible
- [ ] Local-helper limitation visible: quotas and runtime limits still apply

**Steps to capture:**

1. Open a Colab notebook
2. Click extension icon in toolbar
3. Ensure Dashboard tab is selected
4. Screenshot the popup

### 2. Settings Tab (1280x800)

**Priority: REQUIRED**

- [ ] Settings tab is active
- [ ] Timing controls visible: interval slider (e.g., 60s), jitter range
- [ ] Behavior toggles visible: humanization, simulate activity, dismiss dialogs
- [ ] Target mode dropdown visible
- [ ] Schedule and notifications controls visible
- [ ] Save state visible as "Saved"

**Steps to capture:**

1. Click Settings tab
2. Adjust interval to a clear value (e.g., 60 seconds)
3. Enable humanization toggle
4. Screenshot

### 3. Advanced Tab (1280x800)

**Priority: HIGHLY RECOMMENDED**

- [ ] Advanced tab is active
- [ ] Multi-tab section visible: sync mode dropdown, multi-tab toggle
- [ ] Appearance section visible: custom colors
- [ ] Backup & Restore section visible: Copy JSON / Paste JSON buttons

**Steps to capture:**

1. Click Advanced tab
2. Enable multi-tab coordination
3. Confirm appearance controls are visible
4. Confirm backup/restore buttons are visible
5. Screenshot

### 4. Dark Mode Comparison (1280x800)

**Priority: RECOMMENDED**

- [ ] Shows the extension in dark mode
- [ ] Same content as screenshot 1 but with dark theme
- [ ] Demonstrates auto-detect or manual dark mode

**Steps to capture:**

1. Set system to dark mode (or manually select dark theme)
2. Refresh popup
3. Screenshot Dashboard tab

### 5. Context Menu (1280x800)

**Priority: RECOMMENDED**

- [ ] Right-click on Colab page
- [ ] Extension context menu visible
- [ ] Shows "Toggle Keepalive" option
- [ ] Shows "Click Now" option
- [ ] Shows "Open Settings" option

**Steps to capture:**

1. Open Colab page
2. Right-click anywhere on page
3. Hover over extension menu item
4. Screenshot

## Optional Screenshots

### 6. Error State (1280x800)

**Priority: OPTIONAL**

- [ ] Shows error message in popup
- [ ] Error badge on extension icon
- [ ] Demonstrates error handling

**Steps to capture:**

1. Trigger an error condition (e.g., no Colab tabs open)
2. Screenshot error state

### 7. Notification (1280x800)

**Priority: OPTIONAL**

- [ ] Shows browser notification from extension
- [ ] Notification shows meaningful message

**Steps to capture:**

1. Enable notifications in settings
2. Trigger a failure condition
3. Screenshot notification

## Promotional Images

### Small Promo (440x280)

**Priority: REQUIRED**

- [ ] Clean, minimal design
- [ ] Extension name: "Colab Keepalive"
- [ ] Tagline: "Reduce local idle disconnects"
- [ ] Blue accent color (#1a73e8)
- [ ] Simple icon or illustration

### Large Promo (1400x560)

**Priority: REQUIRED**

- [ ] Professional, polished design
- [ ] Shows extension value proposition
- [ ] Could include: Colab interface + extension popup side by side
- [ ] Text: "Reduce Colab Idle Disconnects"
- [ ] Subtext: "Private · Configurable · Colab-only"
- [ ] Limitation note: "Quotas and runtime limits still apply"

### Marquee (1400x560)

**Priority: RECOMMENDED**

- [ ] Feature highlights with icons
- [ ] Privacy icon, Schedule icon, Multi-tab icon, Dark mode icon
- [ ] Clean layout with plenty of whitespace
- [ ] No guarantee language promising uninterrupted sessions

## Screenshot Best Practices

1. **Clean browser**: Remove bookmarks bar, hide other extensions, use clean Chrome profile
2. **Real data**: Use actual Colab notebook, not empty page
3. **Consistent sizing**: All screenshots at 1280x800
4. **Clear focus**: No distracting elements, blurred backgrounds if needed
5. **Readable text**: Ensure all text is legible at thumbnail size
6. **Professional look**: Consistent styling, good contrast

## Tools for Screenshots

- **Chrome DevTools**: Device toolbar for exact 1280x800 viewport
- **CleanShot X** (macOS): Professional screenshot tool
- **Greenshot** (Windows): Free screenshot tool with annotations
- **Figma/Sketch**: For creating promotional images

## Submission Checklist

- [ ] All required screenshots captured
- [ ] Screenshots reviewed for clarity and professionalism
- [ ] Promotional images created
- [ ] Images optimized (compressed without quality loss)
- [ ] File names are descriptive (e.g., `screenshot-1-dashboard.png`)
- [ ] No sensitive or personal information visible in screenshots
- [ ] Store copy and images do not imply quota, runtime, CAPTCHA, rate-limit, or payment-tier bypass
