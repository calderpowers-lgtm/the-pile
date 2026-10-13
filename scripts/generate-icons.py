"""Build favicon, PWA icons, and the in-app mark from the stone logo."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "brand" / "logo-source.png"
PUBLIC = ROOT / "public" / "icons"
BRAND = ROOT / "public" / "brand"
APP = ROOT / "src" / "app"

CREAM = (249, 246, 240, 255)
# Pixels this close to the photographed backdrop become the page cream, or clear.
BG_THRESHOLD = 28


def load() -> Image.Image:
    return Image.open(SOURCE).convert("RGBA")


def backdrop(image: Image.Image) -> tuple[int, int, int]:
    pixel = image.getpixel((8, 8))
    return pixel[0], pixel[1], pixel[2]


def close_to_backdrop(pixel: tuple[int, int, int, int], bg: tuple[int, int, int]) -> bool:
    return abs(pixel[0] - bg[0]) + abs(pixel[1] - bg[1]) + abs(pixel[2] - bg[2]) <= BG_THRESHOLD


def flatten(image: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    """Paint the photographed cream so it matches the page, #F9F6F0."""
    out = image.copy()
    pixels = out.load()
    width, height = out.size
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if close_to_backdrop(pixel, bg):
                pixels[x, y] = CREAM
    return out


def stones(image: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    """Crop the stack and drop the backdrop so the mark sits on any surface."""
    crop = image.crop((400, 220, 1052, 910))
    pixels = crop.load()
    width, height = crop.size
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if close_to_backdrop(pixel, bg):
                pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
    # Trim to the opaque pixels, then pad so the stones are not edge-to-edge.
    bbox = crop.getbbox()
    if bbox is None:
        return crop
    trimmed = crop.crop(bbox)
    pad = int(max(trimmed.size) * 0.08)
    canvas = Image.new("RGBA", (trimmed.width + pad * 2, trimmed.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(trimmed, (pad, pad), trimmed)
    return canvas


def fit(image: Image.Image, size: int, pad_ratio: float = 0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), CREAM)
    if pad_ratio:
        inner = int(size * (1 - pad_ratio * 2))
    else:
        inner = size
    resized = image.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(resized, (offset, offset), resized)
    return canvas


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    BRAND.mkdir(parents=True, exist_ok=True)
    image = load()
    bg = backdrop(image)
    flat = flatten(image, bg)
    flat.save(BRAND / "logo.png")
    stones(image, bg).save(BRAND / "mark.png")

    fit(flat, 192).save(PUBLIC / "icon-192.png")
    fit(flat, 512).save(PUBLIC / "icon-512.png")
    fit(flat, 512, pad_ratio=0.12).save(PUBLIC / "icon-maskable-512.png")
    fit(flat, 180).save(PUBLIC / "apple-touch-icon.png")
    fit(flat, 512).save(APP / "icon.png")
    fit(flat, 180).save(APP / "apple-icon.png")
    favicon = fit(flat, 64).resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(APP / "favicon.ico", sizes=[(32, 32)])


if __name__ == "__main__":
    main()
