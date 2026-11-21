// GTA 6 Cover Art Studio — editor wiring.
// Loads the sample photos, keeps one `state` object, redraws #cover through
// drawCover(), and handles uploads, panel pan/zoom, text, layouts, grades and
// PNG export. All rendering lives in cover.js; this file only wires the DOM.

import { GRADES, LAYOUTS, drawCover } from './cover.js';
import { runShot } from './shots.js';

const MAX_PHOTOS = 5;
const MAX_PANELS = 8;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const GAP = 8;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

export const state = {
  photos: [],
  panels: [],
  layout: 'hero',
  grade: 'heatwave',
  title: 'SUNSET HEIST',
  subtitle: 'Coastline Nights',
  tagline: 'ONE LAST SCORE — SUMMER 2026',
  badge: 'EST. 2026',
  stars: 5,
  cast: ['LUCIA', 'JASON', 'RAUL'],
  review: '"A NEON MASTERPIECE" — VICE DAILY',
  sealText: 'COVER SNAP',
  fonts: { display: 'Anton', script: 'Yellowtail' }
};

const canvas = document.getElementById('cover');
const ctx = canvas ? canvas.getContext('2d') : null;
const statusEl = document.getElementById('status');
const photoInput = document.getElementById('photo');
const slotsEl = document.getElementById('panel-slots');

let selected = 0;
let drag = null;
let frame = 0;
let slotSignature = '';
let replaceCursor = 0;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function sampleUrl(name) {
  let base = String(name || 'pier').trim();
  base = base.replace(/^.*[\\/]/, '').replace(/\.(jpe?g|png|webp)$/i, '');
  base = base.replace(/[^a-z0-9_-]/gi, '') || 'pier';
  return `samples/${base}.jpg`;
}

function loadSample(name) {
  return loadImage(sampleUrl(name));
}

// Mirrors the panel geometry in cover.js so hit-testing and the selection
// outline line up exactly with what drawCover paints.
function getPanelRects(layout = state.layout, W = canvas ? canvas.width : 1080, H = canvas ? canvas.height : 1080) {
  const gap = GAP;
  if (layout === 'grid5') {
    const topH = H * 0.46;
    const botH = H * 0.54 - gap;
    return [
      { x: 0, y: 0, w: W * 0.5 - gap / 2, h: topH },
      { x: W * 0.5 + gap / 2, y: 0, w: W * 0.5 - gap / 2, h: topH },
      { x: 0, y: topH + gap, w: W * 0.33 - gap * 0.6, h: botH },
      { x: W * 0.33 + gap * 0.4, y: topH + gap, w: W * 0.34 - gap * 0.6, h: botH },
      { x: W * 0.67 + gap * 0.8, y: topH + gap, w: W * 0.33 - gap * 0.6, h: botH }
    ];
  }
  if (layout === 'overlay') {
    const hw = W * 0.5 - gap / 2;
    const hh = H * 0.5 - gap / 2;
    return [
      { x: 0, y: 0, w: hw, h: hh },
      { x: hw + gap, y: 0, w: hw, h: hh },
      { x: 0, y: hh + gap, w: hw, h: hh },
      { x: hw + gap, y: hh + gap, w: hw, h: hh }
    ];
  }
  if (layout === 'band') {
    const topH = H * 0.65;
    return [
      { x: 0, y: 0, w: W, h: topH },
      { x: 0, y: topH + gap, w: W * 0.33 - gap * 0.6, h: H - topH - gap },
      { x: W * 0.33 + gap * 0.4, y: topH + gap, w: W * 0.34 - gap * 0.6, h: H - topH - gap },
      { x: W * 0.67 + gap * 0.8, y: topH + gap, w: W * 0.33 - gap * 0.6, h: H - topH - gap }
    ];
  }

  const leftW = W * 0.55 - gap / 2;
  const botH = H * 0.25;
  const mainH = H - botH - gap;
  const rightW = W - leftW - gap;
  const rightH3 = (mainH - gap * 2) / 3;
  const bot4W = (W - gap * 3) / 4;

  return [
    { x: 0, y: 0, w: leftW, h: mainH },
    { x: leftW + gap, y: 0, w: rightW, h: rightH3 },
    { x: leftW + gap, y: rightH3 + gap, w: rightW, h: rightH3 },
    { x: leftW + gap, y: (rightH3 + gap) * 2, w: rightW, h: mainH - (rightH3 + gap) * 2 },
    { x: 0, y: mainH + gap, w: bot4W, h: botH },
    { x: bot4W + gap, y: mainH + gap, w: bot4W, h: botH },
    { x: (bot4W + gap) * 2, y: mainH + gap, w: bot4W, h: botH },
    { x: (bot4W + gap) * 3, y: mainH + gap, w: W - (bot4W + gap) * 3, h: botH }
  ];
}

