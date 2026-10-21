/* ---------- expresiones ---------- */
// Estados: neutral, parpadeo, mirar (a la pieza nueva o hacia abajo), cayendo (ojos abiertos),
// impacto (ojos apretados), nervioso (boca ondulada, mirada a los lados, temblor) y pánico (al derrumbarse).
function moodOf(it, focus) {
  const ex = it.ex, now = simTime;
  if (now > ex.nextBlink) { ex.blinkEnd = now + 0.13; ex.nextBlink = now + 2 + Math.random() * 3.5; }
  let state = 'neutral';
  if (game.phase === 'over') state = 'panic';
  else if (!it.held && it.s && !it.s.landed) state = 'falling';
  else if (now < ex.impactUntil) state = 'impact';
  else if (now < ex.nervousUntil) state = 'nervous';
  // dirección de la mirada en el mundo
  let dx = 0, dy = -1;
  if (state === 'nervous') { dx = Math.sin(now * 4 + ex.phase) > 0 ? 1 : -1; dy = 0.1; }
  else if (state === 'panic') { dx = Math.sin(now * 9 + ex.phase) * 0.6; dy = 0.4; }
  else if (it.held) { dx = CFG.viewWidth / 2 - it.t.x; dy = game.towerTop - it.t.y; }
  else if (focus && state !== 'falling') { dx = focus.x - it.t.x; dy = focus.y - it.t.y; }
  else if (state === 'neutral') { dx = Math.sin(now * 0.6 + ex.phase) * 0.7; dy = -0.6; }
  const len = Math.hypot(dx, dy) || 1, cs = Math.cos(it.t.a), sn = Math.sin(it.t.a);
  const look = { x: (dx * cs + dy * sn) / len, y: (-dx * sn + dy * cs) / len };   // al marco del monstruo
  const blink = now < ex.blinkEnd && (state === 'neutral' || state === 'nervous');
  const calm = state === 'neutral' && (it.held || (it.s && it.s.landed));
  return {
    state, look, blink,
    breath: calm ? 0.012 * Math.sin(now * 2.2 + ex.phase) : 0,
    tremble: state === 'nervous' || state === 'panic' ? Math.sin(now * 55 + ex.phase) * (state === 'panic' ? 0.02 : 0.012) : 0,
    shake: it.s ? it.s.shake || 0 : 0,
  };
}

const INK = '#16151f';
function drawFace(c, S, f, mood) {
  const st = mood ? mood.state : 'neutral', look = mood ? mood.look : { x: 0, y: 0 };
  const mx = f.eyes.reduce((a, e) => a + e.x, 0) / f.eyes.length;
  const mouthInk = f.mouthColor || INK;
  for (const e of f.eyes) {
    const ex = e.x * S, ey = -e.y * S, rx = e.rx * S, ry = e.ry * S;
    const closed = mood && (mood.blink || st === 'impact');
    if (closed) {
      c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, rx * 0.26);
      c.beginPath();
      if (st === 'impact') {
        // ojos apretados: > <  (un solo ojo: los dos signos juntos)
        const w = rx * (f.eyes.length === 1 ? 0.38 : 0.6), h = ry * 0.55;
        const sides = f.eyes.length === 1 ? [[-1, ex - rx * 0.45], [1, ex + rx * 0.45]] : [[e.x < mx ? -1 : 1, ex]];
        for (const [side, x] of sides) {
          const tip = side < 0 ? x + w / 2 : x - w / 2, back = side < 0 ? x - w / 2 : x + w / 2;
          c.moveTo(back, ey - h); c.lineTo(tip, ey); c.lineTo(back, ey + h);
        }
      } else {
        c.arc(ex, ey + ry * 0.25, rx * 0.72, Math.PI * 1.1, Math.PI * 1.9);   // parpadeo: arco ∩
      }
      c.stroke();
      continue;
    }
    const wide = st === 'falling' || st === 'panic' ? 1.12 : 1;
    const g = c.createRadialGradient(ex - rx * 0.2, ey - ry * 0.3, 0, ex, ey, rx * 1.05 * wide);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f4f5f7'); g.addColorStop(1, '#cfd5dc');
    c.fillStyle = g; c.beginPath(); c.ellipse(ex, ey, rx * wide, ry * wide, 0, 0, Math.PI * 2); c.fill();
    const pr = e.pupil.r * S * (st === 'panic' ? 0.78 : st === 'falling' ? 0.88 : 1);
    const room = Math.max(0, Math.min(rx, ry) * wide - pr) * 0.8;
    // pupila: mezcla de su posición natural con la mirada
    let px = ex + e.pupil.dx * S * 0.35 + look.x * room, py = ey - e.pupil.dy * S * 0.35 - look.y * room;
    c.fillStyle = INK; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px + pr * 0.32, py - pr * 0.38, pr * 0.3, 0, Math.PI * 2); c.fill();
  }
  if (f.nose) {
    const nx = f.nose.x * S, ny = -f.nose.y * S, nr = f.nose.r * S;
    c.fillStyle = INK; c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(nx + nr * 0.3, ny - nr * 0.35, nr * 0.3, 0, Math.PI * 2); c.fill();
  }
  const m = f.mouth;
  if (!m) return;   // sin boca en su diseño (rosa): solo expresa con los ojos
  const ox = m.x * S, oy = -m.y * S, rx = m.rx * S, ry = m.ry * S;
  c.fillStyle = mouthInk; c.strokeStyle = mouthInk; c.lineCap = 'round'; c.lineJoin = 'round';
  if (st === 'nervous') {
    // boca ondulada
    const w = Math.max(rx * 3.2, 0.22 * S), amp = Math.max(ry * 0.35, 0.025 * S), n = 4;
    c.lineWidth = Math.max(1.5, 0.035 * S);
    c.beginPath();
    for (let i = 0; i <= n * 8; i++) { const u = i / (n * 8), x = ox - w / 2 + u * w, y = oy + Math.sin(u * n * Math.PI * 2) * amp; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  } else if (st === 'panic') {
    const prx = Math.max(rx * 2.1, 0.1 * S), pry = Math.max(ry * 2.3, 0.12 * S);
    const g = c.createRadialGradient(ox, oy + pry * 0.4, 0, ox, oy, pry);
    g.addColorStop(0, 'rgba(60,20,30,1)'); g.addColorStop(1, mouthInk);
    c.fillStyle = g; c.beginPath(); c.ellipse(ox, oy + pry * 0.3, prx, pry, 0, 0, Math.PI * 2); c.fill();
  } else if (m.type === 'smile' && st !== 'falling') {
    c.lineWidth = Math.max(1.5, ry * 0.7);
    c.beginPath(); c.arc(ox, oy - ry * 0.6, rx * 0.9, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  } else {
    const k = st === 'falling' ? 1.35 : st === 'impact' ? 0.85 : 1;
    c.beginPath(); c.ellipse(ox, oy, rx * k, ry * k, 0, 0, Math.PI * 2); c.fill();
  }
}

// líneas de movimiento: solo en las dos piezas que más se tambalean, para no saturar
function drawMotionLines(items) {
  if (game.phase === 'over') return;
  const shaky = items.filter(it => it.mood && it.mood.state === 'nervous' && it.mood.shake > 0).sort((a, b) => b.mood.shake - a.mood.shake).slice(0, 2);
  if (!shaky.length || Math.floor(simTime * 6) % 3 === 2) return;   // parpadean levemente
  const S = view.S;
  ctx.strokeStyle = 'rgba(45,51,84,0.6)'; ctx.lineWidth = Math.max(2, 0.05 * S); ctx.lineCap = 'round';
  for (const it of shaky) {
    const b = worldAABB(it.t, it.type), cy = Y((b.minY + b.maxY) / 2), h = (b.maxY - b.minY) * 0.22 * S;
    for (const [x, dir] of [[X(b.minX - 0.25), -1], [X(b.maxX + 0.25), 1]]) {
      for (const k of [0, 1]) {
        const xx = x + dir * k * 0.18 * S, r = h * (1 - k * 0.3);
        ctx.beginPath();
        if (dir < 0) ctx.arc(xx + r, cy, r, Math.PI * 0.75, Math.PI * 1.25);   // "(" a la izquierda
        else ctx.arc(xx - r, cy, r, -Math.PI * 0.25, Math.PI * 0.25);          // ")" a la derecha
        ctx.stroke();
      }
    }
  }
}

function paintLight(c, x, y, w, h) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,232,0.20)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,45,70,0.26)');
  c.fillStyle = g; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  const r = Math.min(w, h) * 0.42, hx = x + w * 0.33, hy = y + h * 0.22;
  const sp = c.createRadialGradient(hx, hy, 0, hx, hy, r);
  sp.addColorStop(0, 'rgba(255,255,255,0.22)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sp; c.fillRect(hx - r, hy - r, r * 2, r * 2);
}

