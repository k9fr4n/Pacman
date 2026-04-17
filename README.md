# PAC / GRID

A **Pac-Man** game in Three.js with a **Tron Legacy** visual identity:
neon cyan grid, bloom-lit walls, glowing orange player, procedural WebAudio SFX.

## Run it

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

> `file://` will **not** work — ES modules + importmap require HTTP.

## Controls

| Key | Action |
|-----|--------|
| `◀ ▲ ▼ ▶` / `WASD` / `ZQSD` | Move |
| `P` | Pause |
| `M` | Mute / Unmute |
| `Enter` / `Space` | Start |
| Swipe | Move (touch) |

## Features

- Classic 28×31 Pac-Man maze with tunnel wrap
- 4 ghosts with authentic Blinky/Pinky/Inky/Clyde targeting logic
- SCATTER / CHASE / FRIGHTENED / EATEN state machine + mode cycling
- **Cruise Elroy** — Blinky accelerates when few pellets remain
- Power pellets + ghost chain bonuses (200 → 400 → 800 → 1600)
- Bonus fruit (Tron identity-disc) at 70 and 170 pellets eaten
- **Progressive difficulty** — ghosts scale harder than Pac-Man
- Lives, level progression, shorter release timers + fright duration per level
- Three.js + UnrealBloomPass neon post-processing
- Tron Legacy palette (cyan `#6FC3DF` / orange `#F7A325` / yellow pellets `#FFEB3B`)
- Smooth follow-camera tracking Pac-Man
- WebAudio procedural SFX (chomp / power / eat-ghost / death / win)
- Classic "derezz" spin-and-fade death animation

## Project layout

```
.
├── index.html          # Entry + HUD + importmap
├── styles.css          # Tron HUD / overlay
└── src/
    ├── main.js         # Renderer, scene, bloom, loop, follow-cam
    ├── game.js         # Orchestration, scoring, states, difficulty
    ├── maze.js         # Layout + neon wall rendering + pellets
    ├── pacman.js       # Player entity & input
    ├── ghost.js        # 4 ghosts + AI
    ├── fruit.js        # Bonus identity-disc
    └── audio.js        # WebAudio synth SFX
```

## Difficulty scaling

| Level | Pac-Man | Ghosts | Ratio | Fright (s) | Clyde release |
|:-----:|:-------:|:------:|:-----:|:----------:|:-------------:|
| 1     | 5.40    | 5.10   |  94%  | 7.0 | 3.5 s |
| 3     | 5.76    | 5.70   |  99%  | 5.6 | 2.8 s |
| 5     | 6.12    | 6.30   | **103%** 🔥 | 4.2 | 2.1 s |
| 8     | 6.66    | 7.20   | **108%** | 2.1 | 1.1 s |

## ADR — CDN importmap vs npm bundler

Status       : Accepted
Context      : Triple-A-feeling Pac-Man, empty dir, no Node toolchain requested.
Decision     : Browser-native `<script type="importmap">` → pinned Three.js 0.160.
Consequences :
  + No build step, trivial hosting on any static server.
  + Source files shipped as-is, easy to tweak.
  - Requires modern browser (Chrome 89+, Firefox 108+, Safari 16.4+).
  - First load depends on pinned `unpkg.com` CDN.
