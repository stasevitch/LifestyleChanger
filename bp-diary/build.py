#!/usr/bin/env python3
"""Builds the installable web app (dist/) from src/app.html."""
import pathlib, shutil, hashlib
root = pathlib.Path(__file__).parent
src = (root / "src/app.html").read_text()
head, body = src.split("<!-- /head -->", 1)
dist = root / "dist"
if dist.exists():
    shutil.rmtree(dist)
shutil.copytree(root / "public", dist)
version = hashlib.sha1(src.encode()).hexdigest()[:8]
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f3f6f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d141a" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="BP Diary">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head.strip()}
</head>
<body>
{body.strip()}
</body>
</html>
"""
(dist / "index.html").write_text(html)
sw = (dist / "sw.js").read_text().replace("__VERSION__", version)
(dist / "sw.js").write_text(sw)
print("built dist/ version", version)
