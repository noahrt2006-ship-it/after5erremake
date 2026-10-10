/*
 * After Five Tint — cinematic intro (progressive enhancement).
 *
 * site.js already drives the intro with a poster image and CSS. This module
 * upgrades it to the live 3D scene when the device can handle it:
 * the camera glides to the driver's window, the glass opens onto the real
 * hero underneath, and the canvas hands off completely.
 */
const doc = document.documentElement;
const stage = document.getElementById('introStage');
const sceneEl = document.getElementById('scene');
const canvas = document.getElementById('sceneCanvas');
const bar = document.querySelector('.intro__progress');

const reduced = doc.classList.contains('reduced-motion');
const mq = window.matchMedia('(max-width: 760px)');

function webgl2Available() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (e) { return false; }
}

function lowPower() {
  const nav = navigator;
  if (nav.connection && nav.connection.saveData) return true;
  if (nav.deviceMemory && nav.deviceMemory < 4) return true;
  if (mq.matches && nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return true;
  return false;
}

const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

let api = null;
let progress = 0;
let rafId = 0;
let mobile = mq.matches;
let failed = false;

function size() {
  const r = stage.getBoundingClientRect();
  return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
}

function frame() {
  rafId = 0;
  if (!api || progress >= 0.999) return;
  api.setProgress(progress);
  api.render();
}
function requestFrame() { if (!rafId) rafId = requestAnimationFrame(frame); }

function fallBack(reason) {
  if (failed) return;
  failed = true;
  if (bar) bar.classList.remove('is-loading');
  sceneEl.classList.remove('is-3d');
  sceneEl.classList.add('is-poster');
  if (api) { try { api.dispose(); } catch (e) { /* ignore */ } api = null; }
  if (reason) console.info('[intro] using poster mode:', reason);
}

async function start() {
  if (bar) bar.classList.add('is-loading');
  const timeout = setTimeout(() => fallBack('scene took too long to load'), 15000);
  try {
    const { createCarScene } = await import('./car-scene.js');
    if (failed) return;
    api = await createCarScene(canvas, { mobile });
    clearTimeout(timeout);
    if (failed) { api.dispose(); api = null; return; }
    const { w, h } = size();
    api.setSize(w, h, mobile);
    api.setProgress(progress);
    api.render();
    // Compile + first frame done: swap the poster for the live scene.
    requestAnimationFrame(() => {
      sceneEl.classList.remove('is-poster');
      sceneEl.classList.add('is-3d');
      if (bar) bar.classList.remove('is-loading');
      document.dispatchEvent(new CustomEvent('intro:mode', { detail: { mode: '3d' } }));
    });
  } catch (err) {
    clearTimeout(timeout);
    fallBack(err && err.message);
  }
}

if (!reduced && stage && canvas) {
  document.addEventListener('intro:progress', (e) => {
    progress = e.detail.p;
    requestFrame();
  });

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!api) return;
      mobile = mq.matches;
      const { w, h } = size();
      api.setSize(w, h, mobile);
      api.setProgress(progress);
      api.render();
    }, 120);
  });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallBack('WebGL context lost'); });

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted && api) { api.dispose(); api = null; }
  });

  if (!webgl2Available()) fallBack('WebGL 2 not available');
  else if (lowPower()) fallBack('low-power device or data saver');
  else if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', () => idle(start), { once: true });
}
