#!/usr/bin/env python3
"""Draws the app icon: a dumbbell on a teal square."""
from PIL import Image, ImageDraw
def icon(size, maskable=False, path=""):
    S = size * 4
    img = Image.new("RGB", (S, S), (15, 107, 92))
    d = ImageDraw.Draw(img)
    k = 0.78 if maskable else 1.0
    c = S / 2
    def box(x0, y0, x1, y1, r):
        d.rounded_rectangle([c + x0 * S * k, c + y0 * S * k, c + x1 * S * k, c + y1 * S * k], radius=r * S * k, fill=(255, 255, 255))
    box(-0.20, -0.035, 0.20, 0.035, 0.02)          # handle
    for s in (-1, 1):
        x_in, x_out = s * 0.17, s * 0.25
        box(min(x_in, x_out), -0.20, max(x_in, x_out), 0.20, 0.03)   # big plate
        x_in2, x_out2 = s * 0.26, s * 0.32
        box(min(x_in2, x_out2), -0.13, max(x_in2, x_out2), 0.13, 0.025)  # small plate
    img.resize((size, size), Image.LANCZOS).save(path)
icon(192, path="public/icon-192.png")
icon(512, path="public/icon-512.png")
icon(512, maskable=True, path="public/icon-512-maskable.png")
icon(180, path="public/apple-touch-icon.png")
