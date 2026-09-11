"""
Generates all pixel-art PNG assets for the game procedurally with Pillow.
No external network access needed / no external art files.
Run: python3 generate_assets.py
Produces 16x16 pixel-grid art, upscaled with NEAREST to 64x64 for crisp
retro pixels at a usable on-screen size.
"""
import random
from PIL import Image

GRID = 16          # authoring grid
SCALE = 4           # 16 -> 64 px final
OUT = SCALE * GRID

TILE_DIR = "assets/tiles"
SPRITE_DIR = "assets/sprites"


def new_grid(bg=None):
    return [[bg for _ in range(GRID)] for _ in range(GRID)]


def render(grid, path):
    img = Image.new("RGBA", (GRID, GRID), (0, 0, 0, 0))
    px = img.load()
    for y in range(GRID):
        for x in range(GRID):
            c = grid[y][x]
            if c is not None:
                px[x, y] = c
    img = img.resize((OUT, OUT), Image.NEAREST)
    img.save(path)
    print("wrote", path)


def shade(color, amt):
    r, g, b = color[:3]
    a = color[3] if len(color) > 3 else 255
    r = max(0, min(255, r + amt))
    g = max(0, min(255, g + amt))
    b = max(0, min(255, b + amt))
    return (r, g, b, a)


def speckle(grid, base, rng, density=0.18, dark=-22, light=18, seed=0):
    r = random.Random(seed)
    for y in range(GRID):
        for x in range(GRID):
            grid[y][x] = base
    for y in range(GRID):
        for x in range(GRID):
            v = r.random()
            if v < density * 0.6:
                grid[y][x] = shade(base, dark)
            elif v < density:
                grid[y][x] = shade(base, light)
    return grid


# ---------------------------------------------------------------- TERRAIN --

def tile_grass(seed=1):
    base = (86, 138, 58, 255)
    g = new_grid()
    speckle(g, base, None, density=0.22, dark=-26, light=22, seed=seed)
    r = random.Random(seed + 99)
    for _ in range(6):
        x, y = r.randrange(GRID), r.randrange(GRID)
        g[y][x] = shade(base, 34)
    return g


def tile_plains(seed=2):
    base = (176, 158, 84, 255)
    g = new_grid()
    speckle(g, base, None, density=0.16, dark=-20, light=18, seed=seed)
    return g


def tile_forest(seed=3):
    base = (58, 96, 48, 255)
    g = new_grid()
    speckle(g, base, None, density=0.14, dark=-18, light=10, seed=seed)
    r = random.Random(seed + 5)
    trunk = (69, 48, 30, 255)
    leaf = (40, 74, 34, 255)
    clumps = [(4, 4), (11, 3), (7, 9), (3, 12), (12, 11)]
    for cx, cy in clumps:
        jx = cx + r.randint(-1, 1)
        jy = cy + r.randint(-1, 1)
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                x, y = jx + dx, jy + dy
                if 0 <= x < GRID and 0 <= y < GRID and dx * dx + dy * dy <= 2:
                    g[y][x] = shade(leaf, r.randint(-10, 10))
        if 0 <= jy + 2 < GRID:
            g[jy + 2][jx] = trunk
    return g


def tile_water(seed=4):
    base = (54, 98, 158, 255)
    g = new_grid()
    speckle(g, base, None, density=0.10, dark=-14, light=10, seed=seed)
    r = random.Random(seed + 3)
    wave = (120, 170, 214, 255)
    for row in (3, 4, 9, 10, 13):
        start = r.randint(0, 4)
        for x in range(start, min(GRID, start + r.randint(4, 8))):
            g[row][x] = wave
    return g


def tile_mountain(seed=5):
    base = (120, 112, 104, 255)
    g = new_grid()
    speckle(g, base, None, density=0.20, dark=-24, light=20, seed=seed)
    r = random.Random(seed + 7)
    peak_light = (214, 208, 198, 255)
    dark = (74, 68, 62, 255)
    for x in range(GRID):
        h = int(4 + 5 * abs(((x / GRID) - 0.5)) * -2 + 6)
    # simple triangular peak silhouette
    peak_x = GRID // 2
    for y in range(2, GRID):
        half = max(0, (y - 2))
        for x in range(peak_x - half, peak_x + half + 1):
            if 0 <= x < GRID:
                g[y][x] = shade(dark, r.randint(-6, 10))
    for y in range(2, 6):
        half = max(0, (y - 2))
        for x in range(peak_x - half, peak_x + half + 1):
            if 0 <= x < GRID and r.random() < 0.6:
                g[y][x] = peak_light
    return g


