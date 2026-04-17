// =============================================================
// pacman.js — player entity with grid-locked steering
// =============================================================

import * as THREE from "three";
import { COLS, gridToWorld } from "./maze.js";

export const DIR = {
  NONE:  { x:  0, y:  0 },
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 },
};

export function dirEq(a, b) { return a.x === b.x && a.y === b.y; }
export function dirOpposite(a, b) { return a.x === -b.x && a.y === -b.y && (a.x !== 0 || a.y !== 0); }

export class Pacman {
  constructor(scene, maze, startCol = 13.5, startRow = 23) {
    this.maze = maze;
    this.startCol = startCol;
    this.startRow = startRow;

    this.col = startCol;
    this.row = startRow;
    this.dir = { ...DIR.LEFT };
    this.nextDir = { ...DIR.LEFT };
    this.speed = 5.4;
    this.alive = true;
    this.mouthPhase = 0;
    this.onEat = null;

    this._buildMesh();
    scene.add(this.group);
    this.syncMesh();
  }

  _buildMesh() {
    this.group = new THREE.Group();
    this.group.name = "Pacman";

    // Bright YELLOW body — classic & distinct from any ghost color.
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xFFE24A,
      emissive: 0xFFC000,
      emissiveIntensity: 1.8,
      metalness: 0.25,
      roughness: 0.2,
    });

    // Pre-cache 8 mouth-open geometries for chomp animation (no alloc/frame).
    this._mouthGeos = [];
    const STEPS = 8;
    const MAX_ANGLE = 1.1; // radians
    for (let i = 0; i < STEPS; i++) {
      const a = (i / (STEPS - 1)) * MAX_ANGLE;
      this._mouthGeos.push(new THREE.SphereGeometry(
        0.48, 32, 24,
        a / 2,              // phiStart
        Math.PI * 2 - a     // phiLength (wedge removed)
      ));
    }

    this.body = new THREE.Mesh(this._mouthGeos[0], this.bodyMat);
    // The phi gap spans the +Z direction by default → rotate so it faces +X (forward).
    this.body.rotation.y = -Math.PI / 2;
    this.group.add(this.body);

    // Small eye on top of the head — helps readability from above.
    const eyeGeo = new THREE.SphereGeometry(0.07, 14, 14);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a0f00 });
    this.eye = new THREE.Mesh(eyeGeo, eyeMat);
    this.eye.position.set(0.12, 0.38, 0);
    this.group.add(this.eye);

    // Yellow Tron lightdisc at the feet — huge contrast vs the cyan floor.
    const discGeo = new THREE.RingGeometry(0.5, 0.72, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xFFE24A,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(discGeo, discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = -0.48;
    this.group.add(this.disc);

    this.glow = new THREE.PointLight(0xFFE24A, 3.2, 8, 2);
    this.group.add(this.glow);
  }

  reset() {
    this.col = this.startCol;
    this.row = this.startRow;
    this.dir = { ...DIR.LEFT };
    this.nextDir = { ...DIR.LEFT };
    this.alive = true;
    this.syncMesh();
  }

  setInput(dir) { this.nextDir = { ...dir }; }

  update(dt) {
    if (!this.alive) return;
    this.mouthPhase += dt * this.speed * 2.2;

    const atCenter =
      Math.abs(this.col - Math.round(this.col)) < 0.1 &&
      Math.abs(this.row - Math.round(this.row)) < 0.1;

    if (atCenter) {
      const cc = Math.round(this.col);
      const rr = Math.round(this.row);
      if (this.maze.isWalkable(cc + this.nextDir.x, rr + this.nextDir.y)) {
        if (!dirEq(this.dir, this.nextDir)) {
          this.col = cc;
          this.row = rr;
        }
        this.dir = { ...this.nextDir };
      }
    }

    const cc = Math.round(this.col);
    const rr = Math.round(this.row);
    const canForward = this.maze.isWalkable(cc + this.dir.x, rr + this.dir.y);
    if (!canForward) {
      this.col = cc;
      this.row = rr;
      this.syncMesh();
      return;
    }

    this.col += this.dir.x * this.speed * dt;
    this.row += this.dir.y * this.speed * dt;

    if (this.col < -0.5) this.col += COLS;
    if (this.col > COLS - 0.5) this.col -= COLS;

    const pcol = Math.round(this.col);
    const prow = Math.round(this.row);
    if (Math.abs(this.col - pcol) < 0.3 && Math.abs(this.row - prow) < 0.3) {
      const eaten = this.maze.consumePelletAt(((pcol % COLS) + COLS) % COLS, prow);
      if (eaten && this.onEat) this.onEat(eaten, pcol, prow);
    }

    this.syncMesh();
  }

  syncMesh() {
    const wrappedCol = ((this.col % COLS) + COLS) % COLS;
    const { x, z } = gridToWorld(wrappedCol, this.row);
    this.group.position.set(x, 0.5, z);

    // Rotate whole group so the mouth (local +X) faces the movement dir.
    const yaw = Math.atan2(-this.dir.y, this.dir.x);
    this.group.rotation.y = yaw;

    // Swap geometry for chomp animation (cached, zero allocation).
    const open = (Math.sin(this.mouthPhase) + 1) * 0.5; // 0..1
    const idx = Math.min(
      this._mouthGeos.length - 1,
      Math.max(0, Math.floor(open * this._mouthGeos.length))
    );
    if (this.body.geometry !== this._mouthGeos[idx]) {
      this.body.geometry = this._mouthGeos[idx];
    }

    // Keep lightdisc & eye horizontal regardless of yaw.
    this.disc.rotation.z = -yaw; // cancel parent yaw so disc stays round (it is already — but future-proof)
    this.glow.intensity = 2.6 + Math.sin(this.mouthPhase * 3) * 0.4;
  }

  get tileCol() { return Math.round(((this.col % COLS) + COLS) % COLS); }
  get tileRow() { return Math.round(this.row); }
}
