"""
MyGameON Studio - Automated Shopee Listing Slides Generator
Generates:
  - SLIDE_1_THUMBNAIL.jpg (Portrait poster with frame and dynamic Jersey 10 title)
  - SLIDE_2_GAMEPLAY_4IN1.jpg (2x2 Arcade Console Gameplay collage)
  - SLIDE_3_ALUR_ORDER.jpg
  - SLIDE_4_PANDUAN_DOWNLOAD_EKSTRAK.jpg
  - SLIDE_5_GARANSI_ADMIN.jpg
  - SLIDE_6_PROMO_BUNDLING.jpg
  - INFO_SHOPEE.txt (SEO Title & Safe Description)
"""

import os
import sys
import json
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, "listing_assets")
FRAME_PATH = os.path.join(ASSETS_DIR, "master_frame_portrait_v2.png")
UNIVERSAL_DIR = os.path.join(ASSETS_DIR, "universal_slides")

BOX_LEFT = 48
BOX_TOP = 194
BOX_RIGHT = 512
BOX_BOTTOM = 836
BOX_W = BOX_RIGHT - BOX_LEFT  # 464 px
BOX_H = BOX_BOTTOM - BOX_TOP  # 642 px

GRID_COORDS = [
    (55, 235),   # Top Left
    (525, 235),  # Top Right
    (55, 535),   # Bottom Left
    (525, 535)   # Bottom Right
]
CELL_W = 445
CELL_H = 250


def get_font(size):
    # Try Windows user fonts for Jersey 10
    local_font = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts\Jersey10-Regular.ttf")
    if os.path.exists(local_font):
        try:
            return ImageFont.truetype(local_font, size)
        except Exception:
            pass
    # Fallback to standard Windows bold font
    try:
        return ImageFont.truetype("arialbd.ttf", size)
    except Exception:
        return ImageFont.load_default()


