// Vice Cover — Editor main controller
import { drawCover, GRADES, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');

const state = {
  layout: 'hero',
  grade: 'heatwave',
  title: document.getElementById('title')?.value || 'SUNSET HEIST',
  subtitle: document.getElementById('subtitle')?.value || 'Coastline Nights',
  tagline: document.getElementById('tagline')?.value || 'ONE LAST SCORE — SUMMER 2026',
  badge: document.getElementById('badge')?.value || 'EST. 2026',
  stars: parseInt(document.getElementById('stars')?.value || '5', 10),
  photos: [],
  activePanel: 0,
  panels: Array.from({ length: 6 }, (_, i) => ({ photoIndex: i % 2, ox: 0, oy: 0, zoom: 1 }))
};

function setStatus(text, type = 'ok') {
  if (!status) return;
  status.className = type === 'ok' ? 'is-ok' : type === 'busy' ? 'is-busy' : 'is-error';
  const textEl = status.querySelector('.status-text');
  if (textEl) textEl.textContent = text;
}

function redraw() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, canvas.width, canvas.height, state);

  // Draw selection outline around active panel in editor mode
  if (!document.body.classList.contains('shot-cover') && state.activePanel !== null) {
    const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
    const gap = 8;
    const panelBoxes = layout.panels.map(p => ({
      x: p.x * canvas.width + gap / 2,
      y: p.y * canvas.height + gap / 2,
      w: p.w * canvas.width - gap,
      h: p.h * canvas.height - gap
    }));
    const box = panelBoxes[state.activePanel];
    if (box) {
      ctx.save();
      ctx.strokeStyle = '#ff2d78';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
      ctx.restore();
    }
  }
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Add photos & Drag-drop
async function handleFiles(files) {
  if (!files || files.length === 0) return;
  setStatus('Loading photos...', 'busy');
  for (const file of files) {
    if (state.photos.length >= 5) break;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push(img);
    } catch (err) {
      console.error(err);
    }
  }
  updatePhotoSelects();
  setStatus(`Loaded ${state.photos.length} photo(s)`, 'ok');
  redraw();
}

document.getElementById('photo')?.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

const uploadLabel = document.querySelector('.upload');
if (uploadLabel) {
  uploadLabel.addEventListener('dragover', (e) => { e.preventDefault(); uploadLabel.classList.add('is-dragover'); });
  uploadLabel.addEventListener('dragleave', () => { uploadLabel.classList.remove('is-dragover'); });
  uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadLabel.classList.remove('is-dragover');
    handleFiles(e.dataTransfer.files);
  });
}

canvas?.addEventListener('dragover', (e) => e.preventDefault());
canvas?.addEventListener('drop', (e) => {
  e.preventDefault();
  handleFiles(e.dataTransfer.files);
});

// Layout buttons
document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.layout-btn').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    state.layout = btn.dataset.layout;
    redraw();
  });
});

// Grade buttons
document.querySelectorAll('.grade-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.grade-btn').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    state.grade = btn.dataset.grade;
    redraw();
  });
});

// Panel slots selection
document.querySelectorAll('.panel-slot').forEach(slot => {
  slot.addEventListener('click', () => {
    document.querySelectorAll('.panel-slot').forEach(s => {
      s.classList.remove('is-active');
      s.setAttribute('aria-pressed', 'false');
    });
    slot.classList.add('is-active');
    slot.setAttribute('aria-pressed', 'true');
    state.activePanel = parseInt(slot.dataset.panel, 10);
    updateZoomReadout();
    redraw();
  });
});

// Panel photo selects
document.querySelectorAll('.panel-photo').forEach(sel => {
  sel.addEventListener('change', (e) => {
    const panelIdx = parseInt(sel.dataset.panel, 10);
    if (state.panels[panelIdx]) {
      state.panels[panelIdx].photoIndex = parseInt(e.target.value, 10);
      redraw();
    }
  });
});