function hitPanel(x, y) {
  const rects = getPanelRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function clampPanel(panel, rect) {
  if (!panel || !rect) return;
  panel.zoom = clamp(Number(panel.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
  panel.ox = Number.isFinite(panel.ox) ? panel.ox : 0.5;
  panel.oy = Number.isFinite(panel.oy) ? panel.oy : 0.5;
  const photo = state.photos[panel.photo];
  if (!photo || !photo.naturalWidth || !photo.naturalHeight) {
    panel.ox = 0.5;
    panel.oy = 0.5;
    return;
  }
  const scale = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * panel.zoom;
  const cropW = rect.w / scale;
  const cropH = rect.h / scale;
  const halfX = Math.min(0.5, cropW / (2 * photo.naturalWidth));
  const halfY = Math.min(0.5, cropH / (2 * photo.naturalHeight));
  panel.ox = halfX >= 0.5 ? 0.5 : clamp(panel.ox, halfX, 1 - halfX);
  panel.oy = halfY >= 0.5 ? 0.5 : clamp(panel.oy, halfY, 1 - halfY);
}

function clampAllPanels() {
  const rects = getPanelRects();
  state.panels.forEach((panel, index) => {
    if (rects[index]) clampPanel(panel, rects[index]);
  });
}

function ensurePanels() {
  while (state.panels.length < MAX_PANELS) {
    const index = state.panels.length;
    state.panels.push({
      photo: state.photos.length ? index % state.photos.length : 0,
      ox: 0.5,
      oy: 0.5,
      zoom: 1
    });
  }
  state.panels.forEach((panel, index) => {
    if (!panel || typeof panel !== 'object') {
      state.panels[index] = { photo: 0, ox: 0.5, oy: 0.5, zoom: 1 };
    }
    const p = state.panels[index];
    p.photo = state.photos.length ? clamp(Number(p.photo) || 0, 0, state.photos.length - 1) : 0;
    p.ox = Number.isFinite(p.ox) ? p.ox : 0.5;
    p.oy = Number.isFinite(p.oy) ? p.oy : 0.5;
    p.zoom = clamp(Number(p.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
  });
  clampAllPanels();
}

function resetPanels(pattern = 0) {
  ensurePanels();
  const rects = getPanelRects();
  for (let i = 0; i < state.panels.length; i++) {
    const panel = state.panels[i];
    let value;
    if (typeof pattern === 'function') value = pattern(i, rects.length);
    else if (Array.isArray(pattern)) value = pattern[i % pattern.length];
    else value = pattern;
    panel.photo = state.photos.length ? clamp(Math.round(Number(value) || 0), 0, state.photos.length - 1) : 0;
    panel.ox = 0.5;
    panel.oy = 0.5;
    panel.zoom = 1;
  }
  clampAllPanels();
}

function syncSlots(force = false) {
  if (!slotsEl) return;
  const rects = getPanelRects();
  const photoSig = state.photos.map(photo => (photo && photo.src ? photo.src : '')).join('|');
  const assignment = state.panels.slice(0, rects.length).map(panel => (panel ? panel.photo : '')).join(',');
  const signature = `${state.layout}#${selected}#${rects.length}#${photoSig}#${assignment}`;
  if (!force && signature === slotSignature) return;
  slotSignature = signature;
  slotsEl.innerHTML = '';

  rects.forEach((rect, index) => {
    const panel = state.panels[index];
    const photo = state.photos[panel ? panel.photo : 0];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `panel-slot${index === selected ? ' active' : ''}`;
    button.title = `Panel ${index + 1} — click to select, then upload or zoom`;
    if (photo && photo.src) {
      button.style.backgroundImage = `url("${photo.src}")`;
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
    } else {
      button.textContent = String(index + 1);
    }
    button.addEventListener('click', () => {
      selected = index;
      syncSlots(true);
      redraw();
      setStatus(`Panel ${index + 1} selected — drag to pan, scroll to zoom`);
    });
    slotsEl.appendChild(button);
  });
}

function syncUI() {
  document.querySelectorAll('.layout-btn[data-layout]').forEach(button => {
    button.classList.toggle('active', button.dataset.layout === state.layout);
  });
  document.querySelectorAll('.grade-btn[data-grade]').forEach(button => {
    button.classList.toggle('active', button.dataset.grade === state.grade);
  });
  const fields = [
    ['title', state.title],
    ['subtitle', state.subtitle],
    ['tagline', state.tagline],
    ['badge', state.badge]
  ];
  for (const [id, value] of fields) {
    const el = document.getElementById(id);
    if (el && el.value !== value) el.value = value;
  }
  const stars = document.getElementById('stars');
  if (stars && stars.value !== String(state.stars)) stars.value = String(state.stars);
}

function drawSelection() {
  if (!canvas || !ctx || document.body.classList.contains('shot-cover')) return;
  const rect = getPanelRects()[selected];
  if (!rect) return;
  const line = Math.max(3, Math.round(canvas.width * 0.006));
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowColor = 'rgba(255, 45, 120, 0.9)';
  ctx.shadowBlur = line * 3;
  ctx.strokeStyle = '#ff2d78';
  ctx.lineWidth = line;
  ctx.strokeRect(rect.x + line / 2, rect.y + line / 2, Math.max(0, rect.w - line), Math.max(0, rect.h - line));
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = Math.max(1, line / 3);
  ctx.strokeRect(rect.x + line / 2, rect.y + line / 2, Math.max(0, rect.w - line), Math.max(0, rect.h - line));
  ctx.restore();
}

function redraw() {
  if (!ctx || !canvas) return;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    drawCover(ctx, canvas.width, canvas.height, state);
    drawSelection();
    syncSlots();
  });
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
  };
}

function onPointerDown(event) {
  if (!canvas || document.body.classList.contains('shot-cover')) return;
  const point = canvasPoint(event);
  const index = hitPanel(point.x, point.y);
  if (index < 0) return;
  selected = index;
  drag = { pointerId: event.pointerId, x: point.x, y: point.y };
  if (canvas.setPointerCapture) {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is a convenience; dragging still works without it.
    }
  }
  canvas.style.cursor = 'grabbing';
  syncSlots(true);
  redraw();
  setStatus(`Panel ${index + 1} selected — drag to pan, scroll to zoom`);
  event.preventDefault();
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const point = canvasPoint(event);
  const rect = getPanelRects()[selected];
  const panel = state.panels[selected];
  if (!rect || !panel) return;
  const dx = point.x - drag.x;
  const dy = point.y - drag.y;
  drag.x = point.x;
  drag.y = point.y;
  panel.ox -= dx / Math.max(1, rect.w);
  panel.oy -= dy / Math.max(1, rect.h);
  clampPanel(panel, rect);
  redraw();
  event.preventDefault();
}

function endDrag(event) {
  if (!drag) return;
  if (event && event.pointerId !== drag.pointerId) return;
  if (canvas && canvas.releasePointerCapture) {
    try {
      canvas.releasePointerCapture(drag.pointerId);
    } catch (error) {
      // Ignore a capture that was already released.
    }
  }
  drag = null;
  if (canvas) canvas.style.cursor = 'grab';
}

function onWheel(event) {
  if (!canvas || document.body.classList.contains('shot-cover')) return;
  const point = canvasPoint(event);
  const hit = hitPanel(point.x, point.y);
  if (hit >= 0 && hit !== selected) {
    selected = hit;
    syncSlots(true);
  }
  const rect = getPanelRects()[selected];
  const panel = state.panels[selected];
  if (!rect || !panel) return;
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.0015);
  panel.zoom = clamp(panel.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  clampPanel(panel, rect);
  redraw();
  setStatus(`Panel ${selected + 1} zoom ${panel.zoom.toFixed(2)}×`);
}

function zoomSelected(factor) {
  const rect = getPanelRects()[selected];
  const panel = state.panels[selected];
  if (!rect || !panel) return;
  panel.zoom = clamp((Number(panel.zoom) || 1) * factor, MIN_ZOOM, MAX_ZOOM);
  clampPanel(panel, rect);
  redraw();
  setStatus(`Panel ${selected + 1} zoom ${panel.zoom.toFixed(2)}×`);
}

async function addPhotos(files) {
  const list = Array.from(files || [])
    .filter(file => file && file.type && file.type.startsWith('image/'))
    .slice(0, MAX_PHOTOS);
  if (!list.length) {
    setStatus('No image files found');
    return;
  }

  setStatus(`Loading ${list.length} photo${list.length === 1 ? '' : 's'}…`);
  const loaded = [];
  for (const file of list) {
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      loaded.push(img);
    } catch (error) {
      console.warn('Could not load photo', error);
    }
  }
  if (!loaded.length) {
    setStatus('Could not read those images');
    return;
  }

  const appended = [];
  let cursor = 0;
  for (const img of loaded) {
    if (state.photos.length < MAX_PHOTOS) {
      state.photos.push(img);
      appended.push(state.photos.length - 1);
    } else {
      const panel = state.panels[selected];
      const start = panel && Number.isInteger(panel.photo) ? panel.photo : replaceCursor % MAX_PHOTOS;
      const index = (start + cursor) % MAX_PHOTOS;
      cursor++;
      state.photos[index] = img;
      replaceCursor = index + 1;
    }
  }

  ensurePanels();
  const rects = getPanelRects();
  let panelIndex = Math.min(selected, Math.max(0, rects.length - 1));
  for (const photoIndex of appended) {
    const panel = state.panels[panelIndex];
    if (panel) {
      panel.photo = photoIndex;
      panel.ox = 0.5;
      panel.oy = 0.5;
      panel.zoom = 1;
    }
    panelIndex = (panelIndex + 1) % Math.max(1, rects.length);
  }

  clampAllPanels();
  syncSlots(true);
  redraw();
  setStatus(`${state.photos.length}/${MAX_PHOTOS} photos in the stack — drag a panel to pan, scroll to zoom`);
}

