/* ---------- game state ---------- */
// ETAPA 3: partida infinita. Se pierde cuando un monstruo cae por debajo de la plataforma.
// fases: held (sosteniendo) → settling (acomodándose) → held … → over
const SETTLE_TIMEOUT = 3, MAX_SWAPS = 3, FALL_Y = CFG.platformTop - 1.2;
const game = { paused: false, phase: 'menu', stack: [], placed: 0, swaps: MAX_SWAPS, settleClock: 0, releasedAt: 0, settleTimes: [], next: null, overAt: 0, best: { pieces: 0, height: 0 }, newRecord: false, towerTop: CFG.platformTop, autoAt: 0, fallenAuto: 0 };
try { const b = JSON.parse(localStorage.getItem('mt-best') || 'null'); if (b && typeof b.pieces === 'number') game.best = b; } catch (e) {}

function clearGame() {
  for (const s of game.stack) world.destroyBody(s.body);
  Object.assign(game, { phase: 'menu', stack: [], placed: 0, swaps: MAX_SWAPS, settleTimes: [], next: null, newRecord: false, towerTop: CFG.platformTop, fallenAuto: 0 });
  piece = null; camera.y = 0; Monsters.bag = []; game.paused = false;
  $('gameover').hidden = true; $('pause').hidden = true;
}
function showScreen(id) { for (const k of ['home', 'howto', 'pause']) $(k).hidden = k !== id; HomeFx.toggle(id === 'home'); }

