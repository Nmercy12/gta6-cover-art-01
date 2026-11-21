// GTA 6 Cover Art Rendering Engine
// Pure canvas code, no DOM access except the ctx passed in.

export const GRADES = {
  heatwave: {
    label: 'Heatwave',
    stops: [
      [0, '#1a0b2e'],
      [0.35, '#ff2d78'],
      [0.7, '#ff7a18'],
      [1.0, '#ffd319']
    ],
    posterize: 5,
    halftone: true,
    vignette: 0.6
  },
  golden: {
    label: 'Golden Coast',
    stops: [
      [0, '#1f0b12'],
      [0.4, '#ff4b33'],
      [0.75, '#ff8c33'],
      [1.0, '#ffeb99']
    ],
    posterize: 5,
    halftone: true,
    vignette: 0.5
  },
  neon: {
    label: 'Neon Vice',
    stops: [
      [0, '#140826'],
      [0.35, '#7b2fff'],
      [0.7, '#ff2d78'],
      [1.0, '#00f0ff']
    ],
    posterize: 5,
    halftone: true,
    vignette: 0.7
  },
  noir: {
    label: 'Noir Teal',
    stops: [
      [0, '#051114'],
      [0.35, '#0a2e36'],
      [0.7, '#008b8b'],
      [1.0, '#00f0ff']
    ],
    posterize: 5,
    halftone: false,
    vignette: 0.8
  },
  mono: {
    label: 'Mono Ink',
    stops: [
      [0, '#050505'],
      [0.35, '#333333'],
      [0.7, '#999999'],
      [1.0, '#ffffff']
    ],
    posterize: 5,
    halftone: false,
    vignette: 0.6
  }
,
  vice: {
    label: 'Vice Nights',
    stops: [
      [0, '#0d0221'],
      [0.35, '#3a0ca3'],
      [0.7, '#f72585'],
      [1.0, '#ff9fd6']
    ],
    posterize: 5,
    halftone: true,
    vignette: 0.65
  },
  midnight: {
    label: 'Midnight Moon',
    stops: [
      [0, '#020814'],
      [0.35, '#0a2a5e'],
      [0.7, '#1f8fd6'],
      [1.0, '#a8f0ff']
    ],
    posterize: 5,
    halftone: false,
    vignette: 0.75
  },
  chrome: {
    label: 'Chrome Dusk',
    stops: [
      [0, '#0b0b0f'],
      [0.35, '#4a4f57'],
      [0.7, '#c8ccd2'],
      [1.0, '#fff2d6']
    ],
    posterize: 5,
    halftone: false,
    vignette: 0.5
  },
  sunset: {
    label: 'Golden Dusk',
    stops: [
      [0, '#2a0a1e'],
      [0.35, '#c2185b'],
      [0.7, '#ff6f61'],
      [1.0, '#ffd36e']
    ],
    posterize: 5,
    halftone: true,
    vignette: 0.5
  }
};

export const LAYOUTS = ['hero', 'grid5', 'overlay', 'band'];

// Extended layouts (inserted to keep the base list intact)
LAYOUTS.push('strip', 'duo', 'popout');

// LUT cache for fast grading
const lutCache = {};

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLUT(gradeName) {
  if (lutCache[gradeName]) return lutCache[gradeName];
  const grade = GRADES[gradeName] || GRADES.heatwave;
  const stops = grade.stops;
  const lut = new Uint8Array(256 * 3);

  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Find surrounding stops
    let s0 = stops[0];
    let s1 = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        s0 = stops[s];
        s1 = stops[s + 1];
        break;
      }
    }
    const range = s1[0] - s0[0];
    const factor = range === 0 ? 0 : (t - s0[0]) / range;
    const rgb0 = hexToRgb(s0[1]);
    const rgb1 = hexToRgb(s1[1]);

    lut[i * 3] = Math.round(rgb0[0] + (rgb1[0] - rgb0[0]) * factor);
    lut[i * 3 + 1] = Math.round(rgb0[1] + (rgb1[1] - rgb0[1]) * factor);
    lut[i * 3 + 2] = Math.round(rgb0[2] + (rgb1[2] - rgb0[2]) * factor);
  }

  lutCache[gradeName] = lut;
  return lut;
}

