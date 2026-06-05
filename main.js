import * as THREE from "three";

// --- Grundsetup -----------------------------------------------------------
const canvas = document.getElementById("scene");
const loader = document.getElementById("loader");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1410, 0.06);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 9);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Beleuchtung ----------------------------------------------------------
scene.add(new THREE.AmbientLight(0x88ffaa, 0.4));

const keyLight = new THREE.DirectionalLight(0x9effb0, 1.2);
keyLight.position.set(5, 6, 4);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x3fae5a, 2.0, 30);
rimLight.position.set(-6, -2, 3);
scene.add(rimLight);

// --- Cannabis-Blatt als Form (prozedural) ---------------------------------
function createLeafShape() {
  const shape = new THREE.Shape();
  // Ein einzelnes "Finger"-Blatt mit gezackter Kontur
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.15, 0.4, 0.1, 0.9, 0.18, 1.3);
  shape.lineTo(0.05, 1.15);
  shape.bezierCurveTo(0.08, 1.5, 0.03, 1.8, 0, 2.1);
  shape.bezierCurveTo(-0.03, 1.8, -0.08, 1.5, -0.05, 1.15);
  shape.lineTo(-0.18, 1.3);
  shape.bezierCurveTo(-0.1, 0.9, -0.15, 0.4, 0, 0);
  return shape;
}

const extrudeSettings = {
  depth: 0.04,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 2,
  curveSegments: 12,
};

// Ein vollständiges Blatt = mehrere Finger im Fächer
function createCannabisLeaf(color) {
  const group = new THREE.Group();
  const leafGeo = new THREE.ExtrudeGeometry(createLeafShape(), extrudeSettings);
  leafGeo.center();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.1,
    flatShading: false,
  });

  const angles = [-0.7, -0.38, 0, 0.38, 0.7];
  const scales = [0.62, 0.82, 1.0, 0.82, 0.62];
  angles.forEach((a, i) => {
    const finger = new THREE.Mesh(leafGeo, mat);
    finger.rotation.z = a;
    finger.scale.setScalar(scales[i]);
    finger.position.y = 0.6 * scales[i];
    group.add(finger);
  });
  return group;
}

// --- Schwebende Blätter im Raum ------------------------------------------
const leaves = [];
const palette = [0x6ee787, 0x3fae5a, 0xaef79b, 0x2f8f4a];
const LEAF_COUNT = 14;

for (let i = 0; i < LEAF_COUNT; i++) {
  const leaf = createCannabisLeaf(palette[i % palette.length]);
  const s = 0.5 + Math.random() * 0.8;
  leaf.scale.setScalar(s);
  leaf.position.set(
    (Math.random() - 0.5) * 16,
    (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 8 - 2
  );
  leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  leaf.userData = {
    rotSpeed: (Math.random() - 0.5) * 0.01,
    floatSpeed: 0.3 + Math.random() * 0.5,
    floatAmp: 0.3 + Math.random() * 0.6,
    baseY: leaf.position.y,
    phase: Math.random() * Math.PI * 2,
  };
  leaves.push(leaf);
  scene.add(leaf);
}

// --- Partikel (Pollen / Glühpunkte) --------------------------------------
const particleCount = 600;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 30;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0xaef79b,
  size: 0.05,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// --- Interaktion: Maus + Scroll ------------------------------------------
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

let scrollY = 0;
window.addEventListener("scroll", () => {
  scrollY = window.scrollY / window.innerHeight;
});

// --- Resize ---------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- Animationsschleife ---------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Sanftes Maus-Parallax
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  leaves.forEach((leaf) => {
    const d = leaf.userData;
    leaf.rotation.y += d.rotSpeed;
    leaf.rotation.x += d.rotSpeed * 0.6;
    leaf.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.phase) * d.floatAmp;
  });

  particles.rotation.y = t * 0.02;
  particles.rotation.x = t * 0.01;

  // Kamera reagiert auf Maus und Scroll
  camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.04;
  camera.position.y += (-mouse.y * 1.0 - scrollY * 2.0 - camera.position.y) * 0.04;
  camera.lookAt(0, -scrollY * 1.2, 0);

  renderer.render(scene, camera);
}

animate();

// --- Loader ausblenden ----------------------------------------------------
window.addEventListener("load", () => {
  setTimeout(() => loader.classList.add("hidden"), 400);
});
// Fallback, falls 'load' bereits gefeuert hat
if (document.readyState === "complete") {
  setTimeout(() => loader.classList.add("hidden"), 600);
}

// Jahr im Footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
