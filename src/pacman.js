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

    const bodyGeo = new THREE.SphereGeometry(0.42, 32, 24);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xF7A325,
      emissive: 0xF7A325,
      emissiveIntensity: 1.6,
      metalness: 0.3,
      roughness: 0.25,
    });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.group.add(this.body);

    this.glow = new THREE.PointLight(0xF7A325, 2.8, 7, 2);
    this.group.add(this.glow);

    const trailGeo = new THREE.ConeGeometry(0.18, 0.55, 12);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xF7A325, transparent: true, opacity: 0.3,
    });
    this.trail = new THREE.Mesh(trailGeo, trailMat);
    this.trail.rotation.z = Math.PI / 2;
    this.trail.position.x = -0.55;
    this.group.add(this.trail);
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

    const yaw = Math.atan2(-this.dir.y, this.dir.x);
    this.group.rotation.y = yaw;

    const open = (Math.sin(this.mouthPhase) + 1) * 0.5;
    const chomp = 1 - open * 0.35;
    this.body.scale.set(1, chomp, 1);

    this.glow.intensity = 2.4 + Math.sin(this.mouthPhase * 3) * 0.35;
  }

  get tileCol() { return Math.round(((this.col % COLS) + COLS) % COLS); }
  get tileRow() { return Math.round(this.row); }
}