function updatePhotoSelects() {
  document.querySelectorAll('.panel-photo').forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = '';
    state.photos.forEach((_, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Photo ${idx + 1}`;
      if (idx.toString() === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// Text inputs
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const taglineInput = document.getElementById('tagline');
const badgeInput = document.getElementById('badge');
const starsSelect = document.getElementById('stars');

titleInput?.addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
subtitleInput?.addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
taglineInput?.addEventListener('input', (e) => { state.tagline = e.target.value; redraw(); });
badgeInput?.addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
starsSelect?.addEventListener('change', (e) => { state.stars = parseInt(e.target.value, 10); redraw(); });

// Zoom controls
function updateZoomReadout() {
  const readout = document.querySelector('.zoom-readout span');
  if (readout && state.panels[state.activePanel]) {
    readout.textContent = `${Math.round(state.panels[state.activePanel].zoom * 100)}%`;
  }
}

document.getElementById('zoom-in')?.addEventListener('click', () => {
  const p = state.panels[state.activePanel];
  if (p) {
    p.zoom = Math.min(4.0, p.zoom + 0.2);
    updateZoomReadout();
    redraw();
  }
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
  const p = state.panels[state.activePanel];
  if (p) {
    p.zoom = Math.max(1.0, p.zoom - 0.2);
    updateZoomReadout();
    redraw();
  }
});

// Canvas click to select panel
canvas?.addEventListener('click', (e) => {
  if (document.body.classList.contains('shot-cover')) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
  const gap = 8;
  const panelBoxes = layout.panels.map(p => ({
    x: p.x * canvas.width + gap / 2,
    y: p.y * canvas.height + gap / 2,
    w: p.w * canvas.width - gap,
    h: p.h * canvas.height - gap
  }));

  for (let i = 0; i < panelBoxes.length; i++) {
    const b = panelBoxes[i];
    if (clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h) {
      state.activePanel = i;
      document.querySelectorAll('.panel-slot').forEach(slot => {
        const pIdx = parseInt(slot.dataset.panel, 10);
        if (pIdx === i) {
          slot.classList.add('is-active');
          slot.setAttribute('aria-pressed', 'true');
        } else {
          slot.classList.remove('is-active');
          slot.setAttribute('aria-pressed', 'false');
        }
      });
      updateZoomReadout();
      redraw();
      break;
    }
  }
});

// Canvas drag panning & scroll zoom
let isDragging = false;
let startX = 0, startY = 0;

canvas?.addEventListener('mousedown', (e) => {
  if (document.body.classList.contains('shot-cover')) return;
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  startX = e.clientX;
  startY = e.clientY;

  const p = state.panels[state.activePanel];
  if (p && state.photos.length > 0) {
    const photo = state.photos[p.photoIndex] || state.photos[0];
    if (photo && photo.complete && photo.naturalWidth) {
      const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
      const panelDef = layout.panels[state.activePanel] || layout.panels[0];
      const gap = 8;
      const boxW = panelDef.w * canvas.width - gap;
      const boxH = panelDef.h * canvas.height - gap;
      const scale = Math.max(boxW / photo.naturalWidth, boxH / photo.naturalHeight) * p.zoom;
      const pw = photo.naturalWidth * scale;
      const ph = photo.naturalHeight * scale;

      const maxOx = Math.max(0, (pw - boxW) / 2);
      const maxOy = Math.max(0, (ph - boxH) / 2);

      p.ox = Math.max(-maxOx, Math.min(maxOx, p.ox + dx));
      p.oy = Math.max(-maxOy, Math.min(maxOy, p.oy + dy));
      redraw();
    }
  }
});

window.addEventListener('mouseup', () => { isDragging = false; });

canvas?.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = state.panels[state.activePanel];
  if (p) {
    p.zoom = Math.max(1.0, Math.min(4.0, p.zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
    updateZoomReadout();
    redraw();
  }
}, { passive: false });

// Export PNG function
function exportPNG(width, height, filename) {
  setStatus('Exporting PNG...', 'busy');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  drawCover(tempCanvas, width, height, state);

  tempCanvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setStatus(`Exported ${filename} (${width}×${height})`, 'ok');
  }, 'image/png');
}

document.getElementById('export-square')?.addEventListener('click', () => exportPNG(1080, 1080, 'cover-1080x1080.png'));
document.getElementById('export-tall')?.addEventListener('click', () => exportPNG(1080, 1350, 'cover-1080x1350.png'));
document.getElementById('export-wide')?.addEventListener('click', () => exportPNG(1920, 1080, 'cover-1920x1080.png'));

// Initialization & fonts
async function init() {
  setStatus('Initializing...', 'busy');
  try {
    const [p1, p2] = await Promise.all([
      loadImage('samples/boulevard.jpg').catch(() => null),
      loadImage('samples/pier.jpg').catch(() => null)
    ]);
    if (p1) state.photos.push(p1);
    if (p2) state.photos.push(p2);
    if (state.photos.length === 0) {
      const p = await loadImage('samples/pier.jpg').catch(() => null);
      if (p) state.photos.push(p);
    }
  } catch (err) {
    console.error(err);
  }

  updatePhotoSelects();
  updateZoomReadout();

  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('16px Anton'),
        document.fonts.load('16px Yellowtail'),
        document.fonts.ready
      ]);
    } catch (e) {
      console.warn('Font loading error:', e);
    }
  }

  const urlParams = new URLSearchParams(location.search);
  const shotParam = urlParams.get('shot');
  if (shotParam) {
    runShot(shotParam, urlParams, async (sampleUrl, captionText) => {
      try {
        const img = await loadImage(sampleUrl);
        state.photos = [img];
        if (urlParams.get('layout')) state.layout = urlParams.get('layout');
        if (urlParams.get('grade')) state.grade = urlParams.get('grade');
        if (captionText) state.title = captionText;
        const titleEl = document.getElementById('title');
        if (titleEl) titleEl.value = state.title;
        redraw();
      } catch (err) {
        console.error(err);
        redraw();
      }
    });
  } else {
    redraw();
    setStatus('Editor ready', 'ok');
  }

  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', () => redraw());
  }
}

init();
