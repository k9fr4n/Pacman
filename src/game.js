// =============================================================
// game.js — orchestration: input, state, scoring, collisions
// =============================================================

import * as THREE from "three";
import { Maze, COLS, ROWS } from "./maze.js";
import { Pacman, DIR } from "./pacman.js";
import { Ghost } from "./ghost.js";
import { Fruit } from "./fruit.js";
import * as Audio from "./audio.js";

const GHOST_POINTS = [200, 400, 800, 1600];
const STATE = {
  READY: "READY",
  PLAYING: "PLAYING",
  DYING: "DYING",
  WON: "WON",
  GAME_OVER: "GAME_OVER",
  PAUSED: "PAUSED",
};

export class Game {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;

    this.maze = new Maze(scene);
    this.pacman = new Pacman(scene, this.maze, 13.5, 23);

    this.ghosts = [
      new Ghost(scene, this.maze, "blinky", 13, 11, 0),
      new Ghost(scene, this.maze, "pinky",  13, 14, 0.5),
      new Ghost(scene, this.maze, "inky",   12, 14, 1.8),
      new Ghost(scene, this.maze, "clyde",  15, 14, 3.5),
    ];
    this.blinky = this.ghosts[0];

    this.fruit = new Fruit(scene, this.maze, 13.5, 17);
    this._fruitSpawned = { a: false, b: false };
    this._totalPelletsAtLevelStart = this.maze.pelletCount;

    this.pacman.onEat = (kind, col, row) => this._onEat(kind, col, row);

    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.ghostChainIdx = 0;
    this.powerTimer = 0;
    this.powerDuration = 7.0;
    this.state = STATE.READY;
    this.readyTimer = 2.0;
    this.dyingTimer = 0;
    this.modeCycle = 0;

