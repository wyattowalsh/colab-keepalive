"""Generate Chrome Web Store promo tiles and screenshot mockups."""

from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = "/Users/ww/dev/projects/colab-keepalive/store-assets"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Colors
DARK_BG = "#1a1a2e"
DARK_BG2 = "#16213e"
ACCENT = "#f9a825"  # Colab-ish orange/yellow
TEXT_WHITE = "#ffffff"
TEXT_MUTED = "#a0a0b0"
SUCCESS = "#4caf50"
ON_SURFACE = "#e0e0e0"


def get_font(size, bold=False):
    """Try to get a nice font, fallback to default."""
    font_names = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for name in font_names:
        if os.path.exists(name):
            try:
                return ImageFont.truetype(name, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_gradient(draw, width, height, color1, color2):
    """Draw a vertical gradient."""
    for y in range(height):
        r = int(color1[0] + (color2[0] - color1[0]) * y / height)
        g = int(color1[1] + (color2[1] - color1[1]) * y / height)
        b = int(color1[2] + (color2[2] - color1[2]) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


def make_small_promo():
    w, h = 440, 280
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    c1 = hex_to_rgb(DARK_BG)
    c2 = hex_to_rgb(DARK_BG2)
    draw_gradient(draw, w, h, c1, c2)

    # Accent bar at top
    draw.rectangle([(0, 0), (w, 4)], fill=ACCENT)

    # Flame-like icon (simplified circles)
    cx, cy = 100, 140
    draw.ellipse([(cx - 35, cy - 45), (cx + 35, cy + 25)], fill=ACCENT)
    draw.ellipse([(cx - 20, cy - 65), (cx + 20, cy - 5)], fill="#fbc02d")
    draw.ellipse([(cx - 8, cy - 80), (cx + 8, cy - 30)], fill="#fff176")

    # Title
    font_title = get_font(28, bold=True)
    draw.text((180, 90), "Colab", font=font_title, fill=TEXT_WHITE)
    draw.text((180, 125), "Keepalive", font=font_title, fill=ACCENT)

    # Subtitle
    font_sub = get_font(14)
    draw.text(
        (180, 175),
        "Humanized  ·  Configurable  ·  Private",
        font=font_sub,
        fill=TEXT_MUTED,
    )

    # Badge
    badge_text = "Chrome Extension"
    font_badge = get_font(11)
    bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    bw = bbox[2] - bbox[0] + 16
    bh = bbox[3] - bbox[1] + 10
    bx, by = w - bw - 20, h - bh - 20
    draw.rounded_rectangle(
        [(bx, by), (bx + bw, by + bh)],
        radius=4,
        fill="#2a2a4e",
        outline=TEXT_MUTED,
        width=1,
    )
    draw.text((bx + 8, by + 5), badge_text, font=font_badge, fill=TEXT_MUTED)

    img.save(os.path.join(OUTPUT_DIR, "promo-small.png"))
    print("Saved promo-small.png")


def make_marquee_promo():
    w, h = 1400, 560
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    c1 = hex_to_rgb(DARK_BG)
    c2 = hex_to_rgb(DARK_BG2)
    draw_gradient(draw, w, h, c1, c2)

    # Accent bar at top
    draw.rectangle([(0, 0), (w, 6)], fill=ACCENT)

    # Left side: stylized browser mockup
    bw_x, bw_y, bw_w, bw_h = 80, 100, 520, 380
    draw.rounded_rectangle(
        [(bw_x, bw_y), (bw_x + bw_w, bw_y + bw_h)],
        radius=12,
        fill="#0f0f1a",
        outline="#2a2a4e",
        width=2,
    )
    # Browser chrome
    draw.rounded_rectangle(
        [(bw_x, bw_y), (bw_x + bw_w, bw_y + 40)], radius=12, fill="#1e1e2f"
    )
    draw.line([(bw_x, bw_y + 40), (bw_x + bw_w, bw_y + 40)], fill="#2a2a4e", width=2)
    # Dots
    for i, color in enumerate(["#ff5f56", "#ffbd2e", "#27c93f"]):
        draw.ellipse(
            [(bw_x + 18 + i * 20, bw_y + 14), (bw_x + 32 + i * 20, bw_y + 28)],
            fill=color,
        )
    # URL bar
    draw.rounded_rectangle(
        [(bw_x + 80, bw_y + 10), (bw_x + bw_w - 20, bw_y + 30)],
        radius=4,
        fill="#2a2a4e",
    )
    font_url = get_font(12)
    draw.text(
        (bw_x + 90, bw_y + 12),
        "colab.research.google.com",
        font=font_url,
        fill=TEXT_MUTED,
    )

    # Popup mockup inside browser
    pw_x, pw_y, pw_w, pw_h = bw_x + 280, bw_y + 80, 200, 260
    draw.rounded_rectangle(
        [(pw_x, pw_y), (pw_x + pw_w, pw_y + pw_h)],
        radius=8,
        fill="#1e1e2e",
        outline="#33334d",
        width=1,
    )
    # Popup header
    draw.rounded_rectangle(
        [(pw_x, pw_y), (pw_x + pw_w, pw_y + 36)], radius=8, fill="#252536"
    )
    draw.line([(pw_x, pw_y + 36), (pw_x + pw_w, pw_y + 36)], fill="#33334d", width=1)
    font_popup = get_font(13, bold=True)
    draw.text(
        (pw_x + 12, pw_y + 10), "Colab Keepalive", font=font_popup, fill=TEXT_WHITE
    )
    # Status ON
    font_status = get_font(12)
    draw.text((pw_x + 12, pw_y + 50), "Status: ON", font=font_status, fill=SUCCESS)
    draw.ellipse(
        [(pw_x + pw_w - 28, pw_y + 52), (pw_x + pw_w - 16, pw_y + 64)], fill=SUCCESS
    )
    # Uptime
    draw.text(
        (pw_x + 12, pw_y + 80), "Uptime: 2h 14m", font=font_status, fill=ON_SURFACE
    )
    # Humanization bars
    bar_y = pw_y + 120
    for label, color in [
        ("Wake Lock", SUCCESS),
        ("Activity", SUCCESS),
        ("Dismiss", SUCCESS),
    ]:
        draw.text((pw_x + 12, bar_y), label, font=font_status, fill=ON_SURFACE)
        draw.rectangle(
            [(pw_x + 90, bar_y + 2), (pw_x + pw_w - 12, bar_y + 14)],
            fill="#2a2a3e",
            outline="#33334d",
        )
        draw.rectangle(
            [(pw_x + 90, bar_y + 2), (pw_x + 90 + 80, bar_y + 14)], fill=color
        )
        bar_y += 28

    # Right side: headline
    font_headline = get_font(48, bold=True)
    draw.text((660, 140), "Never Lose a", font=font_headline, fill=TEXT_WHITE)
    draw.text((660, 205), "Colab Session", font=font_headline, fill=ACCENT)
    draw.text((660, 270), "Again", font=font_headline, fill=TEXT_WHITE)

    # Bullet points
    font_bullet = get_font(20)
    bullets = [
        "Humanized Activity Signals",
        "Smart Timing with Jitter",
        "Auto-Reconnect & Dismiss",
    ]
    by = 360
    for bullet in bullets:
        draw.text((660, by), "• " + bullet, font=font_bullet, fill=ON_SURFACE)
        by += 40

    # CTA bar
    font_cta = get_font(18, bold=True)
    cta_text = "Free on Chrome Web Store"
    bbox = draw.textbbox((0, 0), cta_text, font=font_cta)
    cta_w = bbox[2] - bbox[0] + 40
    cta_h = bbox[3] - bbox[1] + 20
    cta_x, cta_y = 660, 500
    draw.rounded_rectangle(
        [(cta_x, cta_y), (cta_x + cta_w, cta_y + cta_h)], radius=6, fill=ACCENT
    )
    draw.text((cta_x + 20, cta_y + 10), cta_text, font=font_cta, fill=DARK_BG)

    img.save(os.path.join(OUTPUT_DIR, "promo-marquee.png"))
    print("Saved promo-marquee.png")


def make_screenshot_dark():
    """Mockup of popup in dark mode."""
    w, h = 640, 400
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    c1 = hex_to_rgb("#12121a")
    c2 = hex_to_rgb("#1a1a2e")
    draw_gradient(draw, w, h, c1, c2)

    # Popup centered
    pw, ph = 360, 320
    px, py = (w - pw) // 2, (h - ph) // 2
    draw.rounded_rectangle(
        [(px, py), (px + pw, py + ph)],
        radius=10,
        fill="#1e1e2e",
        outline="#33334d",
        width=1,
    )

    # Header
    draw.rounded_rectangle([(px, py), (px + pw, py + 40)], radius=10, fill="#252536")
    draw.line([(px, py + 40), (px + pw, py + 40)], fill="#33334d", width=1)
    font_title = get_font(16, bold=True)
    draw.text((px + 14, py + 12), "Colab Keepalive", font=font_title, fill=TEXT_WHITE)

    # Status row
    font_body = get_font(13)
    draw.text((px + 14, py + 55), "Status: ON", font=font_body, fill=SUCCESS)
    draw.ellipse([(px + pw - 34, py + 57), (px + pw - 18, py + 73)], fill=SUCCESS)

    # Uptime
    draw.text((px + 14, py + 82), "Uptime: 3h 42m", font=font_body, fill=ON_SURFACE)

    # Humanization bars
    bar_y = py + 120
    font_bar = get_font(12)
    for label, color, pct in [
        ("Wake Lock", SUCCESS, 100),
        ("Activity", SUCCESS, 85),
        ("Dismiss", SUCCESS, 100),
    ]:
        draw.text((px + 14, bar_y), label, font=font_bar, fill=ON_SURFACE)
        bw = pw - 110
        bh = 12
        draw.rectangle(
            [(px + 90, bar_y + 2), (px + 90 + bw, bar_y + 2 + bh)],
            fill="#2a2a3e",
            outline="#33334d",
        )
        fill_w = int(bw * pct / 100)
        draw.rectangle(
            [(px + 90, bar_y + 2), (px + 90 + fill_w, bar_y + 2 + bh)], fill=color
        )
        bar_y += 26

    # Interval
    draw.text(
        (px + 14, bar_y + 10), "Interval: 10 min", font=font_body, fill=ON_SURFACE
    )
    draw.text((px + 14, bar_y + 35), "Jitter: 15%", font=font_body, fill=ON_SURFACE)

    # Buttons
    btn_y = py + ph - 50
    draw.rounded_rectangle(
        [(px + 14, btn_y), (px + 100, btn_y + 32)], radius=4, fill=ACCENT
    )
    draw.text((px + 26, btn_y + 8), "Test Click", font=font_bar, fill=DARK_BG)
    draw.rounded_rectangle(
        [(px + 110, btn_y), (px + 200, btn_y + 32)], radius=4, fill="#2a2a4e"
    )
    draw.text((px + 122, btn_y + 8), "Settings", font=font_bar, fill=TEXT_WHITE)

    img.save(os.path.join(OUTPUT_DIR, "screenshot-popup-dark.png"))
    print("Saved screenshot-popup-dark.png")


def make_screenshot_light():
    """Mockup of popup in light mode."""
    w, h = 640, 400
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    c1 = hex_to_rgb("#f5f5f7")
    c2 = hex_to_rgb("#ffffff")
    draw_gradient(draw, w, h, c1, c2)

    # Popup centered
    pw, ph = 360, 320
    px, py = (w - pw) // 2, (h - ph) // 2
    draw.rounded_rectangle(
        [(px, py), (px + pw, py + ph)],
        radius=10,
        fill="#ffffff",
        outline="#d0d0e0",
        width=1,
    )

    # Header
    draw.rounded_rectangle([(px, py), (px + pw, py + 40)], radius=10, fill="#f0f0f5")
    draw.line([(px, py + 40), (px + pw, py + 40)], fill="#d0d0e0", width=1)
    font_title = get_font(16, bold=True)
    draw.text((px + 14, py + 12), "Colab Keepalive", font=font_title, fill="#1a1a2e")

    # Status row
    font_body = get_font(13)
    draw.text((px + 14, py + 55), "Status: ON", font=font_body, fill=SUCCESS)
    draw.ellipse([(px + pw - 34, py + 57), (px + pw - 18, py + 73)], fill=SUCCESS)

    # Uptime
    draw.text((px + 14, py + 82), "Uptime: 3h 42m", font=font_body, fill="#333344")

    # Humanization bars
    bar_y = py + 120
    font_bar = get_font(12)
    for label, color, pct in [
        ("Wake Lock", SUCCESS, 100),
        ("Activity", SUCCESS, 85),
        ("Dismiss", SUCCESS, 100),
    ]:
        draw.text((px + 14, bar_y), label, font=font_bar, fill="#333344")
        bw = pw - 110
        bh = 12
        draw.rectangle(
            [(px + 90, bar_y + 2), (px + 90 + bw, bar_y + 2 + bh)],
            fill="#e8e8f0",
            outline="#d0d0e0",
        )
        fill_w = int(bw * pct / 100)
        draw.rectangle(
            [(px + 90, bar_y + 2), (px + 90 + fill_w, bar_y + 2 + bh)], fill=color
        )
        bar_y += 26

    # Interval
    draw.text((px + 14, bar_y + 10), "Interval: 10 min", font=font_body, fill="#333344")
    draw.text((px + 14, bar_y + 35), "Jitter: 15%", font=font_body, fill="#333344")

    # Buttons
    btn_y = py + ph - 50
    draw.rounded_rectangle(
        [(px + 14, btn_y), (px + 100, btn_y + 32)], radius=4, fill=ACCENT
    )
    draw.text((px + 26, btn_y + 8), "Test Click", font=font_bar, fill=DARK_BG)
    draw.rounded_rectangle(
        [(px + 110, btn_y), (px + 200, btn_y + 32)], radius=4, fill="#e8e8f0"
    )
    draw.text((px + 122, btn_y + 8), "Settings", font=font_bar, fill="#1a1a2e")

    img.save(os.path.join(OUTPUT_DIR, "screenshot-popup-light.png"))
    print("Saved screenshot-popup-light.png")


if __name__ == "__main__":
    make_small_promo()
    make_marquee_promo()
    make_screenshot_dark()
    make_screenshot_light()
    print(f"\nAll assets saved to: {OUTPUT_DIR}")
