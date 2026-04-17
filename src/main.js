// =============================================================
// main.js — Three.js bootstrap + render loop + bloom post-fx
// =============================================================

import * as THREE from "three";
import { EffectComposer }   from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }        from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass }   from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass }        from "three/addons/postprocessing/OutputPass.js";

import { Game } from "./game.js";
import * as Audio from "./audio.js";

// ---- renderer & scene -----------------------------------------------------

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000308);
scene.fog = new THREE.Fog(0x000308, 20, 55);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 200
);
// Follow-camera offset — closer to the action, slight tilt.
const CAM_OFFSET = new THREE.Vector3(0, 18, 12);
camera.position.copy(CAM_OFFSET);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x102030, 0.5));
scene.add(new THREE.HemisphereLight(0x6FC3DF, 0x000308, 0.35));

// Starfield backdrop
(function addStars() {
  const geo = new THREE.BufferGeometry();
  const count = 500;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * 200;
    pos[i * 3 + 1] = -Math.random() * 30 - 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x6FC3DF, size: 0.15, transparent: true, opacity: 0.6,
  });
  scene.add(new THREE.Points(geo, mat));
})();

// ---- post-processing ------------------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.1, 0.8, 0.0
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- HUD refs & game ------------------------------------------------------

const hud = {
  score:   document.getElementById("score"),
  level:   document.getElementById("level"),
  lives:   document.getElementById("lives"),
  message: document.getElementById("message"),
};

const game = new Game(scene, hud);

// ---- overlay / start flow --------------------------------------------------

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");

function beginGame() {
  Audio.resume();
  overlay.classList.remove("visible");
  game.start();
}
startBtn.addEventListener("click", beginGame);
window.addEventListener("keydown", (e) => {
  if (overlay.classList.contains("visible") && (e.key === "Enter" || e.key === " ")) {
    beginGame();
  }
});

// ---- resize ----------------------------------------------------------------

window.addEventListener("resize", () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---- main loop -------------------------------------------------------------

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  const t = now / 1000;

  game.update(dt, t);

  // Smooth follow-cam on Pac-Man (cinematic lerp).
  const pPos = game.pacman.group.position;
  const desired = new THREE.Vector3(
    pPos.x + Math.sin(t * 0.15) * 0.4,
    CAM_OFFSET.y,
    pPos.z + CAM_OFFSET.z
  );
  camera.position.lerp(desired, 0.08);
  const look = new THREE.Vector3(pPos.x, 0, pPos.z - 1.5);
  camera.lookAt(look);

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
