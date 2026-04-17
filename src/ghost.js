// =============================================================
// ghost.js — 4 ghosts w/ classic personalities, Tron palette
// =============================================================

import * as THREE from "three";
import { COLS, ROWS, gridToWorld } from "./maze.js";
import { DIR, dirOpposite } from "./pacman.js";

export const GHOST_COLORS = {
  blinky: 0xFF3355,
  pinky:  0xFF7BD5,
  inky:   0x6FC3DF,
  clyde:  0xF7A325,
};

const SCATTER_TARGETS = {
  blinky: { col: COLS - 2, row: 0 },
  pinky:  { col: 1, row: 0 },
  inky:   { col: COLS - 1, row: ROWS - 1 },
  clyde:  { col: 0, row: ROWS - 1 },
};

const EXIT = { col: 13, row: 11 };

export class Ghost {
  constructor(scene, maze, name, startCol, startRow, releaseDelay = 0) {
    this.maze = maze;
    this.name = name;
    this.color = GHOST_COLORS[name];
    this.startCol = startCol;
    this.startRow = startRow;
    this.defaultRelease = releaseDelay;

    this.col = startCol;
    this.row = startRow;
    this.dir = { ...DIR.UP };
    this.speed = 5.1;   // ~95% of Pac-Man (classic Blinky ratio)
    this.mode = "SCATTER";
    this.inHouse = name !== "blinky";
    this.releaseTimer = releaseDelay;
    this.frightenedTimer = 0;

    this._buildMesh();
    scene.add(this.group);
    this.syncMesh();
  }

