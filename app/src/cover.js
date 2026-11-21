// GTA 6 Cover Art Rendering Engine (app/src/cover.js)

export const GRADES = {
  heatwave: {
    label: 'Heatwave',
    stops: [[0, '#1a0b2e'], [0.3, '#ff2d78'], [0.7, '#ff7a18'], [1, '#ffd319']],
    posterize: 5,
    halftone: true,
    vignette: 0.4
  },
  golden: {
    label: 'Golden Coast',
    stops: [[0, '#1f0b12'], [0.35, '#ff5a1f'], [0.75, '#ff9a3c'], [1, '#ffea79']],
    posterize: 5,
    halftone: true,
    vignette: 0.35
  },
  neon: {
    label: 'Neon Vice',
    stops: [[0, '#140526'], [0.3, '#7b2fff'], [0.7, '#ff2d78'], [1, '#ffae7a']],
    posterize: 5,
    halftone: true,
    vignette: 0.4
  },
  noir: {
    label: 'Noir Teal',
    stops: [[0, '#051216'], [0.35, '#0e4a5d'], [0.75, '#2bb6cb'], [1, '#a0f0ff']],
    posterize: 5,
    halftone: true,
    vignette: 0.5
  },
  mono: {
    label: 'Mono Ink',
    stops: [[0, '#080808'], [0.3, '#444444'], [0.7, '#cccccc'], [1, '#ffffff']],
    posterize: 6,
    halftone: true,
    vignette: 0.4
  }
};

export const LAYOUTS = {
  hero: {
    name: 'hero',
    panels: [
      { x: 0, y: 0, w: 0.56, h: 0.72 }, // P0: Big hero left
      { x: 0.56, y: 0, w: 0.44, h: 0.24 }, // P1: Right top
      { x: 0.56, y: 0.24, w: 0.44, h: 0.24 }, // P2: Right mid
      { x: 0.56, y: 0.48, w: 0.44, h: 0.24 }, // P3: Right low
      { x: 0, y: 0.72, w: 0.5, h: 0.28 }, // P4: Bottom left
      { x: 0.5, y: 0.72, w: 0.5, h: 0.28 } // P5: Bottom right
    ]
  },
  grid5: {
    name: 'grid5',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.48 }, // P0
      { x: 0.5, y: 0, w: 0.5, h: 0.48 }, // P1
      { x: 0, y: 0.48, w: 0.333, h: 0.52 }, // P2
      { x: 0.333, y: 0.48, w: 0.333, h: 0.52 }, // P3
      { x: 0.666, y: 0.48, w: 0.334, h: 0.52 }, // P4
      { x: 0, y: 0, w: 0, h: 0 } // P5 unused
    ]
  },
  overlay: {
    name: 'overlay',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, // P0
      { x: 0.5, y: 0, w: 0.5, h: 0.5 }, // P1
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }, // P2
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, // P3
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 }
    ]
  },
  band: {
    name: 'band',
    panels: [
      { x: 0, y: 0, w: 1.0, h: 0.62 }, // P0: Top hero wide
      { x: 0, y: 0.62, w: 0.333, h: 0.38 }, // P1
      { x: 0.333, y: 0.62, w: 0.333, h: 0.38 }, // P2
      { x: 0.666, y: 0.62, w: 0.334, h: 0.38 }, // P3
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 }
    ]
  }
};

// LUT Cache for grades
const lutCache = {};

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(char => char + char).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getOrCreateLUT(gradeKey) {
  if (lutCache[gradeKey]) return lutCache[gradeKey];
  const grade = GRADES[gradeKey] || GRADES.heatwave;
  const stops = grade.stops.map(s => ({ t: s[0], rgb: hexToRgb(s[1]) }));
  
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Find surrounding stops
    let low = stops[0];
    let high = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].t && t <= stops[s+1].t) {
        low = stops[s];
        high = stops[s+1];
        break;
      }
    }
    const range = high.t - low.t;
    const factor = range === 0 ? 0 : (t - low.t) / range;
    
    const r = Math.round(low.rgb[0] + factor * (high.rgb[0] - low.rgb[0]));
    const g = Math.round(low.rgb[1] + factor * (high.rgb[1] - low.rgb[1]));
    const b = Math.round(low.rgb[2] + factor * (high.rgb[2] - low.rgb[2]));

    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  lutCache[gradeKey] = lut;
  return lut;
}