// partículas de la portada: esferas suaves que flotan hacia arriba y destellos que titilan
const coverMode = 'viva';   // portada elegida: torre animada con las piezas del juego
function applyCover() { $('homeArt').style.backgroundImage = `url(${UI_IMG['fondo-inicio']})`; }
// torre de la portada animada: piezas reales del juego, de abajo hacia arriba (id, ángulo en grados, desplazamiento x en m)
const COVER_TOWER = [['verde', 0, 0], ['azul-nube', 4, -0.12], ['rosa', -5, 0.1], ['amarillo', 10, -0.08], ['morado', -6, 0.12], ['naranja', -10, 0]];
const HomeFx = {
  raf: 0, parts: [], last: 0, tower: null,
  toggle(on) {
    // con movimiento reducido se dibuja un solo cuadro fijo (la torre se ve, pero no se mueve)
    if (on && matchMedia('(prefers-reduced-motion: reduce)').matches) { this.setup(); this.tick(0); cancelAnimationFrame(this.raf); this.raf = 0; return; }
    if (on && !this.raf) { this.setup(); this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); }
    if (!on && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  },
  setup() {
    const c = $('homeFx'), r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); this.d = d;
    if (this.parts.length) return;
    const cols = ['#FFC928', '#F75A9B', '#83C9FA', '#9656E8', '#ffffff'];
    for (let i = 0; i < 16; i++) this.parts.push({ orb: true, x: Math.random(), y: Math.random(), r: 3 + Math.random() * 6, v: 0.012 + Math.random() * 0.02, ph: Math.random() * 6.28, col: cols[i % cols.length] });
    for (let i = 0; i < 12; i++) this.parts.push({ orb: false, x: Math.random(), y: Math.random() * 0.45, r: 1.5 + Math.random() * 1.5, ph: Math.random() * 6.28, sp: 1.5 + Math.random() * 2 });
  },
  buildTower() {
    // apila cada pieza sobre el contorno real de las de abajo, con un ligero encaje (como en la ilustración)
    const N = 90, X0 = -2.2, DX = 4.4 / N, top = new Array(N).fill(0);
    const profile = (type, a, dx) => {
      const cs = Math.cos(a), sn = Math.sin(a), pts = type.outline.map(p => ({ x: p.x * cs - p.y * sn + dx, y: p.x * sn + p.y * cs }));
      const lo = new Array(N).fill(Infinity), hi = new Array(N).fill(-Infinity);
      for (let i = 0; i < N; i++) {
        const xs = X0 + (i + 0.5) * DX;
        for (let j = 0; j < pts.length; j++) {
          const p = pts[j], q = pts[(j + 1) % pts.length];
          if ((p.x <= xs) !== (q.x <= xs)) { const y = p.y + (xs - p.x) / (q.x - p.x) * (q.y - p.y); lo[i] = Math.min(lo[i], y); hi[i] = Math.max(hi[i], y); }
        }
      }
      return { lo, hi };
    };
    const list = []; let height = 0;
    for (const [id, deg, dx] of COVER_TOWER) {
      const type = Monsters.byId(id); if (!type) continue;
      const a = deg * Math.PI / 180, pr = profile(type, a, dx);
      let cy = -Infinity;
      for (let i = 0; i < N; i++) if (pr.lo[i] < Infinity) cy = Math.max(cy, top[i] - pr.lo[i]);
      if (list.length) cy -= 0.32; else cy = -Math.min(...pr.lo.filter(v => v < Infinity));
      for (let i = 0; i < N; i++) if (pr.hi[i] > -Infinity) { top[i] = Math.max(top[i], cy + pr.hi[i]); height = Math.max(height, top[i]); }
      list.push({ type, a, dx: 0, ox: dx, cy, ex: { nextBlink: 1 + Math.random() * 3, blinkEnd: 0, ph: Math.random() * 6.28 } });
    }
    this.tower = { list, height };
  },
  drawTower(x, W, H, time) {
    if (!this.tower) this.buildTower();
    const T = this.tower, S = Math.min((0.56 * H) / T.height, (0.9 * W) / 2.8), baseY = H * 0.78, cx = W / 2;
    // balanceo: más amplio arriba; de vez en cuando un tambaleo más fuerte
    const bump = Math.exp(-Math.pow(((time % 9) - 6.5) / 0.7, 2));
    const amp = 0.22 + 0.45 * bump, wob = Math.sin(time * 1.9) * amp + Math.sin(time * 3.1 + 1) * 0.05;
    const nervous = bump > 0.35;
    // sombra en el suelo
    x.fillStyle = 'rgba(70,40,110,0.25)'; x.beginPath(); x.ellipse(cx, baseY + 0.05 * S, 1.5 * S, 0.22 * S, 0, 0, Math.PI * 2); x.fill();
    for (const p of T.list) {
      const k = p.cy / T.height, off = wob * k * k, slope = wob * 2 * k / T.height;
      const px = cx + (p.ox + off) * S, py = baseY - p.cy * S, a = p.a - Math.atan(slope) * 0.9;
      const e = p.ex;
      if (time > e.nextBlink) { e.blinkEnd = time + 0.13; e.nextBlink = time + 2 + Math.random() * 3.5; }
      const look = nervous ? { x: Math.sin(time * 6 + e.ph) > 0 ? 1 : -1, y: 0.1 } : { x: Math.sin(time * 0.5 + e.ph) * 0.8, y: -0.25 };
      const mood = { state: nervous ? 'nervous' : 'neutral', look, blink: time < e.blinkEnd, breath: nervous ? 0 : 0.012 * Math.sin(time * 2.2 + e.ph) };
      const img = p.type.image, ws = p.type.spriteWM * S, hs = p.type.spriteHM * S, br = mood.breath;
      x.save();
      x.translate(px + (nervous ? Math.sin(time * 50 + e.ph) * 0.012 * S : 0), py);
      x.rotate(-a); x.scale(1 - br * 0.5, 1 + br);
      x.shadowColor = 'rgba(28,30,84,0.35)'; x.shadowBlur = 0.16 * S; x.shadowOffsetY = 0.06 * S;
      x.drawImage(img, -ws / 2, -hs / 2, ws, hs);
      x.shadowColor = 'transparent';
      if (p.type.face) drawFace(x, S, p.type.face, mood);
      x.restore();
    }
  },
  tick(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const c = $('homeFx'), x = c.getContext('2d'), W = c.width, H = c.height, d = this.d, time = t / 1000;
    x.clearRect(0, 0, W, H);
    if (coverMode === 'viva') this.drawTower(x, W, H, time);
    for (const p of this.parts) {
      if (p.orb) {
        p.y -= p.v * dt; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const px = (p.x + Math.sin(time * 0.6 + p.ph) * 0.015) * W, py = p.y * H, r = p.r * d;
        const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.col); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.globalAlpha = 0.75; x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
      } else {
        x.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(time * p.sp + p.ph));
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(p.x * W, p.y * H, p.r * d, 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;
    this.raf = requestAnimationFrame(tt => this.tick(tt));
  },
};
function goHome() { clearGame(); $('homeBest').textContent = game.best.pieces; showScreen('home'); refreshUI(); }
function play() {
  let seen = false; try { seen = localStorage.getItem('mt-howto') === '1'; } catch (e) {}
  if (!seen) { howtoNext = 'start'; showScreen('howto'); $('btnHowtoOk').focus(); return; }
  showScreen(null); resetGame();
}
let howtoNext = 'start';
function closeHowto() {
  try { localStorage.setItem('mt-howto', '1'); } catch (e) {}
  if (howtoNext === 'start') { showScreen(null); resetGame(); }
  else if (howtoNext === 'pause') showScreen('pause');
  else showScreen('home');
}
function setPause(on) {
  if (game.phase === 'menu' || game.phase === 'over') return;
  game.paused = on; showScreen(on ? 'pause' : null);
  Sound.play(on ? 'pausa' : 'reanudar', { vol: 0.7 });
  if (on) $('pmResume').focus();
}
function resetGame() {
  for (const s of game.stack) world.destroyBody(s.body);
  Object.assign(game, { stack: [], placed: 0, swaps: MAX_SWAPS, settleTimes: [], next: null, newRecord: false, towerTop: CFG.platformTop, fallenAuto: 0 });
  camera.y = 0; Monsters.bag = [];
  $('gameover').hidden = true; $('pause').hidden = true; game.paused = false;
  spawn();
}
function newExpr() { return { nextBlink: simTime + 1 + Math.random() * 3, blinkEnd: 0, impactUntil: 0, nervousUntil: 0, phase: Math.random() * 6.28 }; }
function spawn() {
  piece = { phase: 'held', x: CFG.viewWidth / 2, angle: 0, type: game.next || Monsters.next(), ex: newExpr() };
  game.next = Monsters.next();
  game.phase = 'held'; game.autoAt = simTime + 0.35;
  drawNext(); refreshUI();
}
function swapPiece() {
  if (!piece || game.swaps <= 0) return;
  game.swaps--;
  Sound.play('cambiar_pieza', { vol: 0.8 });
  piece.type = game.next;
  game.next = Monsters.next();
  drawNext(); refreshUI();
}
function release() {
  if (!piece) return;
  const y = heldY(), t = { x: piece.x, y, a: piece.angle };
  const entry = { ex: piece.ex, type: piece.type, body: createPieceBody(piece.type, piece.x, y, piece.angle), prev: t, cur: { ...t }, landed: false, absorbUntil: 0 };
  entry.body.setUserData(entry);
  game.stack.push(entry);
  piece = null;
  game.phase = 'settling'; game.settleClock = 0; game.releasedAt = simTime;
  Sound.play('soltar_silbido', { vol: 0.6 });
  refreshUI();
}
function towerHeight() { return Math.max(0, game.towerTop - CFG.platformTop); }
function gameOver() {
  piece = null;
  game.phase = 'over'; game.overAt = simTime;
  Sound.play('derrumbe_gomoso', { vol: 0.85 });
  const h = towerHeight();
  game.newRecord = game.placed > game.best.pieces;
  if (game.newRecord) { game.best = { pieces: game.placed, height: h }; try { localStorage.setItem('mt-best', JSON.stringify(game.best)); } catch (e) {} }
  refreshUI();
}
// el monstruo cuelga debajo de las etiquetas superiores, con margen para girar sin taparse
function heldY() { return camera.y + view.h - view.topM - piece.type.reach - 0.1; }