def tile_hills(seed=6):
    base = (128, 128, 66, 255)
    g = new_grid()
    speckle(g, base, None, density=0.18, dark=-20, light=16, seed=seed)
    r = random.Random(seed + 9)
    dark = shade(base, -30)
    for cx, cy in [(4, 10), (11, 9), (8, 13)]:
        for dy in range(-1, 2):
            for dx in range(-2, 3):
                x, y = cx + dx, cy + dy
                if 0 <= x < GRID and 0 <= y < GRID and abs(dx) + abs(dy) <= 2:
                    g[y][x] = dark
    return g


def tile_road(seed=7):
    base = (168, 142, 96, 255)
    g = new_grid()
    speckle(g, base, None, density=0.12, dark=-18, light=14, seed=seed)
    return g


# ---------------------------------------------------------------- SPRITES --

def sprite_party():
    """A standing warrior figure (the player's marker on the campaign map),
    facing right — render.js flips it horizontally when moving left."""
    g = new_grid()
    skin = (222, 176, 140, 255)
    hair = (74, 52, 34, 255)
    tunic = (176, 32, 32, 255)
    tunic_hi = (206, 56, 46, 255)
    belt = (74, 52, 30, 255)
    pants = (66, 64, 74, 255)
    boot = (38, 32, 26, 255)
    cape = (128, 22, 22, 255)
    shield = (110, 76, 40, 255)
    shield_rim = (166, 130, 72, 255)
    blade = (206, 206, 214, 255)
    hilt = (120, 90, 40, 255)
    shadow = (0, 0, 0, 70)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    rect(6, 10, 14, 14, shadow)
    # cape trailing behind
    rect(4, 5, 5, 8, cape)
    g[9][4] = cape
    # shield on the trailing arm
    rect(3, 5, 6, 8, shield)
    g[6][4] = shield_rim; g[8][4] = shield_rim
    # legs / boots
    rect(6, 7, 10, 11, pants)
    rect(9, 10, 10, 11, pants)
    rect(6, 7, 12, 13, boot)
    rect(9, 10, 12, 13, boot)
    # belt + torso
    rect(6, 10, 9, 9, belt)
    rect(6, 10, 5, 8, tunic)
    rect(10, 10, 5, 8, tunic_hi)
    # head
    rect(7, 9, 2, 4, skin)
    rect(7, 9, 1, 1, hair)
    # raised sword arm
    rect(11, 11, 4, 6, skin)
    g[3][11] = hilt
    rect(11, 12, 0, 2, blade)
    return g


def sprite_village():
    g = new_grid()
    wall = (196, 168, 120, 255)
    roof = (140, 62, 44, 255)
    for hx in (3, 9):
        for y in range(9, 13):
            for x in range(hx, hx + 4):
                g[y][x] = wall
        for i, y in enumerate(range(6, 9)):
            for x in range(hx - i, hx + 4 + i):
                if 0 <= x < GRID:
                    g[y][x] = roof
    return g


def sprite_town():
    """A walled town: a full perimeter wall ring with several rooftops
    visible inside — reads as "buildings behind walls" rather than a
    single building, distinguishing it from both the castle (no houses)
    and the village (no wall at all)."""
    g = new_grid()
    wall = (176, 176, 176, 255)
    wall_d = (128, 128, 128, 255)
    gate = (58, 50, 42, 255)
    roof = (150, 66, 40, 255)
    roof_hi = (176, 88, 54, 255)
    house = (196, 168, 120, 255)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    # perimeter wall ring
    rect(2, 13, 5, 5, wall_d)   # top
    rect(2, 13, 14, 14, wall)   # bottom
    rect(2, 2, 5, 14, wall_d)   # left
    rect(13, 13, 5, 14, wall_d)  # right
    for x in range(2, 14, 2):
        g[4][x] = wall_d  # crenellations
    g[14][7] = gate; g[14][8] = gate  # gate

    # three rooftops peeking up inside the walls (kept clear of the x=2/13
    # wall columns so the ring stays unbroken)
    for hx, peak in ((3, roof_hi), (7, roof), (10, roof_hi)):
        rect(hx, hx + 2, 9, 12, house)
        rect(hx, hx + 2, 7, 8, peak)
    return g


def sprite_castle():
    """A pure fortress — twin towers, a crenellated curtain wall, a keep
    behind it, no houses at all — so it never reads as "a town"."""
    g = new_grid()
    stone = (150, 150, 158, 255)
    stone_d = (104, 104, 112, 255)
    dark = (70, 68, 76, 255)
    gold = (224, 188, 74, 255)
    banner = (150, 30, 30, 255)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    # keep (taller, set back)
    rect(6, 9, 4, 9, stone_d)
    rect(6, 9, 3, 3, dark)
    # curtain wall across the front
    rect(3, 12, 9, 15, stone)
    for x in range(3, 13, 2):
        g[8][x] = stone_d  # merlons
    rect(3, 12, 10, 10, stone_d)
    # twin flanking towers
    for tx in (2, 13):
        rect(tx - 1, tx + 1, 5, 15, stone_d)
        for x in range(tx - 1, tx + 2, 2):
            g[4][x] = dark  # merlons on the towers
        g[3][tx] = gold
        rect(tx, tx, 0, 2, banner)
        g[3][tx] = gold
    return g


