// =============================================================
// maze.js — classic 28x31 Pac-Man maze + Tron neon rendering
// =============================================================

import * as THREE from "three";

export const COLS = 28;
export const ROWS = 31;
export const TILE_SIZE = 1;

export const TILE = {
  EMPTY: 0, WALL: 1, PELLET: 2, POWER: 3, DOOR: 4, TUNNEL: 5,
};

const LAYOUT = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "######.##### ## #####.######",
  "######.##          ##.######",
  "######.## ###--### ##.######",
  "######.## #      # ##.######",
  "T     .   #      #   .     T",
  "######.## #      # ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##................##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

export function parseLayout() {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    const line = LAYOUT[y];
    for (let x = 0; x < COLS; x++) {
      const ch = line[x] || " ";
      switch (ch) {
        case "#": row.push(TILE.WALL); break;
        case ".": row.push(TILE.PELLET); break;
        case "o": row.push(TILE.POWER); break;
        case "-": row.push(TILE.DOOR); break;
        case "T": row.push(TILE.TUNNEL); break;
        default:  row.push(TILE.EMPTY);
      }
    }
    grid.push(row);
  }
  return grid;
}

export function gridToWorld(col, row) {
  const x = (col - (COLS - 1) / 2) * TILE_SIZE;
  const z = (row - (ROWS - 1) / 2) * TILE_SIZE;
  return { x, z };
}

export class Maze {
  constructor(scene) {
    this.scene = scene;
    this.grid = parseLayout();
    this.pelletCount = 0;
    this.pelletMeshes = new Map();
    this.powerMeshes  = new Map();
    this.group = new THREE.Group();
    this.group.name = "Maze";
    scene.add(this.group);

    this._buildFloor();
    this._buildWalls();
    this._buildGhostDoor();
    this._buildPellets();
  }

