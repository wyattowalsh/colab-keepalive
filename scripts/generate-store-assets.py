"""Generate Chrome Web Store promotional and screenshot assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "store-assets"

BLUE = "#1a73e8"
BLUE_DARK = "#0d47a1"
BLUE_LIGHT = "#8ab4f8"
COLAB_ORANGE = "#f9ab00"
GREEN = "#188038"
GREEN_DARK = "#81c995"
TEXT = "#202124"
MUTED = "#5f6368"
LIGHT_BG = "#f6f7f9"
LIGHT_PANEL = "#ffffff"
LIGHT_BORDER = "#dfe3e8"
DARK_BG = "#15171a"
DARK_PANEL = "#202124"
DARK_PANEL_2 = "#2d2f33"
DARK_BORDER = "#3c4043"
DARK_TEXT = "#f1f3f4"
DARK_MUTED = "#bdc1c6"


def get_font(
    size: int, *, bold: bool = False
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a system font with a small fallback chain."""
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for font_path in font_paths:
        if Path(font_path).exists():
            try:
                return ImageFont.truetype(font_path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def draw_gradient(
    draw: ImageDraw.ImageDraw, width: int, height: int, start: str, end: str
) -> None:
    start_rgb = hex_to_rgb(start)
    end_rgb = hex_to_rgb(end)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(
            int(start_rgb[i] + (end_rgb[i] - start_rgb[i]) * ratio) for i in range(3)
        )
        draw.line([(0, y), (width, y)], fill=color)


def text_size(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont
) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: str,
) -> None:
    width, height = text_size(draw, text, font)
    x1, y1, x2, y2 = box
    draw.text(
        (x1 + (x2 - x1 - width) / 2, y1 + (y2 - y1 - height) / 2),
        text,
        font=font,
        fill=fill,
    )