def sprite_trader():
    """A merchant cart — the wandering-trader NPC icon."""
    g = new_grid()
    wheel = (45, 34, 24, 255)
    wheel_hi = (80, 62, 44, 255)
    bed = (120, 82, 48, 255)
    bed_d = (90, 60, 34, 255)
    sack = (196, 168, 120, 255)
    sack_hi = (214, 188, 140, 255)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    rect(2, 4, 11, 13, wheel); g[11][3] = wheel_hi
    rect(10, 12, 11, 13, wheel); g[11][11] = wheel_hi
    rect(1, 13, 8, 11, bed)
    rect(1, 13, 8, 8, bed_d)
    rect(2, 6, 3, 8, sack)
    rect(7, 11, 3, 8, sack)
    rect(3, 5, 3, 4, sack_hi)
    rect(8, 10, 3, 4, sack_hi)
    return g


def sprite_lord():
    """A mounted lord/knight — the wandering-army NPC icon. Drawn in
    neutral stone/leather colours; render.js adds the kingdom's banner
    colour on the small pennant at render time (same trick as the
    settlement flags), so one sprite serves every kingdom."""
    g = new_grid()
    horse = (92, 64, 42, 255)
    horse_d = (58, 40, 26, 255)
    armor = (150, 150, 158, 255)
    armor_d = (104, 104, 112, 255)
    skin = (222, 176, 140, 255)
    pole = (90, 66, 46, 255)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    rect(2, 12, 9, 12, horse)
    rect(2, 12, 12, 12, horse_d)
    rect(2, 3, 13, 14, horse_d)
    rect(10, 11, 13, 14, horse_d)
    rect(11, 13, 6, 9, horse_d)  # neck/head forward
    rect(6, 9, 4, 8, armor)
    rect(9, 9, 4, 8, armor_d)
    rect(7, 8, 2, 3, skin)
    g[1][7] = armor_d; g[1][8] = armor_d
    for y in range(0, 5):
        g[y][11] = pole
    return g


def sprite_bandit():
    """A roaming bandit/smuggler — dark, ragged colours and a crude axe so
    it reads as hostile at a glance, distinct from the player (red tunic)
    and the lord (grey armor + banner)."""
    g = new_grid()
    cloak = (58, 54, 50, 255)
    cloak_hi = (78, 72, 64, 255)
    hood = (40, 38, 36, 255)
    skin = (196, 154, 118, 255)
    pants = (46, 42, 38, 255)
    boot = (30, 26, 22, 255)
    axe_handle = (90, 66, 46, 255)
    axe_head = (150, 150, 158, 255)

    def rect(x0, x1, y0, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < GRID and 0 <= y < GRID:
                    g[y][x] = color

    rect(6, 10, 14, 14, (0, 0, 0, 70))  # shadow
    rect(6, 7, 10, 13, pants); rect(9, 10, 10, 13, pants)
    rect(6, 7, 12, 13, boot); rect(9, 10, 12, 13, boot)
    rect(6, 10, 9, 9, cloak_hi)
    rect(6, 10, 5, 8, cloak)
    rect(4, 5, 6, 9, cloak)  # ragged cape flap
    rect(7, 9, 2, 4, skin)
    rect(7, 9, 1, 2, hood)
    g[3][6] = hood; g[3][10] = hood
    # axe raised on the trailing arm
    rect(11, 11, 3, 7, axe_handle)
    rect(11, 13, 1, 3, axe_head)
    return g


if __name__ == "__main__":
    import os
    os.makedirs(TILE_DIR, exist_ok=True)
    os.makedirs(SPRITE_DIR, exist_ok=True)

    render(tile_grass(), f"{TILE_DIR}/grass.png")
    render(tile_plains(), f"{TILE_DIR}/plains.png")
    render(tile_forest(), f"{TILE_DIR}/forest.png")
    render(tile_water(), f"{TILE_DIR}/water.png")
    render(tile_mountain(), f"{TILE_DIR}/mountain.png")
    render(tile_hills(), f"{TILE_DIR}/hills.png")
    render(tile_road(), f"{TILE_DIR}/road.png")

    render(sprite_party(), f"{SPRITE_DIR}/party.png")
    render(sprite_village(), f"{SPRITE_DIR}/village.png")
    render(sprite_town(), f"{SPRITE_DIR}/town.png")
    render(sprite_castle(), f"{SPRITE_DIR}/castle.png")
    render(sprite_trader(), f"{SPRITE_DIR}/trader.png")
    render(sprite_lord(), f"{SPRITE_DIR}/lord.png")
    render(sprite_bandit(), f"{SPRITE_DIR}/bandit.png")

    print("done")