    this._bindInput();
    this._refreshHud();
  }

  _bindInput() {
    const keyToDir = {
      ArrowUp: DIR.UP, ArrowDown: DIR.DOWN, ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
      w: DIR.UP, s: DIR.DOWN, a: DIR.LEFT, d: DIR.RIGHT,
      W: DIR.UP, S: DIR.DOWN, A: DIR.LEFT, D: DIR.RIGHT,
      z: DIR.UP, q: DIR.LEFT, Z: DIR.UP, Q: DIR.LEFT,
    };

    window.addEventListener("keydown", (e) => {
      if (keyToDir[e.key]) {
        this.pacman.setInput(keyToDir[e.key]);
        e.preventDefault();
      } else if (e.key === "p" || e.key === "P") {
        this.togglePause();
      } else if (e.key === "m" || e.key === "M") {
        const muted = Audio.toggleMute();
        this._flash(muted ? "MUTED" : "SOUND ON", 0.8);
      }
    });

    let tsx = 0, tsy = 0;
    window.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      tsx = t.clientX; tsy = t.clientY;
    }, { passive: true });
    window.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - tsx, dy = t.clientY - tsy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) this.pacman.setInput(dx > 0 ? DIR.RIGHT : DIR.LEFT);
      else                              this.pacman.setInput(dy > 0 ? DIR.DOWN  : DIR.UP);
    }, { passive: true });
  }

  start() {
    this.state = STATE.READY;
    this.readyTimer = 1.6;
    this._flash("READY", 1.4);
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this._flash("PAUSED", 999);
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this._flash("", 0);
    }
  }

  _flash(text, seconds = 1.5) {
    if (!this.hud.message) return;
    this.hud.message.textContent = text;
    if (text) this.hud.message.classList.add("show");
    else       this.hud.message.classList.remove("show");
    clearTimeout(this._flashTimeout);
    if (seconds > 0 && seconds < 10) {
      this._flashTimeout = setTimeout(() => {
        this.hud.message.classList.remove("show");
      }, seconds * 1000);
    }
  }

  _refreshHud() {
    this.hud.score.textContent = String(this.score).padStart(5, "0");
    this.hud.level.textContent = `LEVEL ${String(this.level).padStart(2, "0")}`;
    this.hud.lives.textContent = "▲ ".repeat(Math.max(0, this.lives)).trim();
  }

  _onEat(kind, col, row) {
    if (kind === "pellet") {
      this.score += 10;
      Audio.chomp();
    } else if (kind === "power") {
      this.score += 50;
      const dur = this.powerDuration;
      this.powerTimer = dur;
      this.ghostChainIdx = 0;
      for (const g of this.ghosts) g.frighten(dur);
      Audio.power();
    }
    this._refreshHud();

    // Fruit spawn thresholds (70 / 170 eaten — classic Pac-Man).
    const eaten = this._totalPelletsAtLevelStart - this.maze.remaining;
    if (!this._fruitSpawned.a && eaten >= 70) {
      this._fruitSpawned.a = true;
      this.fruit.spawn(9.0);
    } else if (!this._fruitSpawned.b && eaten >= 170) {
      this._fruitSpawned.b = true;
      this.fruit.spawn(9.0);
    }

    // CRUISE ELROY — Blinky accelerates when few pellets remain.
    const remaining = this.maze.remaining;
    const elroy1 = 20 + Math.max(0, (this.level - 1) * 5);
    const elroy2 = 10 + Math.max(0, (this.level - 1) * 3);
    if (remaining < elroy2)      this.blinky.speed = this.pacman.speed + 0.6;
    else if (remaining < elroy1) this.blinky.speed = this.pacman.speed + 0.2;

    if (this.maze.remaining <= 0) this._onWin();
  }

  _onWin() {
    this.state = STATE.WON;
    this._flash("GRID CLEARED", 2.2);
    this.fruit.consume();
    Audio.win();
    setTimeout(() => this._nextLevel(), 2400);
  }

  _nextLevel() {
    this.level++;
    this.maze.group.parent.remove(this.maze.group);
    this.maze = new Maze(this.scene);
    this.pacman.maze = this.maze;
    for (const g of this.ghosts) g.maze = this.maze;
    this.fruit.maze = this.maze;
    this._fruitSpawned = { a: false, b: false };
    this._totalPelletsAtLevelStart = this.maze.pelletCount;

    this._applyLevelDifficulty();

    this.pacman.reset();
    for (const g of this.ghosts) g.reset();
    this.state = STATE.READY;
    this.readyTimer = 1.6;
    this._flash("READY", 1.4);
    this._refreshHud();
  }

  // Progressive difficulty — ghosts scale harder than Pac-Man.
  _applyLevelDifficulty() {
    const L = this.level - 1;
    this.pacman.speed = Math.min(7.4, 5.4 + L * 0.18);
    const ghostBase   = Math.min(7.2, 5.1 + L * 0.30);
    for (const g of this.ghosts) g.speed = ghostBase;

    // Release timers shrink with level — almost instant by level 5.
    const rel = [0, 0.5, 1.8, 3.5].map((v) => Math.max(0, v - L * 0.35));
    this.ghosts.forEach((g, i) => { g.defaultRelease = rel[i]; });

    // Power-pellet fright duration shrinks — shorter safety window.
    this.powerDuration = Math.max(2.0, 7.0 - L * 0.7);
  }

  _onDeath() {
    this.state = STATE.DYING;
    this.dyingTimer = 1.8;
    this.pacman.alive = false;
    Audio.death();
  }

  _respawn() {
    this.fruit.consume();
    this.lives--;
    this._refreshHud();
    if (this.lives < 0) {
      this.state = STATE.GAME_OVER;
      this._flash("GAME OVER", 999);
      return;
    }
    this.pacman.reset();
    for (const g of this.ghosts) g.reset();
    this.state = STATE.READY;
    this.readyTimer = 1.4;
    this._flash("READY", 1.2);
  }

  _checkCollisions() {
    const px = this.pacman.col, py = this.pacman.row;
    for (const g of this.ghosts) {
      if (g.inHouse) continue;
      const dx = g.col - px, dy = g.row - py;
      if (dx * dx + dy * dy < 0.55 * 0.55) {
        if (g.mode === "FRIGHTENED") {
          const pts = GHOST_POINTS[Math.min(this.ghostChainIdx, 3)];
          this.score += pts;
          this.ghostChainIdx++;
          g.eaten();
          Audio.eatGhost();
          this._flash(`+${pts}`, 0.8);
          this._refreshHud();
        } else if (g.mode !== "EATEN") {
          this._onDeath();
          return;
        }
      }
    }
  }

  _updateGhostModes(dt) {
    this.modeCycle += dt;
    const phases = [
      { mode: "SCATTER", dur: 7 },
      { mode: "CHASE",   dur: 20 },
      { mode: "SCATTER", dur: 7 },
      { mode: "CHASE",   dur: 20 },
      { mode: "SCATTER", dur: 5 },
      { mode: "CHASE",   dur: Infinity },
    ];
    let t = this.modeCycle;
    let active = "CHASE";
    for (const p of phases) {
      if (t < p.dur) { active = p.mode; break; }
      t -= p.dur;
    }
    for (const g of this.ghosts) {
      if (g.mode !== "FRIGHTENED" && g.mode !== "EATEN") g.setMode(active);
    }
  }

  update(dt, time) {
    this.maze.update(dt, time);
    this.fruit.update(dt, time);

    // Fruit pickup
    if (this.fruit.active) {
      const dx = this.fruit.col - this.pacman.col;
      const dy = this.fruit.row - this.pacman.row;
      if (dx * dx + dy * dy < 0.5 * 0.5) {
        const pts = this.fruit.points;
        this.score += pts;
        this.fruit.consume();
        this._flash(`+${pts}`, 0.8);
        this._refreshHud();
        Audio.eatGhost();
      }
    }

    if (this.state === STATE.PAUSED || this.state === STATE.GAME_OVER) return;

    if (this.state === STATE.READY) {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) {
        this.state = STATE.PLAYING;
        this._flash("", 0);
      }
      return;
    }

    if (this.state === STATE.DYING) {
      this.dyingTimer -= dt;
      // Classic "derezz" : spin + shrink + fade.
      const p = Math.max(0, this.dyingTimer / 1.8);
      this.pacman.group.scale.setScalar(p);
      this.pacman.group.rotation.y += dt * 14;
      this.pacman.bodyMat.emissiveIntensity = 1.6 + (1 - p) * 4;
      if (this.dyingTimer <= 0) {
        this.pacman.group.scale.setScalar(1);
        this.pacman.bodyMat.emissiveIntensity = 1.6;
        this._respawn();
      }
      return;
    }

    if (this.state !== STATE.PLAYING) return;

    if (this.powerTimer > 0) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) this.ghostChainIdx = 0;
    }

    this._updateGhostModes(dt);
    this.pacman.update(dt);
    for (const g of this.ghosts) g.update(dt, this.pacman, this.blinky);
    this._checkCollisions();
  }
}