def draw_check_icon(
    draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color: str = BLUE
) -> None:
    draw.rounded_rectangle((x, y, x + size, y + size), radius=size // 4, fill="white")
    points = [
        (x + size * 0.25, y + size * 0.52),
        (x + size * 0.43, y + size * 0.68),
        (x + size * 0.76, y + size * 0.32),
    ]
    draw.line(points, fill=color, width=max(4, size // 12), joint="curve")


def draw_browser_frame(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    height: int,
    *,
    dark: bool = False,
) -> tuple[int, int, int, int]:
    panel = DARK_PANEL if dark else LIGHT_PANEL
    chrome = DARK_PANEL_2 if dark else "#f1f3f4"
    border = DARK_BORDER if dark else "#d7dce2"
    address = DARK_BG if dark else LIGHT_PANEL
    muted = DARK_MUTED if dark else MUTED

    draw.rounded_rectangle(
        (x, y, x + width, y + height), radius=18, fill=panel, outline=border, width=2
    )
    draw.rounded_rectangle((x, y, x + width, y + 46), radius=18, fill=chrome)
    draw.rectangle((x, y + 28, x + width, y + 46), fill=chrome)
    for index, color in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        cx = x + 22 + index * 22
        draw.ellipse((cx, y + 17, cx + 12, y + 29), fill=color)
    draw.rounded_rectangle(
        (x + 96, y + 12, x + width - 24, y + 34),
        radius=11,
        fill=address,
        outline=border,
    )
    draw.text(
        (x + 112, y + 16),
        "colab.research.google.com/drive/example",
        font=get_font(12),
        fill=muted,
    )
    return x + 18, y + 58, x + width - 18, y + height - 18


def draw_colab_page(
    draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], *, dark: bool = False
) -> None:
    x1, y1, x2, y2 = box
    bg = DARK_PANEL if dark else LIGHT_PANEL
    card = DARK_PANEL_2 if dark else "#f8f9fa"
    border = DARK_BORDER if dark else LIGHT_BORDER
    muted = DARK_MUTED if dark else MUTED
    draw.rectangle(box, fill=bg)
    draw.rounded_rectangle(
        (x1 + 22, y1 + 18, x2 - 22, y1 + 68), radius=10, fill=card, outline=border
    )
    draw.text(
        (x1 + 42, y1 + 34),
        "sample-notebook.ipynb",
        font=get_font(16, bold=True),
        fill=DARK_TEXT if dark else TEXT,
    )
    draw.rounded_rectangle(
        (x2 - 168, y1 + 28, x2 - 46, y1 + 58),
        radius=15,
        fill="#e8f0fe" if not dark else "#1b3a66",
        outline=BLUE_LIGHT if dark else BLUE,
    )
    draw_centered_text(
        draw,
        (x2 - 168, y1 + 28, x2 - 46, y1 + 58),
        "Reconnect",
        get_font(13, bold=True),
        BLUE_LIGHT if dark else BLUE,
    )
    for index in range(3):
        top = y1 + 96 + index * 118
        draw.rounded_rectangle(
            (x1 + 40, top, x2 - 40, top + 88), radius=10, fill=card, outline=border
        )
        draw.rectangle((x1 + 62, top + 20, x1 + 72, top + 68), fill=COLAB_ORANGE)
        draw.line((x1 + 94, top + 28, x2 - 92, top + 28), fill=muted, width=3)
        draw.line((x1 + 94, top + 50, x2 - 180, top + 50), fill=border, width=3)


def draw_popup_dashboard(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    *,
    dark: bool = False,
    width: int = 360,
) -> None:
    panel = DARK_PANEL if dark else LIGHT_PANEL
    panel_2 = DARK_PANEL_2 if dark else "#f8f9fa"
    border = DARK_BORDER if dark else LIGHT_BORDER
    fg = DARK_TEXT if dark else TEXT
    muted = DARK_MUTED if dark else MUTED
    accent = BLUE_LIGHT if dark else BLUE
    ok = GREEN_DARK if dark else GREEN
    height = 500

    draw.rounded_rectangle(
        (x, y, x + width, y + height), radius=16, fill=panel, outline=border, width=2
    )
    draw_check_icon(draw, x + 18, y + 18, 34, accent)
    draw.text(
        (x + 62, y + 20), "Colab Keepalive", font=get_font(18, bold=True), fill=fg
    )
    draw.rounded_rectangle(
        (x + width - 86, y + 20, x + width - 18, y + 44),
        radius=12,
        fill="#e6f4ea" if not dark else "#1e3a2f",
    )
    draw_centered_text(
        draw,
        (x + width - 86, y + 20, x + width - 18, y + 44),
        "Active",
        get_font(12, bold=True),
        ok,
    )
    tabs_y = y + 70
    for index, label in enumerate(("Dashboard", "Settings", "Advanced")):
        left = x + 18 + index * 108
        color = accent if index == 0 else muted
        draw.text((left, tabs_y), label, font=get_font(12, bold=index == 0), fill=color)
        if index == 0:
            draw.line((left, tabs_y + 19, left + 74, tabs_y + 19), fill=accent, width=3)

    card_y = y + 112
    draw.rounded_rectangle(
        (x + 18, card_y, x + width - 18, card_y + 118),
        radius=12,
        fill=panel_2,
        outline=border,
    )
    rows = (
        ("Colab tabs", "2"),
        ("Uptime", "4h 23m"),
        ("Next click", "42s"),
        ("Last click", "10:41"),
        ("Failures", "0"),
    )
    for index, (label, value) in enumerate(rows):
        row_y = card_y + 16 + index * 20
        draw.text((x + 34, row_y), label, font=get_font(12), fill=muted)
        draw.text((x + width - 94, row_y), value, font=get_font(12, bold=True), fill=fg)

    stats_y = card_y + 138
    stats = (
        ("156", "Total clicks"),
        ("98.1%", "Success rate"),
        ("12.4h", "Total uptime"),
        ("4h 23m", "Longest"),
    )
    for index, (number, label) in enumerate(stats):
        col = index % 2
        row = index // 2
        left = x + 18 + col * 166
        top = stats_y + row * 76
        draw.rounded_rectangle(
            (left, top, left + 154, top + 64), radius=10, fill=panel_2, outline=border
        )
        draw_centered_text(
            draw,
            (left, top + 9, left + 154, top + 34),
            number,
            get_font(18, bold=True),
            accent,
        )
        draw_centered_text(
            draw, (left, top + 34, left + 154, top + 56), label, get_font(11), muted
        )

    button_y = y + height - 54
    draw.rounded_rectangle(
        (x + 18, button_y, x + width - 18, button_y + 36), radius=10, fill=accent
    )
    draw_centered_text(
        draw,
        (x + 18, button_y, x + width - 18, button_y + 36),
        "Test Click Now",
        get_font(13, bold=True),
        DARK_BG if dark else "white",
    )


def draw_popup_settings(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw_popup_shell(draw, x, y, active="Settings")
    fg = TEXT
    top = y + 112
    draw_section_title(draw, x, top, "Timing")
    draw_slider(draw, x + 22, top + 34, "Check interval", "60s", 0.25)
    draw_slider(draw, x + 22, top + 88, "Jitter", "15%", 0.33)
    draw_section_title(draw, x, top + 154, "Schedule")
    draw_toggle_row(draw, x + 22, top + 188, "Work hours", "09:00 to 18:00", True)
    draw_days(draw, x + 22, top + 232)
    draw_section_title(draw, x, top + 282, "Target")
    draw_select(draw, x + 22, top + 314, "Auto-detect Connect/Reconnect")
    draw_section_title(draw, x, top + 370, "Humanization")
    draw_toggle_row(draw, x + 22, top + 404, "Wake lock + jitter", "On", True)
    draw_toggle_row(draw, x + 22, top + 442, "Notifications", "Off", False)
    draw.text((x + 264, y + 86), "Saved", font=get_font(12, bold=True), fill=GREEN)
    draw.text((x + 22, y + 474), "Local settings only", font=get_font(11), fill=MUTED)
    draw.text(
        (x + 22, y + 492),
        "No analytics or external calls",
        font=get_font(11),
        fill=MUTED,
    )
    _ = fg


def draw_popup_advanced(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw_popup_shell(draw, x, y, active="Advanced")
    top = y + 112
    draw_section_title(draw, x, top, "Multi-Tab")
    draw_toggle_row(draw, x + 22, top + 34, "Enable coordination", "On", True)
    draw_select(draw, x + 22, top + 78, "Coordinated (spread clicks)")
    draw_section_title(draw, x, top + 132, "Appearance")
    draw_color_row(draw, x + 22, top + 168, "Accent", BLUE)
    draw_color_row(draw, x + 22, top + 206, "Background", LIGHT_BG)
    draw_color_row(draw, x + 22, top + 244, "Text", TEXT)
    draw_section_title(draw, x, top + 302, "Backup & Restore")
    draw.rounded_rectangle((x + 22, top + 338, x + 164, top + 374), radius=9, fill=BLUE)
    draw_centered_text(
        draw,
        (x + 22, top + 338, x + 164, top + 374),
        "Copy JSON",
        get_font(12, bold=True),
        "white",
    )
    draw.rounded_rectangle(
        (x + 176, top + 338, x + 318, top + 374),
        radius=9,
        fill=LIGHT_PANEL,
        outline=LIGHT_BORDER,
    )
    draw_centered_text(
        draw,
        (x + 176, top + 338, x + 318, top + 374),
        "Paste JSON",
        get_font(12, bold=True),
        TEXT,
    )
    draw.text(
        (x + 22, top + 410),
        "Stored with Chrome extension storage",
        font=get_font(11),
        fill=MUTED,
    )


def draw_popup_shell(draw: ImageDraw.ImageDraw, x: int, y: int, *, active: str) -> None:
    width, height = 360, 500
    draw.rounded_rectangle(
        (x, y, x + width, y + height),
        radius=16,
        fill=LIGHT_PANEL,
        outline=LIGHT_BORDER,
        width=2,
    )
    draw_check_icon(draw, x + 18, y + 18, 34)
    draw.text(
        (x + 62, y + 20), "Colab Keepalive", font=get_font(18, bold=True), fill=TEXT
    )
    draw.rounded_rectangle(
        (x + width - 86, y + 20, x + width - 18, y + 44), radius=12, fill="#e6f4ea"
    )
    draw_centered_text(
        draw,
        (x + width - 86, y + 20, x + width - 18, y + 44),
        "Active",
        get_font(12, bold=True),
        GREEN,
    )
    for index, label in enumerate(("Dashboard", "Settings", "Advanced")):
        left = x + 18 + index * 108
        is_active = label == active
        draw.text(
            (left, y + 70),
            label,
            font=get_font(12, bold=is_active),
            fill=BLUE if is_active else MUTED,
        )
        if is_active:
            draw.line((left, y + 89, left + 72, y + 89), fill=BLUE, width=3)


def draw_section_title(draw: ImageDraw.ImageDraw, x: int, y: int, title: str) -> None:
    draw.text((x + 22, y), title.upper(), font=get_font(12, bold=True), fill=MUTED)


def draw_slider(
    draw: ImageDraw.ImageDraw, x: int, y: int, label: str, value: str, pct: float
) -> None:
    draw.text((x, y), label, font=get_font(12), fill=TEXT)
    draw.text((x + 262, y), value, font=get_font(12, bold=True), fill=TEXT)
    track_y = y + 28
    draw.rounded_rectangle((x, track_y, x + 300, track_y + 7), radius=4, fill="#e8eaed")
    draw.rounded_rectangle(
        (x, track_y, x + int(300 * pct), track_y + 7), radius=4, fill=BLUE
    )
    thumb_x = x + int(300 * pct)
    draw.ellipse(
        (thumb_x - 8, track_y - 5, thumb_x + 8, track_y + 11),
        fill="white",
        outline=BLUE,
        width=2,
    )


def draw_toggle_row(
    draw: ImageDraw.ImageDraw, x: int, y: int, label: str, value: str, enabled: bool
) -> None:
    draw.text((x, y), label, font=get_font(12, bold=True), fill=TEXT)
    draw.text((x, y + 17), value, font=get_font(11), fill=MUTED)
    fill = GREEN if enabled else "#dadce0"
    draw.rounded_rectangle((x + 266, y + 5, x + 306, y + 27), radius=11, fill=fill)
    knob_x = x + 286 if enabled else x + 270
    draw.ellipse((knob_x, y + 8, knob_x + 16, y + 24), fill="white")


def draw_days(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    for index, day in enumerate(("M", "T", "W", "T", "F", "S", "S")):
        left = x + index * 41
        active = index < 5
        draw.rounded_rectangle(
            (left, y, left + 30, y + 30),
            radius=7,
            fill=BLUE if active else LIGHT_PANEL,
            outline=BLUE if active else LIGHT_BORDER,
        )
        draw_centered_text(
            draw,
            (left, y, left + 30, y + 30),
            day,
            get_font(11, bold=True),
            "white" if active else MUTED,
        )


def draw_select(draw: ImageDraw.ImageDraw, x: int, y: int, value: str) -> None:
    draw.rounded_rectangle(
        (x, y, x + 306, y + 34), radius=8, fill=LIGHT_PANEL, outline=LIGHT_BORDER
    )
    draw.text((x + 12, y + 10), value, font=get_font(12), fill=TEXT)
    draw.polygon(((x + 282, y + 13), (x + 294, y + 13), (x + 288, y + 21)), fill=MUTED)


def draw_color_row(
    draw: ImageDraw.ImageDraw, x: int, y: int, label: str, color: str
) -> None:
    draw.text((x, y + 5), label, font=get_font(12, bold=True), fill=TEXT)
    draw.rounded_rectangle(
        (x + 268, y, x + 306, y + 28), radius=7, fill=color, outline=LIGHT_BORDER
    )


def draw_context_menu(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rounded_rectangle(
        (x, y, x + 300, y + 236),
        radius=12,
        fill=LIGHT_PANEL,
        outline=LIGHT_BORDER,
        width=2,
    )
    items = [
        ("Copy cell", ""),
        ("Run cell", "Ctrl+Enter"),
        ("Colab Keepalive", ""),
        ("Toggle Keepalive", ""),
        ("Click Now", ""),
        ("Open Settings", ""),
    ]
    for index, (label, shortcut) in enumerate(items):
        top = y + 14 + index * 34
        if index == 2:
            draw.line((x + 12, top - 8, x + 288, top - 8), fill=LIGHT_BORDER)
        fill = BLUE if index >= 2 else TEXT
        font = get_font(13, bold=index >= 2)
        draw.text((x + 18, top), label, font=font, fill=fill)
        if shortcut:
            draw.text((x + 220, top), shortcut, font=get_font(11), fill=MUTED)


def make_small_promo() -> None:
    width, height = 440, 280
    image = Image.new("RGB", (width, height), BLUE)
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, width, height, BLUE, BLUE_DARK)
    draw_check_icon(draw, 44, 64, 78)
    draw.text((146, 66), "Colab", font=get_font(34, bold=True), fill="white")
    draw.text((146, 106), "Keepalive", font=get_font(34, bold=True), fill="white")
    draw.text(
        (146, 156), "Reduce local idle disconnects", font=get_font(15), fill="#e8f0fe"
    )
    for index, label in enumerate(("Private", "Colab-only")):
        left = 146 + index * 102
        draw.rounded_rectangle((left, 198, left + 88, 226), radius=14, fill="#3f8df1")
        draw_centered_text(
            draw, (left, 198, left + 88, 226), label, get_font(11, bold=True), "white"
        )
    save(image, "promo-small.png")


def make_marquee_promo() -> None:
    width, height = 1400, 560
    image = Image.new("RGB", (width, height), BLUE_DARK)
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, width, height, "#0b1633", BLUE_DARK)
    content_box = draw_browser_frame(draw, 72, 84, 548, 392, dark=True)
    draw_colab_page(draw, content_box, dark=True)
    draw_popup_dashboard(draw, 362, 128, dark=True, width=250)
    draw.text((682, 92), "Reduce Colab", font=get_font(58, bold=True), fill="white")
    draw.text(
        (682, 160), "Idle Disconnects", font=get_font(58, bold=True), fill=COLAB_ORANGE
    )
    draw.text(
        (686, 244),
        "Private, configurable assistance for visible Connect/Reconnect prompts.",
        font=get_font(22),
        fill="#dbeafe",
    )
    bullets = [
        "Visible controls only",
        "Zero telemetry or external calls",
        "Schedule-aware and multi-tab ready",
        "Quotas and runtime limits still apply",
    ]
    for index, bullet in enumerate(bullets):
        top = 310 + index * 40
        draw.ellipse((686, top + 7, 700, top + 21), fill=GREEN_DARK)
        draw.text(
            (718, top), bullet, font=get_font(20, bold=index == 3), fill="#f8fafc"
        )
    draw.rounded_rectangle(
        (686, 490, 1028, 528), radius=19, fill="#173b75", outline=BLUE_LIGHT
    )
    draw_centered_text(
        draw,
        (686, 490, 1028, 528),
        "Local helper for Colab UI idle prompts",
        get_font(15, bold=True),
        "#dbeafe",
    )
    save(image, "promo-marquee.png")


def make_large_promo() -> None:
    width, height = 1400, 560
    image = Image.new("RGB", (width, height), "#eef4ff")
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, width, height, "#eff6ff", "#dbeafe")
    draw.text((86, 92), "Reduce Colab", font=get_font(58, bold=True), fill=BLUE_DARK)
    draw.text((86, 160), "Idle Disconnects", font=get_font(58, bold=True), fill=BLUE)
    draw.text(
        (90, 246),
        "Private, configurable help for visible Connect/Reconnect prompts.",
        font=get_font(22),
        fill=TEXT,
    )
    for index, label in enumerate(("Private", "Configurable", "Colab-only")):
        left = 90 + index * 168
        draw.rounded_rectangle((left, 324, left + 142, 362), radius=19, fill="white")
        draw_centered_text(
            draw, (left, 324, left + 142, 362), label, get_font(15, bold=True), BLUE
        )
    draw.rounded_rectangle((90, 440, 514, 490), radius=25, fill=BLUE_DARK)
    draw_centered_text(
        draw,
        (90, 440, 514, 490),
        "Quotas and runtime limits still apply",
        get_font(16, bold=True),
        "white",
    )
    content_box = draw_browser_frame(draw, 704, 78, 548, 404, dark=False)
    draw_colab_page(draw, content_box, dark=False)
    draw_popup_dashboard(draw, 1004, 128, dark=False, width=250)
    save(image, "promo-large.png")


def make_dashboard_screenshot(
    *, dark: bool = False, filename: str = "screenshot-1-dashboard.png"
) -> None:
    width, height = 1280, 800
    image = Image.new("RGB", (width, height), DARK_BG if dark else LIGHT_BG)
    draw = ImageDraw.Draw(image)
    draw_gradient(
        draw,
        width,
        height,
        "#101828" if dark else "#e8f0fe",
        "#1f2937" if dark else "#f8fafc",
    )
    box = draw_browser_frame(draw, 92, 82, 920, 610, dark=dark)
    draw_colab_page(draw, box, dark=dark)
    draw_popup_dashboard(draw, 736, 142, dark=dark)
    callout_fill = "#1f2937" if dark else "#ffffff"
    callout_text = DARK_TEXT if dark else TEXT
    callout_muted = DARK_MUTED if dark else MUTED
    draw.rounded_rectangle(
        (92, 706, 1188, 760),
        radius=16,
        fill=callout_fill,
        outline=DARK_BORDER if dark else LIGHT_BORDER,
    )
    draw.text(
        (122, 722),
        "Local helper only",
        font=get_font(16, bold=True),
        fill=BLUE_LIGHT if dark else BLUE,
    )
    draw.text(
        (282, 722),
        "Clicks visible Colab Connect/Reconnect controls. Quotas and runtime limits still apply.",
        font=get_font(16),
        fill=callout_text,
    )
    draw.text(
        (122, 744),
        "No analytics, no remote code, no non-Colab site access.",
        font=get_font(13),
        fill=callout_muted,
    )
    save(image, filename)


def make_settings_screenshot() -> None:
    image = Image.new("RGB", (1280, 800), LIGHT_BG)
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, 1280, 800, "#e8f0fe", "#f8fafc")
    box = draw_browser_frame(draw, 92, 82, 920, 610)
    draw_colab_page(draw, box)
    draw_popup_settings(draw, 736, 142)
    draw.text(
        (104, 716),
        "Settings stay in Chrome extension storage and are never sent to external services.",
        font=get_font(18, bold=True),
        fill=TEXT,
    )
    save(image, "screenshot-2-settings.png")


def make_advanced_screenshot() -> None:
    image = Image.new("RGB", (1280, 800), LIGHT_BG)
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, 1280, 800, "#fef7e0", "#f8fafc")
    box = draw_browser_frame(draw, 92, 82, 920, 610)
    draw_colab_page(draw, box)
    draw_popup_advanced(draw, 736, 142)
    draw.text(
        (104, 716),
        "Advanced controls keep behavior explicit: multi-tab mode, appearance, and JSON backup.",
        font=get_font(18, bold=True),
        fill=TEXT,
    )
    save(image, "screenshot-3-advanced.png")


def make_context_menu_screenshot() -> None:
    image = Image.new("RGB", (1280, 800), LIGHT_BG)
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, 1280, 800, "#f8fafc", "#e8eaed")
    box = draw_browser_frame(draw, 156, 82, 860, 610)
    draw_colab_page(draw, box)
    draw_context_menu(draw, 496, 250)
    draw.rounded_rectangle(
        (284, 704, 996, 754), radius=16, fill="white", outline=LIGHT_BORDER
    )
    draw_centered_text(
        draw,
        (284, 704, 996, 730),
        "Colab-only context menu",
        get_font(16, bold=True),
        BLUE,
    )
    draw_centered_text(
        draw,
        (284, 728, 996, 752),
        "Toggle Keepalive, Click Now, or Open Settings without leaving the notebook.",
        get_font(14),
        MUTED,
    )
    save(image, "screenshot-5-context-menu.png")


def save(image: Image.Image, filename: str) -> None:
    path = OUTPUT_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    print(f"Saved {path.relative_to(ROOT)} ({image.width}x{image.height})")


def main() -> None:
    make_small_promo()
    make_marquee_promo()
    make_large_promo()
    make_dashboard_screenshot()
    make_settings_screenshot()
    make_advanced_screenshot()
    make_dashboard_screenshot(dark=True, filename="screenshot-4-dark-mode.png")
    make_context_menu_screenshot()


if __name__ == "__main__":
    main()