export function applyGrade(imageData, gradeName) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const gradeKey = typeof gradeName === 'string' ? gradeName : (gradeName?.name || 'heatwave');
  const grade = GRADES[gradeKey] || GRADES.heatwave;
  const lut = getOrCreateLUT(gradeKey);
  const posterizeLevels = grade.posterize || 5;
  const hasHalftone = grade.halftone !== false;
  const vignetteStrength = grade.vignette || 0.4;

  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      // 1. Luminance
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      // 2. Gradient map via LUT
      const lutIdx = lum * 3;
      r = lut[lutIdx];
      g = lut[lutIdx + 1];
      b = lut[lutIdx + 2];

      // 3. Posterize
      r = Math.floor(r * posterizeLevels / 256) * (255 / (posterizeLevels - 1));
      g = Math.floor(g * posterizeLevels / 256) * (255 / (posterizeLevels - 1));
      b = Math.floor(b * posterizeLevels / 256) * (255 / (posterizeLevels - 1));

      // 4. Halftone dot screen overlay
      if (hasHalftone) {
        const cellSize = 5;
        const subX = x % cellSize - cellSize / 2;
        const subY = y % cellSize - cellSize / 2;
        const distSq = subX * subX + subY * subY;
        // Dot radius grows with darkness (255 - lum)
        const darkness = (255 - lum) / 255;
        const radius = darkness * (cellSize * 0.55);
        if (distSq < radius * radius) {
          r *= 0.5;
          g *= 0.5;
          b *= 0.5;
        }
      }

      // 5. Vignette
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vig = 1 - (dist / maxDist) * vignetteStrength;
      r *= Math.max(0, Math.min(1, vig));
      g *= Math.max(0, Math.min(1, vig));
      b *= Math.max(0, Math.min(1, vig));

      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
    }
  }
  return imageData;
}