function slug(text) {
  return String(text || 'cover')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'cover';
}

function exportPNG(w, h, filename) {
  setStatus(`Rendering ${w}×${h}…`);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d');
  try {
    drawCover(outCtx, w, h, state);
  } catch (error) {
    console.error('Cover render failed', error);
    setStatus('Export failed while drawing the cover');
    return;
  }
  out.toBlob(blob => {
    if (!blob) {
      setStatus('Export failed');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    setStatus(`Saved ${filename} (${w}×${h})`);
  }, 'image/png');
}

function bindText(id, apply) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    apply(el.value);
    redraw();
  });
}

function wireDrop() {
  if (!canvas) return;
  const over = event => {
    event.preventDefault();
    if (!document.body.classList.contains('shot-cover')) {
      canvas.style.boxShadow = '0 0 0 4px #ff2d78';
    }
  };
  const out = () => {
    canvas.style.boxShadow = '';
  };
  canvas.addEventListener('dragenter', over);
  canvas.addEventListener('dragover', over);
  canvas.addEventListener('dragleave', out);
  canvas.addEventListener('drop', event => {
    event.preventDefault();
    out();
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files || []) : [];
    if (files.length) addPhotos(files);
  });
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
}

const LAYOUT_LABELS = {
  hero: 'Hero Left',
  grid5: 'Grid 5',
  overlay: 'Title Overlay',
  band: 'Band Bottom'
};

