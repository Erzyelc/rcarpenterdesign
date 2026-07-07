import * as THREE from "three";

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

// Flowing simplex-noise aurora, dark ink base with a chartreuse glow that
// leans toward the pointer. Rendered on a fullscreen triangle-pair.
const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uScroll;

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amp * snoise(p);
      p *= 2.05;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv;
    p.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.08;
    vec2 drift = vec2(t * 0.6, -t * 0.4) + uScroll * vec2(0.0, 0.6);

    float n1 = fbm(p * 0.9 + drift);
    float n2 = fbm(p * 1.5 - drift * 1.3 + n1 * 0.8);

    vec3 ink = vec3(0.043, 0.043, 0.051);
    vec3 deep = vec3(0.07, 0.085, 0.06);
    vec3 accent = vec3(0.839, 1.0, 0.294);

    vec3 col = mix(ink, deep, smoothstep(-0.4, 0.8, n1));

    // pointer-following glow
    vec2 m = uMouse;
    m.x *= uResolution.x / uResolution.y;
    float d = distance(p, m);
    float glow = exp(-d * 2.2) * 0.5;

    // soft accent wash where the noise crests
    float crest = smoothstep(0.15, 0.85, n2);
    col = mix(col, col + accent * 0.075, crest);
    col += accent * crest * glow * 0.35;
    col += accent * glow * 0.05;

    // subtle vignette + grain
    float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5)));
    col *= 0.75 + 0.25 * vig;
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.025;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uResolution: {
      value: new THREE.Vector2(
        window.innerWidth * renderer.getPixelRatio(),
        window.innerHeight * renderer.getPixelRatio()
      ),
    },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uScroll: { value: 0 },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
  );
  scene.add(mesh);

  const targetMouse = new THREE.Vector2(0.5, 0.5);

  window.addEventListener(
    "pointermove",
    (e) => {
      targetMouse.set(
        e.clientX / window.innerWidth,
        1 - e.clientY / window.innerHeight
      );
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    uniforms.uResolution.value.set(
      window.innerWidth * renderer.getPixelRatio(),
      window.innerHeight * renderer.getPixelRatio()
    );
  });

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!reducedMotion) uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uMouse.value.lerp(targetMouse, 0.05);
    uniforms.uScroll.value +=
      (window.scrollY / window.innerHeight - uniforms.uScroll.value) * 0.08;
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
