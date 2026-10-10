/*
 * After Five Tint — studio car scene.
 * Shared by the scroll intro (intro.js) and offline still renders.
 *
 * Car model: "Car Concept" from the Khronos glTF Sample Assets,
 * CC-BY 4.0 (see /assets/models/car/LICENSE.md). Based on a CC0 model by Unity Fan.
 */
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../vendor/three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from '../../vendor/three/examples/jsm/loaders/KTX2Loader.js';
import { RoomEnvironment } from '../../vendor/three/examples/jsm/environments/RoomEnvironment.js';

const BASE = new URL('../../', import.meta.url).href;
const MODEL_URL = BASE + 'assets/models/car/CarConcept.gltf';
const VARIANT = 'Torched Graphite';
const OBSIDIAN = 0x080a0d;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/*
 * Automotive photo studio used only for reflections: a near-black room with
 * long, thin softbox strips. They draw clean highlight lines along the paint
 * and the tinted glass instead of blotchy hotspots.
 */
function buildStudioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(40, 16, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.013, 0.016), side: THREE.BackSide })
  );
  room.position.y = 6;
  env.add(room);
  const strip = (w, h, intensity, x, y, z, rx, ry) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  // Overhead strips running nose-to-tail
  strip(0.5, 16, 5, 0, 9, 0, Math.PI / 2, 0);
  strip(0.22, 16, 2.5, -2.6, 8.6, 0, Math.PI / 2, 0);
  // One crisp horizon line on the driver side
  strip(26, 0.06, 7, 13.9, 4.6, 0, 0, -Math.PI / 2);
  strip(26, 0.03, 3, 13.9, 3.9, 0, 0, -Math.PI / 2);
  return env;
}

