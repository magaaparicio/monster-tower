/* ---------- render ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { w: 0, h: 0, s: 1, dpr: 1, S: 1, bottomPx: 0, topM: 0 }; // S = px de dispositivo por metro
let bgCanvas, tmp, tctx;

function resize() {
  const r = canvas.getBoundingClientRect();
  view.dpr = Math.min(window.devicePixelRatio || 1, CFG.maxDpr);
  // en pantallas grandes se limita a ~2.6 millones de píxeles para cuidar el rendimiento
  const px = r.width * r.height * view.dpr * view.dpr;
  if (px > 2.6e6) view.dpr *= Math.sqrt(2.6e6 / px);
  canvas.width = Math.round(r.width * view.dpr);
  canvas.height = Math.round(r.height * view.dpr);
  view.S = canvas.width / CFG.viewWidth;
  view.w = CFG.viewWidth;
  // el mundo empieza encima de la franja de controles, para que nunca tapen la plataforma
  view.bottomPx = (document.querySelector('.controls').offsetHeight + 14) * view.dpr;
  view.h = (canvas.height - view.bottomPx) / view.S;
  view.topM = (document.querySelector('.hud').offsetHeight + 10) * view.dpr / view.S;
  buildBackground();
  buildSprite();
}
const X = x => x * view.S;
const camera = { y: 0 };   // metros: altura del borde inferior del área de juego
const Y = y => canvas.height - view.bottomPx - (y - camera.y) * view.S;
const Y0 = y => canvas.height - view.bottomPx - y * view.S;   // escenario fijo, sin cámara

// Sprite del cuerpo a la escala actual de pantalla. La imagen es el recurso de ChatGPT (sin rostro).
function buildSprite() {
  const S = view.S; let T = 0;
  for (const t of Monsters.types) {
    const sw = Math.ceil(t.spriteWM * S), sh = Math.ceil(t.spriteHM * S);
    t.sprite = document.createElement('canvas'); t.sprite.width = sw; t.sprite.height = sh;
    const c = t.sprite.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(t.image, 0, 0, sw, sh);
    // sombra ambiental: silueta desenfocada, preparada una sola vez por tamaño de pantalla
    const pad = Math.ceil(0.3 * S), far = sw + pad * 2 + 20;
    t.shade = document.createElement('canvas'); t.shade.width = sw + pad * 2; t.shade.height = sh + pad * 2;
    const sc = t.shade.getContext('2d');
    sc.shadowColor = 'rgba(28, 30, 84, 0.32)'; sc.shadowBlur = 0.18 * S; sc.shadowOffsetX = far;
    sc.drawImage(t.sprite, pad - far, pad);
    T = Math.max(T, Math.ceil(Math.hypot(sw, sh)) + 4);
  }
  // lienzo temporal para iluminar cada cuadro
  tmp = document.createElement('canvas'); tmp.width = T; tmp.height = T;
  tctx = tmp.getContext('2d');
}

// Escenario: degradado vertical + nubes y bloques pastel desenfocados (provisional).
// Escenario por capas: cielo (cambia con la altura), nubes y estrellas (paralaje),
// y la escena del suelo (bloques pastel, suelo, plataforma) anclada al mundo.
let starTile, artCanvas, bgArt, skyTop = '#1f2fa8';
function buildBackground() {
  const W = canvas.width, H = canvas.height, S = view.S, k = 10;
  bgCanvas = document.createElement('canvas'); bgCanvas.width = W; bgCanvas.height = H;
  const c = bgCanvas.getContext('2d');
  const ls = S / k;
  drawPlatform(c);

  const th = H;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // fondo aprobado, escalado una vez para cubrir el ancho (y el alto en pantallas anchas)
  const k2 = Math.max(W / bgArt.width, H / bgArt.height);
  artCanvas = document.createElement('canvas'); artCanvas.width = Math.ceil(bgArt.width * k2); artCanvas.height = Math.ceil(bgArt.height * k2);
  const ac = artCanvas.getContext('2d'); ac.imageSmoothingEnabled = true; ac.imageSmoothingQuality = 'high';
  ac.drawImage(bgArt, 0, 0, artCanvas.width, artCanvas.height);
  // estrellas
  starTile = document.createElement('canvas'); starTile.width = W; starTile.height = th;
  const st = starTile.getContext('2d'); st.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) { const r = (0.5 + rnd() * 1.3) * view.dpr; st.globalAlpha = 0.5 + rnd() * 0.5; st.beginPath(); st.arc(rnd() * W, rnd() * th, r, 0, Math.PI * 2); st.fill(); }
}

// colores del cielo según la altura (m): día → tarde → atardecer → noche
const SKY = [
  [0, '#7fbdf2', '#cfe8fb'],
  [25, '#6aa2ea', '#c7d3f7'],
  [50, '#7c6fd2', '#eab8d6'],
  [80, '#2f3170', '#6e5ca8'],
];
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
function skyAt(h) {
  if (h <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) if (h < SKY[i][0]) {
    const [h0, t0, b0] = SKY[i - 1], [h1, t1, b1] = SKY[i], t = (h - h0) / (h1 - h0);
    return [mixHex(t0, t1, t), mixHex(b0, b1, t)];
  }
  const L = SKY[SKY.length - 1]; return [L[1], L[2]];
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function drawTile(tile, parallax, alpha) {
  if (alpha <= 0.01) return;
  const H = tile.height, off = ((camera.y * view.S * parallax) % H + H) % H;
  ctx.globalAlpha = alpha;
  ctx.drawImage(tile, 0, off - H); ctx.drawImage(tile, 0, off);
  ctx.globalAlpha = 1;
}
function drawBackground() {
  const W = canvas.width, H = canvas.height, S = view.S;
  // cielo sobre el fondo: el mismo azul de su parte superior, con estrellas
  ctx.fillStyle = skyTop; ctx.fillRect(0, 0, W, H);
  drawTile(starTile, 0.15, 0.9);
  // fondo aprobado con paralaje: baja más lento que la torre
  const ay = H - artCanvas.height + camera.y * S * 0.4;
  if (ay < H) {
    ctx.drawImage(artCanvas, (W - artCanvas.width) / 2, ay);
    const fade = 0.12 * H, g = ctx.createLinearGradient(0, ay, 0, ay + fade);
    g.addColorStop(0, skyTop); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, ay - 1, W, fade + 1);
  }
  const dy = camera.y * S;
  if (dy < H) ctx.drawImage(bgCanvas, 0, dy);
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function drawPlatform(c) {
  const cx = X(CFG.viewWidth / 2), top = Y0(CFG.platformTop), rx = CFG.platformHalfW * view.S, ry = 0.38 * view.S, depth = 0.75 * view.S;
  // sombra en el suelo
  c.fillStyle = 'rgba(90,70,120,0.18)';
  c.beginPath(); c.ellipse(cx, top + depth + ry * 0.3, rx * 1.08, ry * 1.1, 0, 0, Math.PI * 2); c.fill();
  // cara frontal
  const side = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
  side.addColorStop(0, '#8f8cc4'); side.addColorStop(0.45, '#aaa7da'); side.addColorStop(1, '#8481b8');
  c.fillStyle = side;
  c.beginPath(); c.moveTo(cx - rx, top); c.lineTo(cx - rx, top + depth); c.ellipse(cx, top + depth, rx, ry, 0, Math.PI, 0, true); c.lineTo(cx + rx, top); c.closePath(); c.fill();
  // tapa
  const lid = c.createLinearGradient(0, top - ry, 0, top + ry);
  lid.addColorStop(0, '#d2d0f2'); lid.addColorStop(1, '#bcb9e6');
  c.fillStyle = lid; c.beginPath(); c.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.04 * view.S; c.stroke();
}

function lerpT(s, alpha) {
  const p = s.prev, q = s.cur;
  return { x: p.x + (q.x - p.x) * alpha, y: p.y + (q.y - p.y) * alpha, a: p.a + (q.a - p.a) * alpha };
}

// sombra de contacto: vive en el escenario, no gira con el monstruo
function drawShadow(t, type) {
  const S = view.S, aabb = worldAABB(t, type), hAbove = aabb.minY - CFG.platformTop;
  if (Math.abs(t.x - CFG.viewWidth / 2) > CFG.platformHalfW + 0.3 || hAbove < -0.5) return;
  const k = Math.max(0, 1 - hAbove / 7);
  if (!k) return;
  ctx.fillStyle = `rgba(70,55,120,${0.30 * k})`;
  ctx.beginPath();
  ctx.ellipse(X(t.x), Y(CFG.platformTop), (aabb.maxX - aabb.minX) * 0.45 * S * (0.6 + 0.4 * k), 0.16 * S * (0.6 + 0.4 * k), 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(t, held, type, mood) {
  const S = view.S, T = tmp.width, a = t.a;
  const cx = X(t.x) + (mood ? mood.tremble * S : 0), cy = Y(t.y);
  // cuerda (solo visual) hasta el centro visual, por detrás del cuerpo
  if (held) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(2, 0.05 * S);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy); ctx.stroke();
  }
  const aabb = worldAABB(t, type), sprite = type.sprite;
  // sombra ambiental detrás del monstruo: separa la silueta de nubes y cielos claros
  if (type.shade) {
    ctx.save(); ctx.translate(cx, cy + 0.07 * S); ctx.rotate(-a);
    ctx.drawImage(type.shade, -type.shade.width / 2, -type.shade.height / 2);
    ctx.restore();
  }
  const c = tctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, T, T);
  c.translate(T / 2, T / 2); c.rotate(-a);
  const br = mood ? mood.breath : 0;   // respiración: solo visual, máximo ±1.2 %
  c.scale(1 - br * 0.5, 1 + br);
  c.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  // luz programada: siempre desde arriba en el mundo, recortada a la silueta
  if (state.lightMode === 'world') {
    c.globalCompositeOperation = 'source-atop';
    c.setTransform(1, 0, 0, 1, 0, 0);
    const b = { x: T / 2 + (aabb.minX - t.x) * S, y: T / 2 - (aabb.maxY - t.y) * S, w: (aabb.maxX - aabb.minX) * S, h: (aabb.maxY - aabb.minY) * S };
    paintLight(c, b.x, b.y, b.w, b.h);
  }
  // rostro (estático hasta la etapa 4)
  c.globalCompositeOperation = 'source-over';
  c.setTransform(1, 0, 0, 1, 0, 0); c.translate(T / 2, T / 2); c.rotate(-a); c.scale(1 - br * 0.5, 1 + br);
  if (type.face) drawFace(c, S, type.face, mood);
  ctx.drawImage(tmp, cx - T / 2, cy - T / 2);
}