def render_slide_1(clean_title, poster_path, output_path):
    frame = Image.open(FRAME_PATH).convert("RGBA")
    canvas = Image.new("RGBA", (1024, 1024), (26, 26, 26, 255))
    
    poster = Image.open(poster_path).convert("RGBA")
    p_w, p_h = poster.size
    aspect = p_w / p_h

    if aspect < 0.85:
        # Portrait poster
        ratio = max(BOX_W / p_w, BOX_H / p_h)
        new_w = int(p_w * ratio)
        new_h = int(p_h * ratio)
        poster_resized = poster.resize((new_w, new_h), Image.Resampling.LANCZOS)
        crop_x = (new_w - BOX_W) // 2
        crop_y = (new_h - BOX_H) // 2
        poster_in_box = poster_resized.crop((crop_x, crop_y, crop_x + BOX_W, crop_y + BOX_H))
    else:
        # Square or landscape smart fit with blurred background
        r_cover = max(BOX_W / p_w, BOX_H / p_h)
        bg = poster.resize((int(p_w * r_cover), int(p_h * r_cover)), Image.Resampling.LANCZOS)
        cx = (bg.width - BOX_W) // 2
        cy = (bg.height - BOX_H) // 2
        bg_cropped = bg.crop((cx, cy, cx + BOX_W, cy + BOX_H))
        bg_blurred = bg_cropped.filter(ImageFilter.GaussianBlur(radius=20))
        dark_layer = Image.new("RGBA", (BOX_W, BOX_H), (0, 0, 0, 130))
        poster_in_box = Image.alpha_composite(bg_blurred, dark_layer)
        
        r_fit = min(BOX_W / p_w, BOX_H / p_h)
        fg_w = int(p_w * r_fit)
        fg_h = int(p_h * r_fit)
        fg = poster.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        px = (BOX_W - fg_w) // 2
        py = (BOX_H - fg_h) // 2
        poster_in_box.paste(fg, (px, py), fg)

    canvas.paste(poster_in_box, (BOX_LEFT, BOX_TOP))
    canvas.paste(frame, (0, 0), frame)

    draw = ImageDraw.Draw(canvas)
    if len(clean_title) > 34:
        font_size = 48
    elif len(clean_title) > 26:
        font_size = 56
    elif len(clean_title) > 18:
        font_size = 64
    else:
        font_size = 70

    font = get_font(font_size)
    bbox = draw.textbbox((0, 0), clean_title, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    text_x = 512 - (text_w / 2)
    text_y = 912 - (text_h / 2) - bbox[1]
    draw.text((text_x, text_y), clean_title, font=font, fill=(0, 0, 0, 255))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    canvas.convert("RGB").save(output_path, quality=95)
    return output_path


def _is_valid_image(file_path):
    if not os.path.exists(file_path):
        return False
    try:
        with Image.open(file_path) as img:
            img.verify()
        return True
    except Exception:
        return False


def render_slide_2(clean_title, screenshot_paths, poster_path, output_path):
    # Filter valid images
    valid_shots = [s for s in screenshot_paths if _is_valid_image(s)]
    if not valid_shots:
        if _is_valid_image(poster_path):
            valid_shots = [poster_path]
        else:
            return None

    while len(valid_shots) < 4:
        valid_shots.append(valid_shots[len(valid_shots) % len(valid_shots)])

    shots = valid_shots[:4]

    src_frame = Image.open(FRAME_PATH).convert("RGBA")
    header = src_frame.crop((0, 0, 1024, 175))
    footer = src_frame.crop((0, 850, 1024, 1024))

    canvas = Image.new("RGBA", (1024, 1024), (22, 22, 22, 255))
    canvas.paste(header, (0, 0), header)
    canvas.paste(footer, (0, 850), footer)

    d = ImageDraw.Draw(canvas)

    # Console arcade container
    d.rounded_rectangle([(36, 200), (988, 825)], radius=20, fill=(45, 39, 65, 255), outline=(252, 198, 2, 255), width=4)
    d.rounded_rectangle([(42, 206), (982, 819)], radius=16, outline=(0, 0, 0, 255), width=2)

    # Place 4 screenshots in 2x2 grid
    for i, (x, y) in enumerate(GRID_COORDS):
        shot = Image.open(shots[i]).convert("RGBA")
        s_w, s_h = shot.size
        ratio = max(CELL_W / s_w, CELL_H / s_h)
        nw, nh = int(s_w * ratio), int(s_h * ratio)
        shot_res = shot.resize((nw, nh), Image.Resampling.LANCZOS)
        cx = (nw - CELL_W) // 2
        cy = (nh - CELL_H) // 2
        shot_crop = shot_res.crop((cx, cy, cx + CELL_W, cy + CELL_H))

        mask = Image.new("L", (CELL_W, CELL_H), 0)
        dm = ImageDraw.Draw(mask)
        dm.rounded_rectangle([(0, 0), (CELL_W, CELL_H)], radius=10, fill=255)
        canvas.paste(shot_crop, (x, y), mask)

        d.rounded_rectangle([(x, y), (x + CELL_W, y + CELL_H)], radius=10, outline=(252, 198, 2, 255), width=3)
        d.rounded_rectangle([(x + 1, y + 1), (x + CELL_W - 1, y + CELL_H - 1)], radius=9, outline=(0, 0, 0, 255), width=1)

    label = f"{clean_title} - GAMEPLAY"
    font_size = 64
    if len(label) > 34:
        font_size = 48
    elif len(label) > 26:
        font_size = 56
    font = get_font(font_size)

    bbox = d.textbbox((0, 0), label, font=font)
    text_x = 512 - (bbox[0] + bbox[2]) / 2
    text_y = 912 - (bbox[1] + bbox[3]) / 2
    d.text((text_x, text_y), label, font=font, fill=(0, 0, 0, 255))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    canvas.convert("RGB").save(output_path, quality=95)
    return output_path


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing config path"}))
        sys.exit(1)

    config_path = sys.argv[1]
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    clean_title = cfg["cleanTitle"].upper().strip()
    poster_path = cfg["posterPath"]
    screenshot_paths = cfg["screenshotPaths"]
    target_dir = cfg["targetDir"]
    seo_title = cfg.get("seoTitle", clean_title)
    description = cfg.get("description", "")

    os.makedirs(target_dir, exist_ok=True)

    # 1. Slide 1
    s1_path = os.path.join(target_dir, "SLIDE_1_THUMBNAIL.jpg")
    render_slide_1(clean_title, poster_path, s1_path)

    # 2. Slide 2
    s2_path = os.path.join(target_dir, "SLIDE_2_GAMEPLAY_4IN1.jpg")
    render_slide_2(clean_title, screenshot_paths, poster_path, s2_path)

    # 3. Slides 3-6
    universal_names = [
        "SLIDE_3_ALUR_ORDER.jpg",
        "SLIDE_4_PANDUAN_DOWNLOAD_EKSTRAK.jpg",
        "SLIDE_5_GARANSI_ADMIN.jpg",
        "SLIDE_6_PROMO_BUNDLING.jpg"
    ]
    copied_universal = []
    for uname in universal_names:
        src = os.path.join(UNIVERSAL_DIR, uname)
        dst = os.path.join(target_dir, uname)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            copied_universal.append(dst)

    # 4. INFO_SHOPEE.txt
    info_path = os.path.join(target_dir, "INFO_SHOPEE.txt")
    with open(info_path, "w", encoding="utf-8") as f:
        f.write(f"============================================================\n")
        f.write(f"JUDUL PRODUK SHOPEE ({len(seo_title)}/120 Karakter):\n")
        f.write(f"============================================================\n")
        f.write(f"{seo_title}\n\n")
        f.write(f"============================================================\n")
        f.write(f"DESKRIPSI PRODUK (100% Shopee Safe):\n")
        f.write(f"============================================================\n")
        f.write(f"{description}\n")

    result = {
        "success": True,
        "targetDir": target_dir,
        "slide1": s1_path,
        "slide2": s2_path,
        "universal": copied_universal,
        "infoFile": info_path
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