export function applyGrade(imageData, gradeName) {
  const grade = GRADES[gradeName] || GRADES.heatwave;
  const lut = getLUT(gradeName);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const levels = grade.posterize || 5;
  const step = 255 / (levels - 1);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Luminance
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      // Gradient map LUT
      let nr = lut[lum * 3];
      let ng = lut[lum * 3 + 1];
      let nb = lut[lum * 3 + 2];

      // Posterize
      nr = Math.round(Math.round(nr / step) * step);
      ng = Math.round(Math.round(ng / step) * step);
      nb = Math.round(Math.round(nb / step) * step);

      // Halftone dot overlay
      if (grade.halftone) {
        const dotSpacing = 6;
        const gx = x % dotSpacing - dotSpacing / 2;
        const gy = y % dotSpacing - dotSpacing / 2;
        const dist = Math.sqrt(gx * gx + gy * gy);
        const darkFactor = 1 - (lum / 255);
        const radius = (dotSpacing / 2) * darkFactor * 0.9;
        if (dist < radius) {
          nr *= 0.6;
          ng *= 0.6;
          nb *= 0.6;
        }
      }

      // Vignette
      if (grade.vignette > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const vig = 1 - grade.vignette * (d * d);
        nr *= Math.max(0, vig);
        ng *= Math.max(0, vig);
        nb *= Math.max(0, vig);
      }

      data[idx] = Math.min(255, Math.max(0, nr));
      data[idx + 1] = Math.min(255, Math.max(0, ng));
      data[idx + 2] = Math.min(255, Math.max(0, nb));
    }
  }
}

export function drawStarburst(ctx, x, y, r, textStr = 'EST. 2026') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.15);

  const points = 14;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const rad = i % 2 === 0 ? r : r * 0.65;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#ffd319');
  grad.addColorStop(0.5, '#ff7a18');
  grad.addColorStop(1, '#ff2d78');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#12081f';
  ctx.stroke();

  ctx.fillStyle = '#12081f';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(textStr, 0, 0);
  ctx.restore();
}

export function drawSkyline(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#0a0414';
  ctx.fillRect(x, y, w, h);

  // Buildings
  ctx.fillStyle = '#12081f';
  let bx = x;
  const bHeights = [0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45, 0.85, 0.55, 0.75];
  let bi = 0;
  while (bx < x + w) {
    const bw = 30 + (bi * 17) % 40;
    const bh = h * (bHeights[bi % bHeights.length]);
    ctx.fillRect(bx, y + h - bh, bw - 2, bh);

    // Windows lights
    ctx.fillStyle = '#ff7a18';
    for (let wy = y + h - bh + 10; wy < y + h - 10; wy += 15) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 10) {
        if ((wx + wy) % 3 === 0) {
          ctx.fillRect(wx, wy, 3, 5);
        }
      }
    }
    ctx.fillStyle = '#12081f';
    bx += bw - 2;
    bi++;
  }

  // Palm silhouettes (2-3 palms)
  const palmXs = [x + w * 0.15, x + w * 0.75, x + w * 0.88];
  for (const px of palmXs) {
    drawPalmSilhouette(ctx, px, y + h, h * 0.9);
  }
  ctx.restore();
}

