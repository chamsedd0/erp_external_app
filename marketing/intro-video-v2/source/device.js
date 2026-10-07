// Generic phone + product studio, rendered with three.js (units: millimetres).
// Original shell: 75 × 155 × 8 mm, machined graphite frame, flat glass front, clean screen opening
// (no notch / island / camera cut-out), one side key. The screen shows a pre-rendered app texture
// with tone mapping OFF so the app's white, blue and green survive the light.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// planar-mirror shader for the glass: reflection × strength, added over the screen
const GLASS_SHADER = {
  name: 'GlassReflection',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, strength: { value: 0.05 } },
  vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec4 vUv;
void main(){
  vec4 b = texture2DProj(tDiffuse, vUv);
  gl_FragColor = vec4(b.rgb * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
};
// where the portal light stands in the studio: on the opening macro's reflection path (-0.78, -0.59, 0.17) ≈ 600 mm
// from the glass, so its mirror image travels across the screen as the phone turns; far outside the frontal hero's cone
const PORTAL_POS = [-446, -308, 106];
export const PHONE = { w: 75, h: 155, d: 8, r: 11.5, bevel: 1.25, screenW: 68.2, screenH: 147.6, screenR: 7.4 };

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function planeUV(geo, w, h) {           // ShapeGeometry UVs are in mm — normalise to 0..1
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  uv.needsUpdate = true; return geo;
}
// the brand arch as a flat outline shape (portal units → mm), used as an emissive light in the studio
function archShape(R, leg, stroke) {    // y-up: arc over the top, legs straight down to -leg
  const s = new THREE.Shape(), o = R + stroke / 2, i = R - stroke / 2;
  s.moveTo(-o, -leg); s.lineTo(-o, 0); s.absarc(0, 0, o, Math.PI, 0, true); s.lineTo(o, -leg);
  s.lineTo(i, -leg); s.lineTo(i, 0); s.absarc(0, 0, i, 0, Math.PI, false); s.lineTo(-i, -leg); s.lineTo(-o, -leg);
  return s;
}

// where the portal light sits in the studio (direction from the product); chosen so its reflection
// crosses the glass during the opening macro, and stays near the frame edge in the frontal hero
const ARCH_POS = [-1180, -890, 260];   // computed reflection direction of the macro glass (sweeps ~21° during shot 01); far from the hero cone
function studioEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0.004, 0.004, 0.008);
  const lightMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  const add = (geo, mat, pos, look) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.lookAt(...look); env.add(m); return m; };
  // large rectangular softbox above-left (key), faint fill low-right, narrow rear strip (edge light)
  add(new THREE.PlaneGeometry(1600, 1000), lightMat(6, 6, 6.3), [-700, 1100, 600], [0, 0, 0]);
  add(new THREE.PlaneGeometry(1400, 400), lightMat(0.22, 0.23, 0.28), [0, -1100, 300], [0, 0, 0]);
  add(new THREE.PlaneGeometry(160, 1800), lightMat(12, 12, 12.5), [1150, 200, -600], [0, 0, 0]);
  add(new THREE.PlaneGeometry(160, 1800), lightMat(4, 4, 4.2), [-1150, 100, -500], [0, 0, 0]);
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1500), new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float g = smoothstep(0.15, 0.95, 1.0 - (vUv.x * 0.55 + (1.0 - vUv.y) * 0.45)); gl_FragColor = vec4(vec3(1.6 * g), 1.0); }' }));
  scrim.position.set(-250, 300, 1700); scrim.lookAt(0, 0, 0); env.add(scrim);
  // the portal: an arch-shaped blue light in front of the product (behind camera) — its reflection travels across the glass
  const arch = new THREE.Mesh(new THREE.ShapeGeometry(archShape(95, 120, 22), 48), lightMat(2.2, 4.8, 13.0));
  arch.position.set(...ARCH_POS); arch.lookAt(0, 0, 0); env.add(arch);
  return env;
}