  _buildFloor() {
    const w = COLS * TILE_SIZE;
    const h = ROWS * TILE_SIZE;

    const bgGeo = new THREE.PlaneGeometry(w * 4, h * 4);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000308 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.rotation.x = -Math.PI / 2;
    bg.position.y = -0.1;
    this.group.add(bg);

    const grid = new THREE.GridHelper(w * 3, COLS * 3, 0x1a5875, 0x0a2436);
    grid.position.y = -0.05;
    this.group.add(grid);

    const pfGeo = new THREE.PlaneGeometry(w + 0.2, h + 0.2);
    const pfMat = new THREE.MeshBasicMaterial({ color: 0x04131c, transparent: true, opacity: 0.92 });
    const pf = new THREE.Mesh(pfGeo, pfMat);
    pf.rotation.x = -Math.PI / 2;
    pf.position.y = -0.02;
    this.group.add(pf);

    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.3, h + 0.3));
    const borderMat = new THREE.LineBasicMaterial({ color: 0xACE5EE });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.01;
    this.group.add(border);
  }

  _buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x061722,
      emissive: 0x0c2a3d,
      emissiveIntensity: 0.5,
      metalness: 0.65,
      roughness: 0.35,
    });
    const wallGeo = new THREE.BoxGeometry(TILE_SIZE, 0.9, TILE_SIZE);

    const walls = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (this.grid[y][x] === TILE.WALL) walls.push({ x, y });

    const inst = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
    const dummy = new THREE.Object3D();
    walls.forEach((w, i) => {
      const { x, z } = gridToWorld(w.x, w.y);
      dummy.position.set(x, 0.45, z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);

    const isWall = (x, y) =>
      x >= 0 && x < COLS && y >= 0 && y < ROWS && this.grid[y][x] === TILE.WALL;

    const H_TOP = 0.92;
    const H_BOT = 0.02;
    const positions = [];
    const add = (x1, y1, z1, x2, y2, z2) => positions.push(x1, y1, z1, x2, y2, z2);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] !== TILE.WALL) continue;
        const { x: cx, z: cz } = gridToWorld(x, y);
        const s = TILE_SIZE / 2;
        const edges = [
          { has: !isWall(x, y - 1), a: [cx - s, cz - s], b: [cx + s, cz - s] },
          { has: !isWall(x, y + 1), a: [cx - s, cz + s], b: [cx + s, cz + s] },
          { has: !isWall(x - 1, y), a: [cx - s, cz - s], b: [cx - s, cz + s] },
          { has: !isWall(x + 1, y), a: [cx + s, cz - s], b: [cx + s, cz + s] },
        ];
        for (const e of edges) {
          if (!e.has) continue;
          add(e.a[0], H_TOP, e.a[1], e.b[0], H_TOP, e.b[1]);
          add(e.a[0], H_BOT, e.a[1], e.b[0], H_BOT, e.b[1]);
          add(e.a[0], H_BOT, e.a[1], e.a[0], H_TOP, e.a[1]);
          add(e.b[0], H_BOT, e.b[1], e.b[0], H_TOP, e.b[1]);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const neon = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x6FC3DF })
    );
    this.group.add(neon);

    const neonBright = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xACE5EE, transparent: true, opacity: 0.5 })
    );
    neonBright.position.y = 0.01;
    this.group.add(neonBright);
  }

  _buildGhostDoor() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] !== TILE.DOOR) continue;
        const { x: wx, z: wz } = gridToWorld(x, y);
        const geo = new THREE.BoxGeometry(TILE_SIZE * 0.9, 0.08, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xF7A325 });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(wx, 0.45, wz);
        this.group.add(m);
      }
    }
  }

  _buildPellets() {
    const pelletGeo = new THREE.SphereGeometry(0.11, 12, 12);
    // Bright yellow — high contrast vs cyan walls, bloom-friendly.
    const pelletMat = new THREE.MeshBasicMaterial({ color: 0xFFEB3B });
    const powerGeo  = new THREE.SphereGeometry(0.26, 16, 16);
    const powerMat  = new THREE.MeshBasicMaterial({ color: 0xFFB84D });

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.grid[y][x];
        if (t !== TILE.PELLET && t !== TILE.POWER) continue;
        const { x: wx, z: wz } = gridToWorld(x, y);
        const mesh = new THREE.Mesh(
          t === TILE.POWER ? powerGeo : pelletGeo,
          t === TILE.POWER ? powerMat.clone() : pelletMat.clone()
        );
        mesh.position.set(wx, 0.35, wz);
        this.group.add(mesh);
        const key = `${x},${y}`;
        if (t === TILE.POWER) this.powerMeshes.set(key, mesh);
        else this.pelletMeshes.set(key, mesh);
        this.pelletCount++;
      }
    }
  }

  isWalkable(col, row) {
    if (row < 0 || row >= ROWS) return false;
    const c = ((col % COLS) + COLS) % COLS;
    const t = this.grid[row][c];
    return t !== TILE.WALL && t !== TILE.DOOR;
  }

  isWalkableForGhost(col, row, includeDoor = false) {
    if (row < 0 || row >= ROWS) return false;
    const c = ((col % COLS) + COLS) % COLS;
    const t = this.grid[row][c];
    if (t === TILE.WALL) return false;
    if (t === TILE.DOOR && !includeDoor) return false;
    return true;
  }

  tileAt(col, row) {
    if (row < 0 || row >= ROWS) return TILE.WALL;
    const c = ((col % COLS) + COLS) % COLS;
    return this.grid[row][c];
  }

  consumePelletAt(col, row) {
    const key = `${col},${row}`;
    if (this.pelletMeshes.has(key)) {
      const m = this.pelletMeshes.get(key);
      this.group.remove(m); m.geometry.dispose(); m.material.dispose();
      this.pelletMeshes.delete(key);
      this.grid[row][col] = TILE.EMPTY;
      this.pelletCount--;
      return "pellet";
    }
    if (this.powerMeshes.has(key)) {
      const m = this.powerMeshes.get(key);
      this.group.remove(m); m.geometry.dispose(); m.material.dispose();
      this.powerMeshes.delete(key);
      this.grid[row][col] = TILE.EMPTY;
      this.pelletCount--;
      return "power";
    }
    return null;
  }

  update(_dt, time) {
    const s = 1 + Math.sin(time * 6) * 0.18;
    for (const m of this.powerMeshes.values()) m.scale.setScalar(s);
  }

  get remaining() { return this.pelletCount; }
}