function wireUI() {
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const files = photoInput.files ? Array.from(photoInput.files) : [];
      photoInput.value = '';
      if (files.length) addPhotos(files);
    });
  }

  document.querySelectorAll('.layout-btn[data-layout]').forEach(button => {
    button.addEventListener('click', () => {
      const layout = button.dataset.layout;
      if (!LAYOUTS.includes(layout)) return;
      state.layout = layout;
      selected = clamp(selected, 0, Math.max(0, getPanelRects().length - 1));
      clampAllPanels();
      syncUI();
      syncSlots(true);
      redraw();
      setStatus(`${LAYOUT_LABELS[layout] || layout} layout · ${GRADES[state.grade] ? GRADES[state.grade].label : state.grade} grade`);
    });
  });

  document.querySelectorAll('.grade-btn[data-grade]').forEach(button => {
    button.addEventListener('click', () => {
      const grade = button.dataset.grade;
      if (!GRADES[grade]) return;
      state.grade = grade;
      syncUI();
      redraw();
      setStatus(`${GRADES[grade].label} grade applied`);
    });
  });

  bindText('title', value => {
    state.title = value;
  });
  bindText('subtitle', value => {
    state.subtitle = value;
  });
  bindText('tagline', value => {
    state.tagline = value;
  });
  bindText('badge', value => {
    state.badge = value;
  });
  bindText('cast', value => {
    state.cast = value
      .split(',')
      .map(name => name.trim().toUpperCase())
      .filter(Boolean);
  });
  bindText('review', value => {
    state.review = value;
  });

  const stars = document.getElementById('stars');
  if (stars) {
    const applyStars = () => {
      state.stars = clamp(parseInt(stars.value, 10) || 0, 0, 5);
      redraw();
    };
    stars.addEventListener('change', applyStars);
    stars.addEventListener('input', applyStars);
  }

  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  if (zoomIn) zoomIn.addEventListener('click', () => zoomSelected(1.25));
  if (zoomOut) zoomOut.addEventListener('click', () => zoomSelected(0.8));

  const exports = [
    ['export-square', 1080, 1080],
    ['export-tall', 1080, 1350],
    ['export-wide', 1920, 1080]
  ];
  for (const [id, w, h] of exports) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', () => exportPNG(w, h, `${slug(state.title)}-${w}x${h}.png`));
    }
  }

  wireDrop();
}