  _buildMesh() {
    this.group = new THREE.Group();
    this.group.name = `Ghost-${this.name}`;

    const bodyGeo = new THREE.SphereGeometry(0.4, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.65);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 1.3,
      metalness: 0.2,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
    });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.group.add(this.body);

    const skirtGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 20, 1, true);
    this.skirt = new THREE.Mesh(skirtGeo, this.bodyMat);
    this.skirt.position.y = -0.25;
    this.group.add(this.skirt);

    const eyeGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(0.28, 0.1, -0.14);
    this.eyeR.position.set(0.28, 0.1,  0.14);
    this.group.add(this.eyeL, this.eyeR);

    const irisGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x001122 });
    this.irisL = new THREE.Mesh(irisGeo, irisMat);
    this.irisR = new THREE.Mesh(irisGeo, irisMat);
    this.eyeL.add(this.irisL); this.eyeR.add(this.irisR);
    this.irisL.position.x = 0.06; this.irisR.position.x = 0.06;

    this.glow = new THREE.PointLight(this.color, 1.3, 5, 2);
    this.group.add(this.glow);
  }

  reset() {
    this.col = this.startCol;
    this.row = this.startRow;
    this.dir = { ...DIR.UP };
    this.mode = "SCATTER";
    this.inHouse = this.name !== "blinky";
    this.releaseTimer = this.defaultRelease;
    this.frightenedTimer = 0;
    this._restoreColor();
    this._restoreOpacity();
    this.syncMesh();
  }

  setMode(mode) {
    if (this.mode === "EATEN" || this.mode === "FRIGHTENED") return;
    if (mode !== this.mode) this.dir = { x: -this.dir.x, y: -this.dir.y };
    this.mode = mode;
  }

  frighten(duration) {
    if (this.mode === "EATEN") return;
    this.mode = "FRIGHTENED";
    this.frightenedTimer = duration;
    this.dir = { x: -this.dir.x, y: -this.dir.y };
    this._setFrightenedColor();
  }

  eaten() {
    this.mode = "EATEN";
    this._restoreColor();
    this.bodyMat.opacity = 0.22;
    this.skirt.material.opacity = 0.22;
  }

  _setFrightenedColor() {
    this.bodyMat.color.setHex(0x0033ff);
    this.bodyMat.emissive.setHex(0x5599ff);
    this.glow.color.setHex(0x5599ff);
  }
  _restoreColor() {
    this.bodyMat.color.setHex(this.color);
    this.bodyMat.emissive.setHex(this.color);
    this.glow.color.setHex(this.color);
  }
  _restoreOpacity() {
    this.bodyMat.opacity = 0.95;
    this.skirt.material.opacity = 0.95;
  }

  _target(pacman, blinkyRef) {
    if (this.mode === "SCATTER") return SCATTER_TARGETS[this.name];
    if (this.mode === "EATEN")   return { col: EXIT.col, row: EXIT.row };
    if (this.mode === "FRIGHTENED") return null;
    const pc = pacman.tileCol, pr = pacman.tileRow;
    const pd = pacman.dir;
    switch (this.name) {
      case "blinky": return { col: pc, row: pr };
      case "pinky":  return { col: pc + pd.x * 4, row: pr + pd.y * 4 };
      case "inky": {
        const ax = pc + pd.x * 2, ay = pr + pd.y * 2;
        const bx = blinkyRef ? blinkyRef.tileCol : pc;
        const by = blinkyRef ? blinkyRef.tileRow : pr;
        return { col: ax + (ax - bx), row: ay + (ay - by) };
      }
      case "clyde": {
        const dx = pc - this.tileCol, dy = pr - this.tileRow;
        return dx * dx + dy * dy > 64
          ? { col: pc, row: pr }
          : SCATTER_TARGETS.clyde;
      }
    }
    return { col: pc, row: pr };
  }

  _chooseDirAtIntersection(pacman, blinkyRef) {
    const cc = Math.round(this.col);
    const rr = Math.round(this.row);
    const canDoor = this.mode === "EATEN";
    const candidates = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT].filter((d) => {
      if (dirOpposite(d, this.dir)) return false;
      return this.maze.isWalkableForGhost(cc + d.x, rr + d.y, canDoor);
    });
    if (candidates.length === 0) return { x: -this.dir.x, y: -this.dir.y };
    if (this.mode === "FRIGHTENED") {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const target = this._target(pacman, blinkyRef);
    let best = candidates[0], bestD = Infinity;
    for (const d of candidates) {
      const nx = cc + d.x, ny = rr + d.y;
      const dx = nx - target.col, dy = ny - target.row;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  update(dt, pacman, blinkyRef) {
    if (this.mode === "FRIGHTENED") {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        this.mode = "CHASE";
        this._restoreColor();
      }
    }

    if (this.mode === "EATEN") {
      if (Math.abs(this.col - EXIT.col) < 0.3 && Math.abs(this.row - EXIT.row) < 0.3) {
        this.mode = "CHASE";
        this._restoreOpacity();
      }
    }

    if (this.inHouse) {
      this.releaseTimer -= dt;
      // Pure oscillation (no drift).
      const bobCenter = this.startRow;
      this.row = bobCenter + Math.sin(performance.now() / 300) * 0.15;
      if (this.releaseTimer <= 0) {
        if (Math.abs(this.col - EXIT.col) > 0.08) {
          this.col += Math.sign(EXIT.col - this.col) * dt * 3.2;
        } else if (this.row > EXIT.row + 0.08) {
          this.row -= dt * 3.2;
        } else {
          this.inHouse = false;
          this.col = EXIT.col;
          this.row = EXIT.row;
          this.dir = { ...DIR.LEFT };
        }
      }
      this.syncMesh();
      return;
    }

    let speed = this.speed;
    if (this.mode === "FRIGHTENED") speed *= 0.55;
    if (this.mode === "EATEN")       speed *= 1.9;

    const atCenter =
      Math.abs(this.col - Math.round(this.col)) < 0.08 &&
      Math.abs(this.row - Math.round(this.row)) < 0.08;

    if (atCenter) {
      this.col = Math.round(this.col);
      this.row = Math.round(this.row);
      this.dir = this._chooseDirAtIntersection(pacman, blinkyRef);
    }

    this.col += this.dir.x * speed * dt;
    this.row += this.dir.y * speed * dt;

    if (this.col < -0.5) this.col += COLS;
    if (this.col > COLS - 0.5) this.col -= COLS;

    this.syncMesh();
  }

  syncMesh() {
    const wrappedCol = ((this.col % COLS) + COLS) % COLS;
    const { x, z } = gridToWorld(wrappedCol, this.row);
    this.group.position.set(x, 0.5, z);
    const yaw = Math.atan2(-this.dir.y, this.dir.x);
    this.group.rotation.y = yaw;

    if (this.mode === "FRIGHTENED" && this.frightenedTimer < 2) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      this.bodyMat.color.setHex(flash ? 0xffffff : 0x0033ff);
      this.bodyMat.emissive.setHex(flash ? 0xffffff : 0x5599ff);
    }
  }

  get tileCol() { return Math.round(((this.col % COLS) + COLS) % COLS); }
  get tileRow() { return Math.round(this.row); }
}
