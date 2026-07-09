import * as THREE from "three";

// Option 3 — flow-field particles: thousands of faint motes advected along
// a drifting noise field, leaving thin streaks like iron filings. Trails
// come from not clearing the frame and fading it with a translucent
// ink-colored quad each tick.

// Tiny 2D gradient noise (permutation-table Perlin), returns roughly [-1, 1].
function makeNoise() {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };

  return (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = p[X] + Y;
    const b = p[X + 1] + Y;
    return lerp(
      lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u),
      lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u),
      v
    );
  };
}

export function createScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "low-power",
  });
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x0b0b0d, 1);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  let camera;

  const noise = makeNoise();
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const COUNT = finePointer ? 2600 : 1400;

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const ages = new Float32Array(COUNT);

  const bone = new THREE.Color(0xefede6);
  const accent = new THREE.Color(0xd6ff4b);

  let W = window.innerWidth;
  let H = window.innerHeight;

  function seed(i, randomAge = true) {
    positions[i * 3] = Math.random() * W;
    positions[i * 3 + 1] = Math.random() * H;
    positions[i * 3 + 2] = 0;
    ages[i] = randomAge ? Math.random() * 400 : 0;
  }

  for (let i = 0; i < COUNT; i++) {
    seed(i);
    // most motes are faint bone, ~10% catch the accent
    const c = Math.random() < 0.1 ? accent : bone;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.4 * dpr,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 1;
  scene.add(points);

  // translucent ink quad that fades previous frames into trails
  const fadeMaterial = new THREE.MeshBasicMaterial({
    color: 0x0b0b0d,
    transparent: true,
    opacity: 0.065,
    depthTest: false,
    depthWrite: false,
  });
  const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fadeMaterial);
  fadeQuad.renderOrder = 0;
  scene.add(fadeQuad);

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
    fadeQuad.scale.set(W, H, 1);
    fadeQuad.position.set(W / 2, H / 2, -1);
    // hard clear once so stale trails don't smear across the new size
    renderer.clear(true, true, true);
  }

  layout();
  window.addEventListener("resize", layout);

  const mouse = new THREE.Vector2(-99999, -99999);
  window.addEventListener(
    "pointermove",
    (e) => mouse.set(e.clientX, e.clientY),
    { passive: true }
  );

  const clock = new THREE.Clock();
  let running = true;

  function step(dt, t) {
    const scale = 0.0016;
    const drift = t * 0.05;
    const speed = 42 * dt;

    for (let i = 0; i < COUNT; i++) {
      let x = positions[i * 3];
      let y = positions[i * 3 + 1];

      const angle =
        noise(x * scale, y * scale + drift) * Math.PI * 3 + drift * 0.7;
      x += Math.cos(angle) * speed;
      y += Math.sin(angle) * speed;

      // gentle push away from the cursor
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 32400) {
        const d = Math.sqrt(d2) + 0.0001;
        const f = (1 - d / 180) * 90 * dt;
        x += (dx / d) * f;
        y += (dy / d) * f;
      }

      ages[i] += 1;
      const off = x < -20 || x > W + 20 || y < -20 || y > H + 20;
      if (off || ages[i] > 900) {
        seed(i, false);
      } else {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    // after a rAF stall (hidden tab), wipe stale trails instead of smearing
    if (raw > 0.25) renderer.clear(true, true, true);
    const dt = Math.min(raw, 0.05);
    step(dt, clock.elapsedTime);
    renderer.render(scene, camera);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      clock.getDelta();
      frame();
    }
  });

  if (reducedMotion) {
    // static scatter, no animation loop
    step(0.016, 0);
    fadeMaterial.opacity = 1;
    renderer.render(scene, camera);
  } else {
    frame();
  }

  return { renderer };
}