async function loadDefaults() {
  const names = ['boulevard', 'pier'];
  const results = await Promise.allSettled(names.map(name => loadSample(name)));
  const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (loaded.length) state.photos = loaded;
}

async function waitForFonts() {
  if (!document.fonts) return;
  const jobs = [];
  try {
    jobs.push(document.fonts.load('400 100px Anton'));
  } catch (error) {
    // The face may not be declared; fall back to the system display stack.
  }
  try {
    jobs.push(document.fonts.load('400 100px Yellowtail'));
  } catch (error) {
    // The face may not be declared; fall back to cursive.
  }
  try {
    jobs.push(document.fonts.ready);
  } catch (error) {
    // Older engines without FontFaceSet still render with fallbacks.
  }
  try {
    await Promise.allSettled(jobs);
  } catch (error) {
    // Rendering must never be blocked by a font failure.
  }
}

async function boot() {
  if (!canvas || !ctx) {
    setStatus('Canvas not found');
    return;
  }

  wireUI();
  await loadDefaults();
  ensurePanels();
  syncUI();
  syncSlots(true);
  await waitForFonts();
  redraw();

  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => redraw());
  }

  window.__coverApp = {
    state,
    canvas,
    ctx,
    loadImage,
    loadSample,
    sampleUrl,
    redraw,
    syncUI,
    syncSlots,
    ensurePanels,
    resetPanels,
    clampPanels: clampAllPanels,
    getPanelRects,
    getSelected: () => selected,
    setSelected: index => {
      selected = clamp(Number(index) || 0, 0, Math.max(0, getPanelRects().length - 1));
      syncSlots(true);
    },
    setStatus,
    addPhotos,
    exportPNG
  };

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    try {
      await runShot(shot, params, loadSample);
    } catch (error) {
      console.error('Shot failed', error);
      setStatus(`Shot failed: ${error.message}`);
    }
  } else {
    setStatus('Ready — drag panels to pan, scroll to zoom');
  }
}

boot();
