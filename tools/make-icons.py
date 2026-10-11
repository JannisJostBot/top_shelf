#!/usr/bin/env python3
"""Renders the app icons from public/icon.svg (pixel art on a 32x32 grid of plain rects).

Every size is a whole-number scale of the grid, so the pixels stay crisp; sizes that are not a multiple of 32 get
a border in the icon's background colour. Writes into public/:
  favicon.ico            32x32 (a PNG inside an ICO, for browsers that ask for /favicon.ico)
  icon-32.png            browser tab
  apple-touch-icon.png   180x180, iOS home screen (iOS rounds the corners itself)
  icon-192.png, icon-512.png    Android / install prompts
  icon-maskable-512.png  the art inside the central safe zone, so any mask shape (circle, squircle) keeps it whole
Run: python3 tools/make-icons.py
"""
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'icon.svg'
OUT = ROOT / 'public'
GRID = 32


def parse():
    svg = SRC.read_text()
    rects = []
    for m in re.finditer(r'<rect([^>]*)/>', svg):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        rects.append((int(a.get('x', 0)), int(a.get('y', 0)), int(a['width']), int(a['height']), a['fill']))
    return rects


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def grid_pixels(rects):
    px = [[(0, 0, 0)] * GRID for _ in range(GRID)]
    for x, y, w, h, fill in rects:
        c = rgb(fill)
        for j in range(y, min(GRID, y + h)):
            for i in range(x, min(GRID, x + w)):
                px[j][i] = c
    return px


def render(px, size, art):
    """size x size image with the grid scaled to `art` pixels (a multiple of 32), centred on the background."""
    s = art // GRID
    bg = px[0][0]
    off = (size - GRID * s) // 2
    rows = []
    for y in range(size):
        gy = (y - off) // s
        row = bytearray()
        for x in range(size):
            gx = (x - off) // s
            c = px[gy][gx] if 0 <= gx < GRID and 0 <= gy < GRID and y >= off and x >= off else bg
            row += bytes(c)
        rows.append(bytes(row))
    return rows


def png(rows, size):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )


def ico(png_bytes, size):
    # an ICO with one PNG image inside
    header = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(png_bytes), 6 + 16)
    return header + entry + png_bytes


def main():
    px = grid_pixels(parse())
    out = {
        'icon-32.png': (32, 32),
        'apple-touch-icon.png': (180, 160),
        'icon-192.png': (192, 192),
        'icon-512.png': (512, 512),
        'icon-maskable-512.png': (512, 320),  # inside the 80% safe zone with room to spare
    }
    for name, (size, art) in out.items():
        (OUT / name).write_bytes(png(render(px, size, art), size))
        print('wrote', name)
    (OUT / 'favicon.ico').write_bytes(ico(png(render(px, 32, 32), 32), 32))
    print('wrote favicon.ico')


if __name__ == '__main__':
    main()
