#!/usr/bin/env python3
"""Draws the app icon: a heart-rate trace through a pressure gauge arc."""
from PIL import Image, ImageDraw
def icon(size, maskable=False, path=""):
    S = size * 4
    img = Image.new("RGB", (S, S), (29, 92, 140))
    d = ImageDraw.Draw(img)
    inset = S * (0.22 if maskable else 0.14)
    box = [inset, inset, S - inset, S - inset]
    w = int(S * 0.055)
    d.arc(box, start=150, end=390, fill=(225, 237, 246), width=w)
    cx, cy, r = S / 2, S / 2, (S - 2 * inset) / 2
    pts = [(-0.62, 0.12), (-0.25, 0.12), (-0.12, -0.28), (0.05, 0.42), (0.2, 0.0), (0.62, 0.0)]
    pts = [(cx + x * r, cy + y * r) for x, y in pts]
    d.line(pts, fill=(255, 255, 255), width=int(S * 0.06), joint="curve")
    for p in (pts[0], pts[-1]):
        rr = S * 0.03
        d.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=(255, 255, 255))
    img.resize((size, size), Image.LANCZOS).save(path)
icon(192, path="public/icon-192.png")
icon(512, path="public/icon-512.png")
icon(512, maskable=True, path="public/icon-512-maskable.png")
icon(180, path="public/apple-touch-icon.png")
