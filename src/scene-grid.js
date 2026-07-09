import * as THREE from "three";

// Option 2 — interactive dot grid: a lattice of tiny dots on ink that
// shimmer idly and magnetize away from the cursor, lighting up chartreuse
// around it. Pixel-space orthographic camera so spacing is exact.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uDpr;
  attribute float aRand;
  varying float vGlow;

  void main() {
    vec3 pos = position;

    vec2 toMouse = pos.xy - uMouse;
    float d = length(toMouse);
    float influence = exp(-d * 0.006);
    pos.xy += normalize(toMouse + 0.0001) * influence * 38.0;

    float wave = sin(uTime * 0.7 + pos.x * 0.011 + pos.y * 0.009 + aRand * 6.283) * 0.5 + 0.5;
    vGlow = clamp(influence * 1.7 + wave * 0.1, 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.7 + vGlow * 2.8 + wave * 0.6) * uDpr;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vGlow;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    vec3 bone = vec3(0.937, 0.929, 0.902);
    vec3 accent = vec3(0.839, 1.0, 0.294);
    vec3 col = mix(bone, accent, smoothstep(0.12, 0.75, vGlow));
    float alpha = 0.14 + vGlow * 0.86;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "low-power",
  });
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x0b0b0d, 1);

  const scene = new THREE.Scene();
  let camera;
  let points = null;

  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(-99999, -99999) },
    uDpr: { value: dpr },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
  });

  function build() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    // y grows downward to match pointer client coordinates
    camera = new THREE.OrthographicCamera(0, w, 0, h, -10, 10);

    const spacing = 30;
    const cols = Math.ceil(w / spacing) + 2;
    const rows = Math.ceil(h / spacing) + 2;
    const count = cols * rows;
    const positions = new Float32Array(count * 3);
    const rands = new Float32Array(count);

    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        positions[i * 3] = x * spacing;
        positions[i * 3 + 1] = y * spacing;
        positions[i * 3 + 2] = 0;
        rands[i] = Math.random();
        i++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));

    if (points) {
      scene.remove(points);
      points.geometry.dispose();
    }
    points = new THREE.Points(geometry, material);
    scene.add(points);
  }

  build();
  window.addEventListener("resize", build);

  const targetMouse = new THREE.Vector2(-99999, -99999);
  window.addEventListener(
    "pointermove",
    (e) => targetMouse.set(e.clientX, e.clientY),
    { passive: true }
  );

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!reducedMotion) uniforms.uTime.value = clock.getElapsedTime();
    // ease toward the pointer; jump instantly on the first move
    if (uniforms.uMouse.value.x < -9000 && targetMouse.x > -9000) {
      uniforms.uMouse.value.copy(targetMouse);
    } else {
      uniforms.uMouse.value.lerp(targetMouse, 0.12);
    }
    renderer.render(scene, camera);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      clock.start();
      frame();
    }
  });

  frame();
  return { renderer, uniforms };
}
