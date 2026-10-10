# Generates the pixel-art wooden hockey stick blade shown on button hover (src/styles/rink.css).
# Run: python3 tools/stick-sprite.py  -> prints the data URI for the CSS background.
import urllib.parse

GW, GH = 34, 17
grid = [[None] * GW for _ in range(GH)]
COL = {
    'O': '#0b0f1a',  # outline
    'c': '#f0c98a',  # varnished wood, lit edge
    'C': '#c98d4a',  # wood
    'K': '#8a5a2b',  # wood, shadow edge
    'h': '#a8703a',  # grain streak
    'r': '#3a2412',  # stamped maker's band
    'W': '#5a606c',  # black friction tape, catching the light
    'w': '#25282f',  # tape
    's': '#16181d',  # tape, underside
    'g': '#0e1014',  # tape wrap seams
    'B': '#d9a35e',  # bare wood blade at the heel
    'b': '#a8703a',  # its grain
}

# shaft: four pixels wide, coming down from the top right to the heel
for y in range(0, 12):
    cx = round(30 - 0.8 * y)
    for i, k in enumerate('cCCK'):
        grid[y][cx - 2 + i] = k
    if y % 3 == 1:
        grid[y][cx - 1] = 'h'  # wood grain running along the shaft
    if y in (4, 5):
        grid[y][cx - 1] = grid[y][cx] = 'r'

# blade: heel on the right, toe on the left curling up
def top(x):
    return {2: 9, 3: 9, 4: 10, 5: 10}.get(x, 10 if x >= 20 else 11)
def bottom(x):
    return {2: 12, 3: 13, 24: 13}.get(x, 14)
for x in range(2, 25):
    for y in range(top(x), bottom(x) + 1):
        t, b = top(x), bottom(x)
        k = 'W'
        if y == b:
            k = 's'
        elif y >= b - 1:
            k = 'w'
        if y > t and (x + y) % 3 == 0:
            k = 'g'  # slanted tape wraps
        if x >= 20:
            k = 'b' if y == t + 2 and x % 4 != 3 else 'B'  # untaped wooden heel, grain running lengthwise
        grid[y][x] = k

# outline every empty pixel that touches the stick
outline = []
for y in range(GH):
    for x in range(GW):
        if grid[y][x]:
            continue
        n = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        if any(0 <= a < GW and 0 <= b < GH and grid[b][a] and grid[b][a] != 'O' for a, b in n):
            outline.append((x, y))
for x, y in outline:
    grid[y][x] = 'O'

rects = ["<rect x='4' y='16' width='21' height='1' fill='#000' opacity='0.3'/>"]  # shadow on the ice
for y in range(GH):
    x = 0
    while x < GW:
        k = grid[y][x]
        if not k:
            x += 1
            continue
        run = 1
        while x + run < GW and grid[y][x + run] == k:
            run += 1
        rects.append(f"<rect x='{x}' y='{y}' width='{run}' height='1' fill='{COL[k]}'/>")
        x += run
svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {GW} {GH}' shape-rendering='crispEdges'>{''.join(rects)}</svg>"
print('data:image/svg+xml,' + urllib.parse.quote(svg, safe="=/:',' "))
