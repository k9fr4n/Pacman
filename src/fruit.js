// =============================================================
// fruit.js — bonus identity-disc, appears mid-level.
// =============================================================

import * as THREE from "three";
import { gridToWorld } from "./maze.js";

const FRUIT_POINTS = [100, 300, 500, 700, 1000, 2000, 3000, 5000];

export class Fruit {
  constructor(scene, maze, col, row) {
    this.scene = scene;
    this.maze = maze;
    this.col = col;
    this.row = row;
    this.active = false;
    this.timer = 0;
    this.points = 100;

    this._buildMesh();
    this.group.visible = false;
    scene.add(this.group);
  }

  _buildMesh() {
    this.group = new THREE.Group();
    this.group.name = "Fruit";

    const ringGeo = new THREE.TorusGeometry(0.35, 0.06, 16, 40);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xF7A325,
      emissive: 0xF7A325,
      emissiveIntensity: 1.8,
      metalness: 0.4,
      roughness: 0.25,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.ring);

    const coreGeo = new THREE.TorusGeometry(0.18, 0.04, 12, 30);
    this.core = new THREE.Mesh(coreGeo, ringMat);
    this.core.rotation.x = Math.PI / 2;
    this.group.add(this.core);

    const centerGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xffe2b3 });
    this.center = new THREE.Mesh(centerGeo, centerMat);
    this.group.add(this.center);

    this.glow = new THREE.PointLight(0xF7A325, 1.6, 5, 2);
    this.group.add(this.glow);
  }

  spawn(duration = 9.0) {
    this.points = FRUIT_POINTS[Math.floor(Math.random() * 4)];
    this.timer = duration;
    this.active = true;
    this.group.visible = true;
    const { x, z } = gridToWorld(this.col, this.row);
    this.group.position.set(x, 0.5, z);
  }

  consume() {
    this.active = false;
    this.group.visible = false;
    this.timer = 0;
  }

  update(dt, time) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.consume(); return; }

    this.group.rotation.y = time * 2.0;
    this.ring.rotation.z = time * 3.5;
    if (this.timer < 2) {
      const flash = Math.floor(time * 8) % 2 === 0;
      this.group.visible = flash;
    }
    const { x, z } = gridToWorld(this.col, this.row);
    this.group.position.set(x, 0.5 + Math.sin(time * 3) * 0.1, z);
  }
}