export function drawReviewStrip(ctx, W, H, reviewText) {
  const quote = reviewText === undefined || reviewText === null
    ? 'A NEON MASTERPIECE — VICE DAILY'
    : String(reviewText).trim();
  if (!quote) return;

  ctx.save();
  const maxStripW = W * 0.62;
  let fs = Math.max(8, Math.round(H * 0.014));
  const fontFor = px => `800 ${px}px 'Arial Narrow', 'Helvetica Neue', sans-serif`;
  ctx.font = fontFor(fs);
  const starW = fs * 6.4;
  let textW = ctx.measureText(quote.toUpperCase()).width + starW + fs * 3.2;
  while (textW > maxStripW && fs > 7) {
    fs -= 1;
    ctx.font = fontFor(fs);
    textW = ctx.measureText(quote.toUpperCase()).width + fs * 6.4 + fs * 3.2;
  }

  const stripH = Math.max(18, Math.round(fs * 2.2));
  const stripW = Math.min(maxStripW, textW + fs * 2);
  const stripX = (W - stripW) / 2;
  const stripY = Math.max(10, Math.round(H * 0.018));

  ctx.fillStyle = 'rgba(10, 4, 20, 0.82)';
  ctx.fillRect(stripX, stripY, stripW, stripH);
  ctx.fillStyle = '#ffd319';
  ctx.fillRect(stripX, stripY, stripW, Math.max(1, fs * 0.16));
  ctx.fillRect(stripX, stripY + stripH - Math.max(1, fs * 0.16), stripW, Math.max(1, fs * 0.16));

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = fontFor(fs);
  ctx.fillStyle = '#ffd319';
  ctx.fillText('★★★★★', stripX + fs * 0.9, stripY + stripH / 2 + fs * 0.05);

  ctx.fillStyle = '#f4f1ea';
  ctx.font = fontFor(fs);
  ctx.fillText(quote.toUpperCase(), stripX + starW + fs * 1.4, stripY + stripH / 2 + fs * 0.05);
  ctx.restore();
}

export function drawSeal(ctx, x, y, r, text) {
  const label = text === undefined || text === null
    ? 'COVER SNAP • ORIGINAL •'
    : String(text).trim();
  if (!label) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);

  const gold = ctx.createLinearGradient(0, -r, 0, r);
  gold.addColorStop(0, '#fff1a8');
  gold.addColorStop(0.45, '#ffd319');
  gold.addColorStop(0.75, '#c99212');
  gold.addColorStop(1, '#7a4d05');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12, 6, 18, 0.88)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.055);
  ctx.strokeStyle = gold;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.strokeStyle = '#ffd319';
  ctx.stroke();

  const chars = label.toUpperCase().split('');
  const ringR = r * 0.68;
  const fontSize = Math.max(6, Math.min(r * 0.2, (Math.PI * 2 * ringR) / Math.max(8, chars.length * 1.55)));
  const step = (Math.PI * 2) / Math.max(8, chars.length);
  ctx.font = `900 ${fontSize}px 'Arial Narrow', 'Helvetica Neue', sans-serif`;
  ctx.fillStyle = '#ffe66a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const angle = -Math.PI / 2 + i * step;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, -ringR);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }

  ctx.fillStyle = '#ffd319';
  ctx.font = `900 ${Math.max(7, r * 0.18)}px 'Anton', 'Arial Black', Impact, sans-serif`;
  ctx.fillText('★', 0, r * 0.02);
  ctx.restore();
}