function worldAABB(t, type) {
  const cs = Math.cos(t.a), sn = Math.sin(t.a);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of type.outline) {
    const x = t.x + p.x * cs - p.y * sn, y = t.y + p.x * sn + p.y * cs;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function drawDebug(t, type) {
  const cs = Math.cos(t.a), sn = Math.sin(t.a), S = view.S;
  const W = p => ({ x: X(t.x + p.x * cs - p.y * sn), y: Y(t.y + p.x * sn + p.y * cs) });
  ctx.lineWidth = 2; ctx.strokeStyle = '#00d4ff'; ctx.fillStyle = 'rgba(0,212,255,0.12)';
  for (const P of polysOf(type)) {
    ctx.beginPath(); P.forEach((p, i) => { const q = W(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const vc = W({ x: 0, y: 0 });
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(vc.x - 10, vc.y); ctx.lineTo(vc.x + 10, vc.y); ctx.moveTo(vc.x, vc.y - 10); ctx.lineTo(vc.x, vc.y + 10); ctx.stroke();
  const mc = W(Geo.massCenter(polysOf(type)));
  ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.arc(mc.x, mc.y, 6, 0, Math.PI * 2); ctx.fill();
  // línea de apoyo de la plataforma
  ctx.strokeStyle = 'rgba(0,212,255,0.7)'; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(X(CFG.viewWidth / 2 - CFG.platformHalfW), Y(CFG.platformTop)); ctx.lineTo(X(CFG.viewWidth / 2 + CFG.platformHalfW), Y(CFG.platformTop)); ctx.stroke();
  ctx.setLineDash([]);
}

function render(alpha) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground();
  const items = game.stack.map(s => ({ t: lerpT(s, alpha), type: s.type, held: false, ex: s.ex, s }));
  if (piece) items.push({ t: { x: piece.x, y: heldY(), a: piece.angle }, type: piece.type, held: true, ex: piece.ex });
  // a quién miran: la pieza que cuelga o la que está cayendo
  const falling = game.stack.find(s => !s.landed);
  const focus = piece ? { x: piece.x, y: heldY() } : falling ? falling.cur : null;
  for (const it of items) it.mood = moodOf(it, focus);
  for (const it of items) drawShadow(it.t, it.type);
  for (const it of items) drawBody(it.t, it.held, it.type, it.mood);
  drawMotionLines(items);
  if (state.debug) for (const it of items) drawDebug(it.t, it.type);
}