export function drawStarburst(ctx, x, y, r, text) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffd319';
  ctx.strokeStyle = '#12081f';
  ctx.lineWidth = 3;

  ctx.beginPath();
  const points = 14;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const rad = i % 2 === 0 ? r : r * 0.65;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner badge circle
  const innerR = r * 0.75;
  ctx.fillStyle = '#ff2d78';
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Badge text
  ctx.fillStyle = '#ffffff';
  let fontSz = Math.round(r * 0.22);
  ctx.font = `bold ${fontSz}px sans-serif`;
  const maxTextWidth = innerR * 1.6;
  while (ctx.measureText(text).width > maxTextWidth && fontSz > 8) {
    fontSz -= 1;
    ctx.font = `bold ${fontSz}px sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function drawSkyline(ctx, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);

  // Sunset gradient background behind skyline
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255, 112, 24, 0.2)');
  grad.addColorStop(1, 'rgba(255, 45, 120, 0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Buildings silhouette
  ctx.fillStyle = '#0d0417';
  const buildings = [
    { bx: 0.0, bw: 0.08, bh: 0.7 },
    { bx: 0.07, bw: 0.06, bh: 0.9 },
    { bx: 0.12, bw: 0.10, bh: 0.5 },
    { bx: 0.21, bw: 0.07, bh: 0.85 },
    { bx: 0.27, bw: 0.09, bh: 0.6 },
    { bx: 0.35, bw: 0.05, bh: 0.95 },
    { bx: 0.39, bw: 0.11, bh: 0.65 },
    { bx: 0.49, bw: 0.08, bh: 0.8 },
    { bx: 0.56, bw: 0.12, bh: 0.45 },
    { bx: 0.67, bw: 0.07, bh: 0.9 },
    { bx: 0.73, bw: 0.09, bh: 0.75 },
    { bx: 0.81, bw: 0.06, bh: 0.88 },
    { bx: 0.86, bw: 0.14, bh: 0.55 }
  ];

  for (const b of buildings) {
    const bx = b.bx * w;
    const bw = b.bw * w + 2;
    const bh = b.bh * h;
    const by = h - bh;
    ctx.fillRect(bx, by, bw, bh);

    // Glowing windows
    ctx.fillStyle = 'rgba(255, 211, 25, 0.4)';
    for (let wy = by + 6; wy < h - 4; wy += 10) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
        if ((wx + wy) % 3 === 0) {
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    ctx.fillStyle = '#0d0417';
  }

  // Palm trees silhouette (2-3 palms)
  drawPalmTree(ctx, w * 0.15, h, h * 0.85);
  drawPalmTree(ctx, w * 0.85, h, h * 0.9);
  drawPalmTree(ctx, w * 0.92, h, h * 0.75);

  ctx.restore();
}

function drawPalmTree(ctx, px, py, height) {
  ctx.save();
  ctx.strokeStyle = '#08030f';
  ctx.lineWidth = Math.max(3, height * 0.04);
  ctx.lineCap = 'round';

  // Trunk curved path
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.quadraticCurveTo(px + height * 0.08, py - height * 0.5, px + height * 0.15, py - height);
  ctx.stroke();

  // Fronds at top
  const topX = px + height * 0.15;
  const topY = py - height;
  const frondLen = height * 0.35;

  ctx.lineWidth = Math.max(2, height * 0.015);
  const angles = [-2.5, -2.1, -1.6, -1.1, -0.6, -0.1];
  for (const a of angles) {
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    const endX = topX + Math.cos(a) * frondLen;
    const endY = topY + Math.sin(a) * frondLen * 0.6 - frondLen * 0.2;
    ctx.quadraticCurveTo(topX + Math.cos(a) * (frondLen * 0.5), topY - frondLen * 0.4, endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlaceholderPanel(ctx, x, y, w, h) {
  // Sunset gradient placeholder
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#ff7a18');
  grad.addColorStop(0.5, '#ff2d78');
  grad.addColorStop(1, '#7b2fff');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Palm silhouette in placeholder
  ctx.save();
  ctx.fillStyle = 'rgba(18, 8, 31, 0.7)';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.4, Math.min(w, h) * 0.15, 0, Math.PI * 2);
  ctx.fill();
  drawSkyline(ctx, x, y + h * 0.5, w, h * 0.5);
  ctx.restore();
}

export function drawCover(ctx, W, H, state) {
  // 1. Clear background (#12081f)
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const layout = LAYOUTS[state.layout] || LAYOUTS.hero;
  const gap = Math.round(Math.min(W, H) * 0.007); // ~6-10px gap

  // 2. Render panels
  const panelBoxes = layout.panels.map(p => ({
    x: p.x * W + gap / 2,
    y: p.y * H + gap / 2,
    w: p.w * W - gap,
    h: p.h * H - gap,
    def: p
  }));

  for (let i = 0; i < panelBoxes.length; i++) {
    const box = panelBoxes[i];
    if (box.w <= 0 || box.h <= 0) continue;

    // Panel background / border fill
    ctx.fillStyle = '#12081f';
    ctx.fillRect(box.x - gap / 2, box.y - gap / 2, box.w + gap, box.h + gap);

    const panelState = state.panels && state.panels[i] ? state.panels[i] : { photoIndex: i % Math.max(1, state.photos.length), ox: 0, oy: 0, zoom: 1 };
    const photoIdx = panelState.photoIndex ?? (i % Math.max(1, state.photos.length));
    const photo = state.photos && state.photos[photoIdx] ? state.photos[photoIdx] : (state.photos && state.photos[0] ? state.photos[0] : null);

    if (!photo || !photo.complete || !photo.naturalWidth) {
      drawPlaceholderPanel(ctx, box.x, box.y, box.w, box.h);
    } else {
      // Render photo with cover-fit crop & pan/zoom
      const bw = Math.round(box.w);
      const bh = Math.round(box.h);
      if (bw <= 0 || bh <= 0) continue;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = bw;
      offCanvas.height = bh;
      const offCtx = offCanvas.getContext('2d');

      const scale = Math.max(bw / photo.naturalWidth, bh / photo.naturalHeight) * (panelState.zoom || 1);
      const pw = photo.naturalWidth * scale;
      const ph = photo.naturalHeight * scale;
      const px = (bw - pw) / 2 + (panelState.ox || 0);
      const py = (bh - ph) / 2 + (panelState.oy || 0);

      offCtx.drawImage(photo, px, py, pw, ph);

      // Apply grade
      const imgData = offCtx.getImageData(0, 0, bw, bh);
      applyGrade(imgData, state.grade || 'heatwave');
      offCtx.putImageData(imgData, 0, 0);

      ctx.drawImage(offCanvas, box.x, box.y);
    }
  }

  // 3. Extra graphics & text overlays
  ctx.save();

  // Starburst badge
  const badgeText = state.badge || 'EST. 2026';
  drawStarburst(ctx, W * 0.88, H * 0.12, Math.min(W, H) * 0.065, badgeText);

  // Skyline along bottom or lower third
  drawSkyline(ctx, 0, H * 0.72, W, H * 0.18);

  // Tagline bar
  const tagline = state.tagline || 'ONE LAST SCORE — SUMMER 2026';
  if (tagline) {
    const barY = H * 0.89;
    const barH = H * 0.05;
    ctx.fillStyle = 'rgba(18, 8, 31, 0.85)';
    ctx.fillRect(0, barY, W, barH);

    ctx.fillStyle = '#ffd319';
    const tagFontSize = Math.round(barH * 0.45);
    ctx.font = `bold ${tagFontSize}px Anton, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagline.toUpperCase(), W / 2, barY + barH / 2);
  }

  // Star rating
  const starsCount = typeof state.stars === 'number' ? state.stars : 5;
  if (starsCount > 0) {
    const starSize = Math.min(W, H) * 0.025;
    const startX = W * 0.5 - (starsCount * starSize * 1.3) / 2;
    const starY = H * 0.965;
    ctx.fillStyle = '#ffd319';
    for (let s = 0; s < starsCount; s++) {
      drawStar(ctx, startX + s * starSize * 1.4, starY, starSize * 0.5, starSize * 0.25);
    }
  }

  // Giant Title (25-35% of cover height visually, auto-fit width)
  const titleText = (state.title || 'SUNSET HEIST').toUpperCase();
  let titleSize = H * 0.28;
  ctx.font = `900 ${titleSize}px Anton, 'Arial Black', Impact, sans-serif`;
  while (ctx.measureText(titleText).width > W * 0.92 && titleSize > 24) {
    titleSize -= 2;
    ctx.font = `900 ${titleSize}px Anton, 'Arial Black', Impact, sans-serif`;
  }

  const titleX = W / 2;
  const titleY = H * 0.62;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = titleSize * 0.25;
  ctx.shadowOffsetX = titleSize * 0.04;
  ctx.shadowOffsetY = titleSize * 0.04;

  // Dark Outline
  ctx.lineWidth = titleSize * 0.09;
  ctx.strokeStyle = '#0a0412';
  ctx.strokeText(titleText, titleX, titleY);

  // Gradient fill (magenta -> orange)
  const titleGrad = ctx.createLinearGradient(titleX - W * 0.4, titleY - titleSize * 0.5, titleX + W * 0.4, titleY + titleSize * 0.5);
  titleGrad.addColorStop(0, '#ff2d78');
  titleGrad.addColorStop(0.5, '#ff7a18');
  titleGrad.addColorStop(1, '#ffd319');
  ctx.fillStyle = titleGrad;
  ctx.fillText(titleText, titleX, titleY);

  // Reset shadow for subtitle
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Subtitle in Yellowtail script with neon glow
  const subtitleText = state.subtitle || 'Coastline Nights';
  if (subtitleText) {
    const subSize = Math.max(20, Math.round(titleSize * 0.45));
    ctx.font = `400 ${subSize}px Yellowtail, cursive, sans-serif`;
    
    // Neon glow
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    // Position overlapping top/side of title
    ctx.fillText(subtitleText, titleX - W * 0.15, titleY - titleSize * 0.38);
    
    // Second pass for brighter glow
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffae7a';
    ctx.fillText(subtitleText, titleX - W * 0.15, titleY - titleSize * 0.38);
  }

  ctx.restore();
}

function drawStar(ctx, cx, cy, rOuter, rInner) {
  ctx.beginPath();
  const pts = 5;
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
