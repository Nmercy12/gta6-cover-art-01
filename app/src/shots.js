// Fixed scenes for the screenshot harness.
//   ?shot=editor  — the normal editor with sample photos loaded.
//   ?shot=cover   — the cover alone, full-bleed at the viewport size.
// runShot() paints synchronously, then sets window.__shotReady after two
// animation frames so a headless capture never races the canvas.

import { GRADES, LAYOUTS, drawCover } from './cover.js';
import { state } from './main.js';

const FALLBACK_W = 1080;
const FALLBACK_H = 1080;

function readParam(query, name, fallback = '') {
  if (!query) return fallback;
  if (typeof query.get === 'function') {
    const value = query.get(name);
    return value === null || value === undefined ? fallback : value;
  }
  if (Object.prototype.hasOwnProperty.call(query, name)) {
    return query[name] === null || query[name] === undefined ? fallback : String(query[name]);
  }
  return fallback;
}

function appApi() {
  return window.__coverApp || null;
}

function viewportSize() {
  const w = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || FALLBACK_W));
  const h = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || FALLBACK_H));
  return { w, h };
}

function nextPaint() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 32);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function ensureCoverStyles() {
  if (document.getElementById('shot-cover-style')) return;
  const style = document.createElement('style');
  style.id = 'shot-cover-style';
  style.textContent = `
    body.shot-cover { display: block !important; overflow: hidden !important; background: #12081f !important; }
    body.shot-cover .editor-container { display: block !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important; }
    body.shot-cover .controls-panel { display: none !important; }
    body.shot-cover .canvas-area { position: fixed !important; inset: 0 !important; padding: 0 !important; margin: 0 !important; display: block !important; overflow: hidden !important; background: #12081f !important; }
    body.shot-cover .canvas-wrapper { display: block !important; width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; border: 0 !important; box-shadow: none !important; }
    body.shot-cover #cover { display: block !important; width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; object-fit: fill !important; }
  `;
  document.head.appendChild(style);
}

function normalizeLayout(value) {
  return LAYOUTS.includes(value) ? value : state.layout;
}

function normalizeGrade(value) {
  return GRADES[value] ? value : state.grade;
}

async function loadSampleSet(primary, load) {
  const wanted = [];
  if (primary) wanted.push(primary);
  for (const name of ['pier', 'boulevard']) {
    if (!wanted.includes(name)) wanted.push(name);
  }
  const images = [];
  for (const name of wanted) {
    try {
      const image = await load(name);
      if (image) images.push(image);
    } catch (error) {
      console.warn(`Sample photo "${name}" unavailable`, error);
    }
  }
  return images;
}

function assignPanels(pattern) {
  const app = appApi();
  if (app && typeof app.resetPanels === 'function') {
    app.resetPanels(pattern);
    return;
  }
  const total = Math.max(4, state.panels.length || 0);
  while (state.panels.length < total) {
    state.panels.push({ photo: 0, ox: 0.5, oy: 0.5, zoom: 1 });
  }
  state.panels.forEach((panel, index) => {
    panel.photo = typeof pattern === 'function' ? pattern(index) : index % Math.max(1, state.photos.length);
    panel.ox = 0.5;
    panel.oy = 0.5;
    panel.zoom = 1;
  });
}

function refreshEditorUi() {
  const app = appApi();
  if (!app) return;
  if (typeof app.syncUI === 'function') app.syncUI();
  if (typeof app.setSelected === 'function') app.setSelected(0);
  if (typeof app.syncSlots === 'function') app.syncSlots(true);
}

async function waitForFonts() {
  if (!document.fonts) return;
  try {
    await Promise.allSettled([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 100px Yellowtail'),
      document.fonts.ready
    ]);
  } catch (error) {
    // Fonts are an enhancement; the cover still renders with fallbacks.
  }
}

export async function runShot(shot, query, load) {
  const app = appApi();
  const canvas = document.getElementById('cover');
  if (!canvas) {
    window.__shotReady = true;
    return;
  }

  const photo = readParam(query, 'photo', 'pier');
  const caption = readParam(query, 'caption', '');
  const layout = normalizeLayout(readParam(query, 'layout', state.layout));
  const grade = normalizeGrade(readParam(query, 'grade', state.grade));
  const images = await loadSampleSet(photo, load);
  if (images.length) state.photos = images;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    ensureCoverStyles();

    state.layout = layout;
    state.grade = grade;
    if (caption) state.title = caption;
    state.subtitle = state.subtitle || 'Coastline Nights';

    const { w, h } = viewportSize();
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    assignPanels((index, total) => {
      if (!state.photos.length) return 0;
      if (index === 0) return 0;
      return index % state.photos.length;
    });
    refreshEditorUi();

    const ctx = canvas.getContext('2d');
    drawCover(ctx, canvas.width, canvas.height, state);

    await waitForFonts();
    // Repaint once the web fonts settle so the title uses the display face.
    drawCover(ctx, canvas.width, canvas.height, state);
    await nextPaint();
    window.__shotReady = true;
    return;
  }

  // ?shot=editor (and any unknown shot) keeps the normal editor visible.
  document.body.classList.remove('shot-cover');
  state.layout = layout;
  state.grade = grade;
  if (caption) state.title = caption;

  if (canvas.width !== FALLBACK_W || canvas.height !== FALLBACK_H) {
    canvas.width = FALLBACK_W;
    canvas.height = FALLBACK_H;
  }

  assignPanels((index, total) => {
    if (!state.photos.length) return 0;
    if (index === 0) return 0;
    return index % state.photos.length;
  });
  refreshEditorUi();

  if (app && typeof app.redraw === 'function') {
    app.redraw();
  } else {
    drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state);
  }

  await waitForFonts();
  if (app && typeof app.redraw === 'function') app.redraw();
  else drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state);

  await nextPaint();
  window.__shotReady = true;
}