export function drawBilling(ctx, W, H, castNames) {
  const names = Array.isArray(castNames)
    ? castNames.filter(name => name !== undefined && name !== null && String(name).trim())
    : [];
  if (!names.length) return;

  const billing = `A NMERCY PRODUCTION — STARRING ${names.map(name => String(name).trim().toUpperCase()).join(' • ')}`;
  ctx.save();
  let fs = Math.max(7, Math.round(H * 0.011));
  const maxW = W * 0.9;
  ctx.font = `700 ${fs}px 'Arial Narrow', 'Helvetica Neue', sans-serif`;
  let textW = ctx.measureText(billing).width;
  while (textW > maxW && fs > 6) {
    fs -= 1;
    ctx.font = `700 ${fs}px 'Arial Narrow', 'Helvetica Neue', sans-serif`;
    textW = ctx.measureText(billing).width;
  }

  const barH = 32;
  const y = H - barH - 15 - Math.max(12, fs * 1.8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(240, 240, 245, 0.72)';
  ctx.fillText(billing, W / 2, y);
  ctx.restore();
}

export function drawCastTags(ctx, rects, castNames) {
  const names = Array.isArray(castNames)
    ? castNames.filter(name => name !== undefined && name !== null && String(name).trim())
    : [];
  if (!names.length || !Array.isArray(rects)) return;

  const W = ctx.canvas ? ctx.canvas.width : 0;
  const H = ctx.canvas ? ctx.canvas.height : 0;

  ctx.save();
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (!rect || rect.w < 36 || rect.h < 30) continue;

    const name = String(names[i % names.length]).trim().toUpperCase();
    const fs = Math.max(7, Math.min(11, Math.round(rect.w * 0.035)));
    ctx.font = `800 ${fs}px 'Arial Narrow', 'Helvetica Neue', sans-serif`;
    const padX = fs * 0.7;
    const pillW = Math.min(rect.w - 12, ctx.measureText(name).width + padX * 2);
    const pillH = fs * 2;
    let pillX = rect.x + 6;
    const pillY = rect.y + rect.h - pillH - 6;

    // Keep the whole pill on-canvas
    if (W > 0) pillX = Math.max(8, Math.min(pillX, W - pillW - 8));

    // Skip tags that would land on the giant title band
    if (H > 0 && pillY > H * 0.38 && pillY < H * 0.72) continue;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = 'rgba(10, 4, 20, 0.82)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 211, 25, 0.7)';
    ctx.stroke();

    ctx.fillStyle = '#f4f1ea';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, pillX + padX, pillY + pillH / 2 + fs * 0.05, pillW - padX * 2);
  }
  ctx.restore();
}

export function drawChromeTitle(ctx, text, x, y, size, maxW) {
  const label = (text || '').toUpperCase();
  if (!label) return;

  let fs = Math.max(12, Math.round(size));
  const fitW = Math.max(1, maxW);
  const fontFor = px => `900 ${px}px 'Anton', 'Arial Black', Impact, sans-serif`;

  ctx.save();
  ctx.font = fontFor(fs);
  let metrics = ctx.measureText(label);
  let guard = 0;
  while (metrics.width > fitW && fs > 12 && guard < 12) {
    fs = Math.max(12, Math.floor(fs * (fitW / metrics.width)));
    ctx.font = fontFor(fs);
    metrics = ctx.measureText(label);
    guard++;
  }

  // Build the chrome glyphs on a transparent layer so the pinstripes can be
  // clipped to the letterforms themselves instead of the whole text box.
  const textW = Math.ceil(metrics.width) + 8;
  const textH = Math.ceil(fs * 1.3) + 8;
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(1, textW);
  tmp.height = Math.max(1, textH);
  const tctx = tmp.getContext('2d');
  const tx = 4;
  const ty = textH - Math.ceil(fs * 0.25);

  tctx.font = fontFor(fs);
  tctx.textAlign = 'left';
  tctx.textBaseline = 'alphabetic';
  tctx.lineJoin = 'round';

  // Dark outline behind the metallic fill.
  tctx.lineWidth = Math.max(3, fs * 0.055);
  tctx.strokeStyle = '#0a0b0e';
  tctx.strokeText(label, tx, ty);

  // Vertical chrome gradient: silver-white, mid-grey, dark steel.
  const chromeGrad = tctx.createLinearGradient(0, ty - fs, 0, ty);
  chromeGrad.addColorStop(0, '#ffffff');
  chromeGrad.addColorStop(0.18, '#f4f7fa');
  chromeGrad.addColorStop(0.45, '#9aa4ae');
  chromeGrad.addColorStop(0.58, '#5c6670');
  chromeGrad.addColorStop(0.8, '#2a3038');
  chromeGrad.addColorStop(1, '#11151a');
  tctx.fillStyle = chromeGrad;
  tctx.fillText(label, tx, ty);

  // Horizontal pinstripes clipped inside the filled letters.
  tctx.save();
  tctx.beginPath();
  tctx.rect(0, ty - fs * 1.05, textW, fs * 1.2);
  tctx.clip();
  tctx.globalCompositeOperation = 'source-atop';
  tctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  tctx.lineWidth = Math.max(1, fs * 0.012);
  for (let stripe = 0; stripe < 4; stripe++) {
    const stripeY = ty - fs * 0.82 + stripe * (fs * 0.24);
    tctx.beginPath();
    tctx.moveTo(0, stripeY);
    tctx.lineTo(textW, stripeY);
    tctx.stroke();
  }
  tctx.restore();

  // Thin hot-pink underline accent.
  tctx.save();
  tctx.strokeStyle = '#ff2d78';
  tctx.lineWidth = Math.max(2, fs * 0.035);
  tctx.beginPath();
  tctx.moveTo(tx, ty + fs * 0.16);
  tctx.lineTo(tx + metrics.width, ty + fs * 0.16);
  tctx.stroke();
  tctx.restore();

  // Composite with a soft drop shadow on the main canvas.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = Math.max(12, fs * 0.18);
  ctx.shadowOffsetX = Math.max(2, fs * 0.03);
  ctx.shadowOffsetY = Math.max(4, fs * 0.06);
  ctx.drawImage(tmp, x - tx, y - ty);
  ctx.restore();
  ctx.restore();
}