export async function createCarScene(canvas, opts = {}) {
  const mobile = !!opts.mobile;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || (mobile ? 1.5 : 2)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(OBSIDIAN, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(OBSIDIAN, 12, 32);

  const pmrem = new THREE.PMREMGenerator(renderer);
  // Body + floor: soft room lighting. Glass: its own near-black studio with one
  // crisp highlight line, so the tint reads deep instead of milky.
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.03);
  const glassEnvRT = pmrem.fromScene(buildStudioEnvironment(), 0.01);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 80);

  // ---- Lights: low key, one hard top strip, cool rim ------------------
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd2ff, 1.1);
  rim.position.set(5, 3, -6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x8a96a8, 0x050607, 0.35));

  // ---- Load car ---------------------------------------------------------
  const draco = new DRACOLoader().setDecoderPath(BASE + 'vendor/three/examples/jsm/libs/draco/gltf/');
  const ktx2 = new KTX2Loader().setTranscoderPath(BASE + 'vendor/three/examples/jsm/libs/basis/').detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
  const gltf = await loader.loadAsync(MODEL_URL, opts.onProgress);
  const car = gltf.scene;

  // Apply the graphite paint variant (KHR_materials_variants).
  const variants = gltf.parser.json.extensions?.KHR_materials_variants?.variants || [];
  const vIndex = Math.max(0, variants.findIndex((v) => v.name === (opts.variant || VARIANT)));
  const pending = [];
  car.traverse((o) => {
    if (!o.isMesh) return;
    const ext = o.userData.gltfExtensions?.KHR_materials_variants;
    if (!ext) return;
    const m = ext.mappings.find((mp) => mp.variants.includes(vIndex));
    if (m) pending.push(gltf.parser.getDependency('material', m.material).then((mat) => { o.material = mat; }));
  });
  await Promise.all(pending);

  // Tinted glass: dark, glossy, reflective. Cheaper than transmission.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05070a, metalness: 0.0, roughness: 0.04,
    transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.02,
    envMapIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false,
  });
  glassMat.envMap = glassEnvRT.texture;
  let windowMesh = null;
  const tuned = new Set();
  car.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.material && o.material.name) || '';
    if (/^Paint/i.test(name) && !tuned.has(o.material) && /Graphite/.test(opts.variant || VARIANT)) {
      // Deep black-graphite paint under a glossy clearcoat
      const m = o.material; tuned.add(m);
      if (m.iridescence !== undefined) m.iridescence = 0;
      m.clearcoat = 1; m.clearcoatRoughness = 0.035;
      if (/Paint 1/.test(name)) { m.color.setRGB(0.05, 0.052, 0.058); m.metalness = 0.62; m.roughness = 0.3; }
      else { m.color.setRGB(0.012, 0.013, 0.015); m.metalness = 0.2; m.roughness = 0.5; }
      m.envMapIntensity = 1.6;
      m.needsUpdate = true;
    }
    if (/^(Interior|Floormat|Dashboard)/i.test(name) && !tuned.has(o.material)) {
      // Keep the cabin dim so the tint reads as tint
      const m = o.material; tuned.add(m);
      if (m.color) m.color.multiplyScalar(0.35);
      m.envMapIntensity = 0.4;
      if (m.emissiveIntensity !== undefined) m.emissiveIntensity *= 0.3;
    }
    if (/glass/i.test(name)) { o.material = glassMat; o.renderOrder = 2; }
    if (/^License/i.test(name)) o.visible = false; // no plates
    if (o.name === 'BodyDoorLWindow' || o.parent?.name === 'BodyDoorLWindow') windowMesh = windowMesh || o;
  });
  scene.add(car);
  car.updateMatrixWorld(true);

  // ---- Geometry frame ---------------------------------------------------
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  // Sit the tyres on y=0 (some hidden parts hang lower than the wheels)
  const tyre = car.getObjectByName('WheelFrontL');
  const groundY = tyre ? new THREE.Box3().setFromObject(tyre, true).min.y : box.min.y;
  car.position.y -= groundY;
  car.updateMatrixWorld(true);
  box.setFromObject(car);
  const center = box.getCenter(new THREE.Vector3());
  const lengthAxis = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const len = Math.max(size.x, size.z);
  const up = new THREE.Vector3(0, 1, 0);

  const headNode = car.getObjectByName('BodyHeadlights');
  const headC = new THREE.Box3().setFromObject(headNode || car).getCenter(new THREE.Vector3());
  const fwd = lengthAxis.clone().multiplyScalar(Math.sign(headC.clone().sub(center).dot(lengthAxis)) || 1);

  const winBox = new THREE.Box3().setFromObject(windowMesh || car, true);
  const W = winBox.getCenter(new THREE.Vector3());
  const sideAxis = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const side = sideAxis.multiplyScalar(Math.sign(W.clone().sub(center).dot(sideAxis)) || 1);
  // Window surface point: outermost extent along side
  const winOuter = W.clone();
  const winHalfDepth = Math.abs(winBox.max.clone().sub(winBox.min).dot(side)) / 2;
  winOuter.addScaledVector(side, winHalfDepth);

  // Punch-through copy of the driver window: fades the canvas to transparent
  // where the glass is, so the real website shows through it.
  const punchMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  if (windowMesh) {
    const punch = new THREE.Mesh(windowMesh.geometry, punchMat);
    punch.renderOrder = 10;
    windowMesh.add(punch);
  }

  // ---- Floor + contact shadow ------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  const shCanvas = document.createElement('canvas');
  shCanvas.width = shCanvas.height = 128;
  const sg = shCanvas.getContext('2d');
  const grd = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.92)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
  const shTex = new THREE.CanvasTexture(shCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, 0.004, center.z);
  // plane x -> world x, plane y -> world z (after the -90deg X rotation)
  shadow.scale.set(size.x * 1.35, size.z * 1.18, 1);
  scene.add(shadow);
  // Tight contact shadows under each tyre
  ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'].forEach((n) => {
    const wn = car.getObjectByName(n);
    if (!wn) return;
    const wb = new THREE.Box3().setFromObject(wn, true);
    const wc = wb.getCenter(new THREE.Vector3()); const ws = wb.getSize(new THREE.Vector3());
    const s = new THREE.Mesh(shadow.geometry, shadow.material);
    s.rotation.x = -Math.PI / 2;
    s.position.set(wc.x, 0.006, wc.z);
    s.scale.set(ws.x * 1.9, ws.z * 1.1, 1);
    scene.add(s);
  });

  // Architectural backdrop: vertical light slats far behind the car, faint in fog
  const slatMat = new THREE.MeshBasicMaterial({ color: 0x2b3038, fog: true });
  const slatGeo = new THREE.PlaneGeometry(0.035, 7);
  for (let i = -6; i <= 6; i++) {
    const sl = new THREE.Mesh(slatGeo, slatMat);
    sl.position.copy(center).addScaledVector(side, -9).addScaledVector(fwd, i * 2.1 + (i % 2) * 0.45);
    sl.position.y = 3.5;
    sl.lookAt(center.x, 3, center.z);
    scene.add(sl);
  }
  // A single red line on the floor: the brand accent, used once
  const lime = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 30), new THREE.MeshBasicMaterial({ color: 0xe5312b, fog: true }));
  lime.rotation.x = -Math.PI / 2;
  lime.rotation.z = Math.atan2(fwd.x, fwd.z);
  lime.position.copy(center).addScaledVector(side, -2.6);
  lime.position.y = 0.005;
  scene.add(lime);



  // ---- Camera path --------------------------------------------------------
  const P = (f, s, u, base = center) => base.clone().addScaledVector(fwd, f * len).addScaledVector(side, s * len).addScaledVector(up, u * len);

  function buildPath(isMobile) {
    const pts = isMobile
      ? [P(1.55, 1.6, 0.2), P(0.6, 1.1, 0.06), P(0.08, 0.5, 0.0, W), P(0.0, 0.15, 0.0, W), P(0.0, -0.06, 0.0, W)]
      : [P(0.66, 1.4, 0.07), P(0.32, 0.92, 0.035), P(0.06, 0.48, 0.0, W), P(0.0, 0.14, 0.0, W), P(0.0, -0.06, 0.0, W)];
    const tgt = [
      isMobile ? P(0.0, 0, 0.1) : P(-0.02, 0, 0.0), P(0.0, 0, 0.0, center.clone().lerp(W, 0.45)),
      P(0, 0, 0, center.clone().lerp(W, 0.85)), P(0, 0, 0, W), P(0, -0.4, 0, W),
    ];
    const pos = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // Find where the camera meets the glass surface; the journey ends there.
    let tCross = 1;
    const v = new THREE.Vector3();
    for (let t = 0.5; t <= 1; t += 0.002) {
      pos.getPoint(t, v);
      if (v.clone().sub(winOuter).dot(side) < 0.035) { tCross = t; break; }
    }
    return {
      pos, tCross,
      tgt: new THREE.CatmullRomCurve3(tgt, false, 'centripetal'),
      fov0: isMobile ? 50 : 30,
      fov1: isMobile ? 40 : 27,
    };
  }
  let path = buildPath(mobile);

  const tmpT = new THREE.Vector3();
  const state = { progress: 0, reveal: 0, canvasOpacity: 1 };

  function setProgress(p) {
    p = clamp01(p);
    state.progress = p;
    // Gentle ease-in so the first scroll ticks start the move softly;
    // the curve's point spacing slows the camera naturally near the glass.
    const e = 0.75 * p + 0.25 * (p * p * (3 - 2 * p));
    const t = e * path.tCross;
    camera.position.copy(path.pos.getPoint(t));
    tmpT.copy(path.tgt.getPoint(t));
    camera.fov = path.fov0 + (path.fov1 - path.fov0) * p;
    camera.updateProjectionMatrix();
    camera.lookAt(tmpT);
    // The glass opens onto the website, then the scene hands off completely.
    state.reveal = smooth(0.78, 0.97, p);
    punchMat.opacity = state.reveal;
    glassMat.opacity = 0.9 * (1 - state.reveal * 0.3);
    state.canvasOpacity = 1 - smooth(0.95, 1.0, p);
    return state;
  }

  function setTint(level) { glassMat.opacity = level; glassMat.color.setHex(level > 0.6 ? 0x05070a : 0x10161c); }

  function setSize(w, h, isMobile = mobile) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    path = buildPath(isMobile);
    setProgress(state.progress);
  }

  function render() { renderer.render(scene, camera); }

  function dispose() {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { Object.values(m).forEach((v) => v && v.isTexture && v.dispose()); m.dispose(); });
      }
    });
    envRT.dispose(); glassEnvRT.dispose(); shTex.dispose(); draco.dispose(); ktx2.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  setProgress(0);
  return {
    THREE, renderer, scene, camera, car, glassMat, punchMat, windowMesh,
    frame: { center, W, winOuter, fwd, side, len, size },
    setProgress, setTint, setSize, render, dispose, state,
  };
}
