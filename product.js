/* ============================================================
   Northern Lights · Vape — 3D-Produkt (Three.js r128)
   Rendert das freigestellte Produkt auf einem transparenten,
   fixierten Canvas. Die Transformation (Position/Rotation/Skala)
   wird von einem geteilten State-Objekt window.NLV gesteuert,
   das GSAP ScrollTrigger (main.js) per Scroll animiert.
   ============================================================ */
(function () {
  const ASPECT = 1271 / 455; // Seitenverhältnis des Artworks (H/W)
  const mount = document.getElementById("product-stage");

  // --- Geteilter Zustand: von GSAP (Scroll) + Maus gesteuert ----
  const NLV = (window.NLV = {
    posX: 0, posY: 0, posZ: 0,
    rotX: 0.05, rotY: 0.4,
    scale: 0.85,
    // Maus-Parallax (Ziel + geglättet)
    mxT: 0, myT: 0, mx: 0, my: 0,
    ready: false,
  });

  // --- Renderer (transparent / freigestellt) --------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8.6);

  // --- Weiches Studio-Environment (nur für Reflexionen) ---------
  function studioEnv() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#f6faff"); g.addColorStop(0.45, "#a6bad2");
    g.addColorStop(0.7, "#465572"); g.addColorStop(1, "#1a2238");
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const rg = x.createRadialGradient(150, 70, 4, 150, 70, 150);
    rg.addColorStop(0, "rgba(255,255,255,.95)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg; x.fillRect(0, 0, 512, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    const p = new THREE.PMREMGenerator(renderer);
    const env = p.fromEquirectangular(t).texture;
    t.dispose(); p.dispose();
    return env;
  }
  scene.environment = studioEnv();

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x202a44, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(-3.5, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb6d0ff, 0.7);
  rim.position.set(4, -1.5, -3); scene.add(rim);

  // --- Produkt: versiegeltes Folien-Kissen ----------------------
  function pouchShell(map, depth, back) {
    const W = 1.55, H = W * ASPECT;
    const geo = new THREE.PlaneGeometry(W, H, 64, 190);
    const p = geo.attributes.position, hw = W / 2, hh = H / 2, SEAL = 0.84;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / hw, v = Math.abs(p.getY(i) / hh);
      const wp = Math.pow(Math.cos((u * Math.PI) / 2), 0.85);
      let hp = 1;
      if (v > SEAL) { const t = Math.max(0, (1 - v) / (1 - SEAL)); hp = t * t * (3 - 2 * t); }
      const z = depth * wp * hp;
      p.setZ(i, back ? -z : z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
      metalness: 0.5, roughness: 0.46, envMapIntensity: 0.95,
    });
    return new THREE.Mesh(geo, mat);
  }
  function createVapePouch(frontTex, backTex) {
    [frontTex, backTex].forEach((t) => {
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    backTex.wrapS = THREE.RepeatWrapping;
    backTex.repeat.x = -1;
    backTex.offset.x = 1;
    const g = new THREE.Group();
    g.add(pouchShell(frontTex, 0.16, false));
    g.add(pouchShell(backTex, 0.16, true));
    return g;
  }

  const product = new THREE.Group();
  scene.add(product);
  window.NLV.product = product;

  const loader = new THREE.TextureLoader();
  Promise.all([
    new Promise((r) => loader.load(FRONT_B64, r)),
    new Promise((r) => loader.load(BACK_B64, r)),
  ]).then(([f, b]) => {
    product.add(createVapePouch(f, b));
    NLV.ready = true;
    document.dispatchEvent(new Event("nlv:ready"));
  });

  // --- Dezenter Maus-Parallax (blockiert Scrollen NICHT) --------
  window.addEventListener("pointermove", (e) => {
    NLV.mxT = (e.clientX / window.innerWidth - 0.5) * 2;
    NLV.myT = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // --- Render-Schleife: setzt Transform aus State zusammen ------
  function tick() {
    requestAnimationFrame(tick);
    NLV.mx += (NLV.mxT - NLV.mx) * 0.06;
    NLV.my += (NLV.myT - NLV.my) * 0.06;
    const floatY = Math.sin(performance.now() * 0.0006) * 0.12;
    product.position.set(NLV.posX, NLV.posY + floatY, NLV.posZ);
    product.rotation.set(NLV.rotX + NLV.my * 0.12, NLV.rotY + NLV.mx * 0.22, 0);
    product.scale.setScalar(NLV.scale);
    renderer.render(scene, camera);
  }
  tick();

  // --- Auf das Fenster skalieren --------------------------------
  function resize() {
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
})();