function drawPalmSilhouette(ctx, x, y, height) {
  ctx.save();
  ctx.fillStyle = '#0a0414';
  // Trunk
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.quadraticCurveTo(x + 15, y - height * 0.6, x + 5, y - height);
  ctx.lineTo(x + 10, y - height);
  ctx.quadraticCurveTo(x + 25, y - height * 0.6, x + 4, y);
  ctx.closePath();
  ctx.fill();

  // Fronds
  const topX = x + 5;
  const topY = y - height;
  for (let a = -1.2; a <= 1.2; a += 0.4) {
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * 40,
      topY + Math.sin(a) * 30 - 20,
      topX + Math.cos(a) * 70,
      topY + Math.sin(a) * 50 + 10
    );
    ctx.lineTo(topX + Math.cos(a) * 70 + 5, topY + Math.sin(a) * 50 + 15);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * 40,
      topY + Math.sin(a) * 30 - 10,
      topX,
      topY
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawPlaceholderPanel(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#ff2d78');
  grad.addColorStop(0.5, '#ff7a18');
  grad.addColorStop(1, '#1a0b2e');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Silhouette sun and palms in placeholder
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.6, w * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd319';
  ctx.fill();

  drawSkyline(ctx, x, y + h * 0.5, w, h * 0.5);
  ctx.restore();
}

function faceCropAnchor(panelIndex, totalPanels) {
  if (totalPanels > 0 && panelIndex === 0) return 0.32;
  return 0.5;
}

function getLayoutRects(layout, W, H) {
  const gap = 8;
  if (layout === 'grid5') {
    // 2 top, 3 bottom
    const topH = H * 0.46;
    const botH = H * 0.54 - gap;
    return [
      { x: 0, y: 0, w: W * 0.5 - gap / 2, h: topH },
      { x: W * 0.5 + gap / 2, y: 0, w: W * 0.5 - gap / 2, h: topH },
      { x: 0, y: topH + gap, w: W * 0.33 - gap * 0.6, h: botH },
      { x: W * 0.33 + gap * 0.4, y: topH + gap, w: W * 0.34 - gap * 0.6, h: botH },
      { x: W * 0.67 + gap * 0.8, y: topH + gap, w: W * 0.33 - gap * 0.6, h: botH }
    ];
  } else if (layout === 'overlay') {
    // 2x2 grid full bleed
    const hw = W * 0.5 - gap / 2;
    const hh = H * 0.5 - gap / 2;
    return [
      { x: 0, y: 0, w: hw, h: hh },
      { x: hw + gap, y: 0, w: hw, h: hh },
      { x: 0, y: hh + gap, w: hw, h: hh },
      { x: hw + gap, y: hh + gap, w: hw, h: hh }
    ];
  } else if (layout === 'band') {
    // Hero top ~65%, title band bottom ~35%
    const topH = H * 0.65;
    return [
      { x: 0, y: 0, w: W, h: topH },
      { x: 0, y: topH + gap, w: W * 0.33 - gap * 0.6, h: H - topH - gap },
      { x: W * 0.33 + gap * 0.4, y: topH + gap, w: W * 0.34 - gap * 0.6, h: H - topH - gap },
      { x: W * 0.67 + gap * 0.8, y: topH + gap, w: W * 0.33 - gap * 0.6, h: H - topH - gap }
    ];
  } else if (layout === 'strip') {
    // Horizontal film-strip: wide hero frame left, four tall frames across
    const heroW = W * 0.4 - gap / 2;
    const restW = W - heroW - gap;
    const colW = (restW - gap * 3) / 4;
    const s1 = heroW + gap;
    const s2 = s1 + colW + gap;
    const s3 = s2 + colW + gap;
    const s4 = s3 + colW + gap;
    return [
      { x: 0, y: 0, w: heroW, h: H },
      { x: s1, y: 0, w: colW, h: H },
      { x: s2, y: 0, w: colW, h: H },
      { x: s3, y: 0, w: colW, h: H },
      { x: s4, y: 0, w: W - s4, h: H }
    ];
  } else if (layout === 'duo') {
    // Two large side-by-side panels
    const halfW = W * 0.5 - gap / 2;
    return [
      { x: 0, y: 0, w: halfW, h: H },
      { x: halfW + gap, y: 0, w: W - halfW - gap, h: H }
    ];
  } else if (layout === 'popout') {
    // Hero overflows its frame (up and left) so the subject pops out
    const frameX = W * 0.04;
    const frameY = H * 0.1;
    const frameW = W * 0.92;
    const frameH = H * 0.72;
    const botY = frameY + frameH + gap;
    const botH = H - botY;
    const botW = (W - gap * 2) / 3;
    return [
      { x: frameX - W * 0.06, y: frameY - H * 0.12, w: frameW + W * 0.06, h: frameH + H * 0.12 },
      { x: 0, y: botY, w: botW, h: botH },
      { x: botW + gap, y: botY, w: botW, h: botH },
      { x: (botW + gap) * 2, y: botY, w: W - (botW + gap) * 2, h: botH }
    ];
  } else {
    // Default 'hero': Big left hero, right 3 panels, bottom 4 small panels
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
}

export function drawCover(ctx, W, H, state) {
  // Background
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const photos = state.photos || [];
  const panelsState = state.panels || [];
  const layout = state.layout || 'hero';
  const gradeName = state.grade || 'heatwave';

  const rects = getLayoutRects(layout, W, H);

  // Offscreen canvas for panel grading
  const offCanvas = document.createElement('canvas');
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const pState = panelsState[i] || { photo: i % Math.max(1, photos.length), ox: 0.5, oy: 0.5, zoom: 1 };
    const photoIdx = pState.photo !== undefined ? pState.photo : (i % Math.max(1, photos.length));
    const photo = photos[photoIdx];

    if (!photo || !photo.complete || photo.naturalWidth === 0) {
      drawPlaceholderPanel(ctx, rect.x, rect.y, rect.w, rect.h);
      continue;
    }

    // Cover-fit crop with ox, oy, zoom
    offCanvas.width = Math.max(1, Math.round(rect.w));
    offCanvas.height = Math.max(1, Math.round(rect.h));

    const imgW = photo.naturalWidth || photo.width;
    const imgH = photo.naturalHeight || photo.height;

    const scale = Math.max(rect.w / imgW, rect.h / imgH) * (pState.zoom || 1);
    const sw = rect.w / scale;
    const sh = rect.h / scale;

    const ox = pState.ox !== undefined ? pState.ox : 0.5;
    const oy = pState.oy !== undefined ? pState.oy : 0.5;
    const oyDefault = faceCropAnchor(i, rects.length);
    const oyUse = (pState.oy === undefined) ? oyDefault : oy;

    const sx = Math.max(0, Math.min(imgW - sw, ox * imgW - sw / 2));
    const sy = Math.max(0, Math.min(imgH - sh, oyUse * imgH - sh / 2));

    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.drawImage(photo, sx, sy, sw, sh, 0, 0, offCanvas.width, offCanvas.height);

    const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    applyGrade(imgData, gradeName);
    offCtx.putImageData(imgData, 0, 0);

    ctx.drawImage(offCanvas, rect.x, rect.y);
    if (layout === 'popout' && i === 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(offCanvas, rect.x - rect.w * 0.03, rect.y - rect.h * 0.06, rect.w * 1.06, rect.h * 1.12);
      ctx.restore();
    }
  }

  // Overlays & Typography (Title, Subtitle, Tagline, Badge, Stars, Skyline)
  ctx.save();

  // Badge top right or top left
  drawStarburst(ctx, W - 70, 70, 45, state.badge || 'EST. 2026');

  // Star Rating
  const starsCount = state.stars !== undefined ? state.stars : 5;
  if (starsCount > 0) {
    ctx.save();
    ctx.font = '18px sans-serif';
    ctx.textBaseline = 'top';
    let starStr = '';
    for (let s = 0; s < 5; s++) {
      starStr += s < starsCount ? '★' : '☆';
    }
    ctx.fillStyle = '#ffd319';
    ctx.shadowColor = '#ff7a18';
    ctx.shadowBlur = 8;
    ctx.fillText(starStr, 50, 40);
    ctx.restore();
  }

  // Giant Title
  const titleText = (state.title || 'SUNSET HEIST').toUpperCase();
  let fontSize = Math.round(H * 0.28);
  ctx.font = `900 ${fontSize}px 'Anton', 'Arial Black', Impact, sans-serif`;

  // Auto-fit title width
  let metrics = ctx.measureText(titleText);
  const maxTitleW = W * 0.9;
  if (metrics.width > maxTitleW) {
    fontSize = Math.round(fontSize * (maxTitleW / metrics.width));
    ctx.font = `900 ${fontSize}px 'Anton', 'Arial Black', Impact, sans-serif`;
  }

  const titleX = W * 0.05;
  const titleY = H * 0.62;

  // Drop shadow & outline for title
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  ctx.lineWidth = Math.max(4, fontSize * 0.06);
  ctx.strokeStyle = '#12081f';
  ctx.strokeText(titleText, titleX, titleY);

  const titleGrad = ctx.createLinearGradient(0, titleY - fontSize, 0, titleY);
  titleGrad.addColorStop(0, '#ff2d78');
  titleGrad.addColorStop(0.5, '#ff7a18');
  titleGrad.addColorStop(1, '#ffd319');
  ctx.fillStyle = titleGrad;
  ctx.fillText(titleText, titleX, titleY);
  ctx.restore();

  drawChromeTitle(ctx, titleText, titleX, titleY, fontSize, maxTitleW);

  // Subtitle in Yellowtail script with neon glow
  const subtitleText = state.subtitle || 'Coastline Nights';
  const subFontSize = Math.round(fontSize * 0.45);
  ctx.font = `400 ${subFontSize}px 'Yellowtail', cursive, sans-serif`;
  
  ctx.save();
  ctx.shadowColor = '#ff2d78';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#00f0ff';
  ctx.fillText(subtitleText, titleX + 10, titleY + subFontSize * 0.9);
  ctx.restore();

  // Tagline Bar
  const taglineText = (state.tagline || 'ONE LAST SCORE — SUMMER 2026').toUpperCase();
  const barH = 32;
  const barY = H - barH - 15;
  ctx.fillStyle = 'rgba(18, 8, 31, 0.85)';
  ctx.fillRect(0, barY, W, barH);

  ctx.fillStyle = '#ff7a18';
  ctx.fillRect(0, barY, W, 3);

  ctx.font = '700 13px sans-serif';
  ctx.fillStyle = '#f0f0f5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '3px';
  ctx.fillText(taglineText, W / 2, barY + barH / 2);

  drawReviewStrip(ctx, W, H, state.review);
  drawSeal(ctx, W - 90, H * 0.30, 46, state.sealText || 'COVER SNAP');
  drawBilling(ctx, W, H, state.cast || []);
  drawCastTags(ctx, rects, state.cast || []);

  ctx.restore();
}