export async function createDevice(canvas, { width, height, pixelRatio = 2, texture }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.01, 1, 20000).texture;   // near/far must enclose the studio (default far = 100)

  // ── the phone
  const P = PHONE, phone = new THREE.Group(); scene.add(phone);
  const b = P.bevel, depthCore = P.d - 2 * b;
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(P.w - 2 * b, P.h - 2 * b, P.r - b), {
    depth: depthCore, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 14, curveSegments: 96,
  });
  bodyGeo.translate(0, 0, -depthCore / 2);
  const frameMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.42, 0.43, 0.46), metalness: 1, roughness: 0.26, clearcoat: 0.35, clearcoatRoughness: 0.12, envMapIntensity: 1.35 });
  const body = new THREE.Mesh(bodyGeo, frameMat); phone.add(body);

  const frontW = P.w - 2 * b, frontH = P.h - 2 * b, frontR = P.r - b, zf = P.d / 2;
  const blackGlass = new THREE.Mesh(planeUV(new THREE.ShapeGeometry(roundedRect(frontW, frontH, frontR), 64), frontW, frontH),
    new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: 0, roughness: 0.55, envMapIntensity: 0.25 }));
  blackGlass.position.z = zf + 0.02; phone.add(blackGlass);

  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(planeUV(new THREE.ShapeGeometry(roundedRect(P.screenW, P.screenH, P.screenR), 64), P.screenW, P.screenH), screenMat);
  screen.position.z = zf + 0.04; phone.add(screen);

  // glass: a planar mirror of the studio (layer 1: portal light + front scrim, never seen by the main camera),
  // added on top of the screen at a dielectric Fresnel strength so the UI stays readable underneath
  const glass = new Reflector(new THREE.ShapeGeometry(roundedRect(frontW, frontH, frontR), 64), {
    textureWidth: 2048, textureHeight: 2048, clipBias: 0.002, multisample: 4, shader: GLASS_SHADER });
  glass.material.transparent = true; glass.material.blending = THREE.AdditiveBlending; glass.material.depthWrite = false;
  glass.camera.layers.set(1);            // the mirror sees only the studio reflection pieces, never the phone itself
  glass.position.z = zf + 0.06; phone.add(glass);
  const glassMat = glass.material;

  // one generic side key (right edge)
  const keyGeo = new THREE.BoxGeometry(1.1, 17, 2.6, 1, 1, 1);
  const key = new THREE.Mesh(keyGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.2, 0.2, 0.22), metalness: 1, roughness: 0.35 }));
  key.position.set(P.w / 2 + 0.35, 28, 0); phone.add(key);

  // ── direct light: softbox key above-left, rear edge strip, optional portal-blue rim (motivated by the arch light behind)
  const keyLight = new THREE.RectAreaLight(0xffffff, 9, 520, 380); keyLight.position.set(-420, 520, 560); keyLight.lookAt(0, 0, 0); scene.add(keyLight);
  const edge = new THREE.RectAreaLight(0xffffff, 14, 40, 560); edge.position.set(300, 120, -200); edge.lookAt(0, 0, 0); scene.add(edge);
  const rim = new THREE.RectAreaLight(0x4f8ef7, 0, 360, 520); rim.position.set(0, 60, -420); rim.lookAt(0, 0, 0); scene.add(rim);

  // ── camera: 85 mm on a 36 mm film gauge, same lens for every product shot
  const camera = new THREE.PerspectiveCamera(20, width / height, 5, 20000);
  camera.filmGauge = 36; camera.setFocalLength(85);

  if (texture) await setScreen(texture);
  async function setScreen(url) {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    screenMat.map = tex; screenMat.needsUpdate = true;
  }

  // reflection-only studio pieces (layer 1)
  const portal = new THREE.Mesh(new THREE.ShapeGeometry(archShape(46, 56, 9.5), 64), new THREE.ShaderMaterial({ side: THREE.DoubleSide, toneMapped: false,
    uniforms: { lo: { value: new THREE.Color(0x2a5fd4).multiplyScalar(5) }, hi: { value: new THREE.Color(0x89bfff).multiplyScalar(5.5) }, y0: { value: -56 }, y1: { value: 52 } },
    vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 lo; uniform vec3 hi; uniform float y0; uniform float y1; varying float vY; void main(){ float t = clamp((vY - y0) / (y1 - y0), 0.0, 1.0); gl_FragColor = vec4(mix(lo, hi, t), 1.0); }' }));
  portal.position.set(...PORTAL_POS); portal.lookAt(0, 20, 0); portal.layers.set(1); scene.add(portal);
  const scrimMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, toneMapped: false, uniforms: { k: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float k; varying vec2 vUv; void main(){ float g = smoothstep(0.2, 1.0, 1.0 - (vUv.x * 0.6 + (1.0 - vUv.y) * 0.4)); gl_FragColor = vec4(vec3(2.2 * g * k), 1.0); }' });
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1000), scrimMat);
  scrim.position.set(-120, 260, 1900); scrim.lookAt(0, 0, 0); scrim.layers.set(1); scene.add(scrim);

  const tmp = new THREE.Vector3();
  function pose(s) {
    camera.position.set(...s.cam); camera.lookAt(...s.target); camera.updateMatrixWorld();
    const d = THREE.MathUtils.degToRad;
    phone.rotation.set(d(s.rot[0]), d(s.rot[1]), d(s.rot[2]), 'YXZ');
    phone.position.set(...(s.pos || [0, 0, 0]));
    phone.updateMatrixWorld(true);
    camera.updateProjectionMatrix();                       // clears any lens shear from the previous sample
    // thin-lens depth of field by accumulation: this sample's pupil position sits on the aperture disk (s.lens, unit disk ×
    // s.aperture mm); the frustum is sheared so the focal plane through s.focus (phone-local mm) projects exactly as before
    if (s.lens && s.aperture > 0) {
      const D = -new THREE.Vector3(...s.focus).applyMatrix4(phone.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      const ox = s.lens[0] * s.aperture, oy = s.lens[1] * s.aperture;
      camera.position.add(new THREE.Vector3(ox, oy, 0).applyQuaternion(camera.quaternion)); camera.updateMatrixWorld();
      const e = camera.projectionMatrix.elements;
      e[8] -= e[0] * ox / D; e[9] -= e[5] * oy / D;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
  }
  return {
    renderer, scene, camera, phone, setScreen,
    // stand the reflection-only portal on the mirror ray so that, for view state s, its image is centred on glass point (gx, gy) mm
    aimPortal(s, gx, gy, dist = 600) {
      pose(s);
      const p = new THREE.Vector3(gx, gy, P.d / 2 + 0.06).applyMatrix4(phone.matrixWorld);
      const n = new THREE.Vector3(0, 0, 1).transformDirection(phone.matrixWorld);
      const v = p.clone().sub(camera.position).normalize();
      const r = v.clone().addScaledVector(n, -2 * v.dot(n));
      portal.position.copy(p).addScaledVector(r, dist); portal.lookAt(p); portal.updateMatrixWorld(true);
      return portal.position.toArray();
    },
    // s: { cam: [x,y,z], target: [x,y,z], rot: [pitch,yaw,roll] deg, reflect, scrim, rim, screen, exposure, visible }
    render(s) {
      phone.visible = s.visible !== false;
      pose(s);
      // dielectric Fresnel (Schlick, F0 = 0.04) at the glass centre, scaled by the shot's reflection control
      const n = tmp.set(0, 0, 1).transformDirection(phone.matrixWorld);
      const v = new THREE.Vector3().setFromMatrixPosition(phone.matrixWorld).sub(camera.position).normalize();
      const cos = Math.min(1, Math.abs(n.dot(v)));
      glassMat.uniforms.strength.value = (0.04 + 0.96 * Math.pow(1 - cos, 5)) * (s.reflect ?? 1);
      scrimMat.uniforms.k.value = s.scrim ?? 0;
      rim.intensity = s.rim ?? 0;
      screenMat.color.setScalar(s.screen ?? 1);          // display brightness (0 = off: black glass)
      renderer.toneMappingExposure = s.exposure ?? 1;
      renderer.render(scene, camera);
    },
    // screen corners projected to canvas CSS pixels (for the match cut into the flat UI)
    screenRect(cssW, cssH) {
      phone.updateMatrixWorld(true);
      const xs = [], ys = [];
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        tmp.set(x * P.screenW / 2, y * P.screenH / 2, P.d / 2 + 0.04).applyMatrix4(phone.matrixWorld).project(camera);
        xs.push((tmp.x + 1) / 2 * cssW); ys.push((1 - tmp.y) / 2 * cssH);
      }
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), corners: xs.map((x, i) => [x, ys[i]]) };
    },
  };
}
