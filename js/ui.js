/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const panel = $('panel');
let fpsMin = 60, fpsWin = 0;
function fpsTrack(dt) {
  fpsWin += dt;
  if (fpsWin > 5) { fpsWin = 0; fpsMin = fps; }
  if (fpsN === 0 && fps < fpsMin) fpsMin = fps;
}
function setStatus() {
  $('scoreN').textContent = game.placed;
  $('scoreSub').textContent = `${towerHeight().toFixed(1)} m · Récord ${game.best.pieces}`;
  $('swapN').textContent = game.swaps;
  $('btnSwap').disabled = !piece || game.swaps <= 0;
}
function updateDropButton() {
  const held = !!piece, over = game.phase === 'over';
  $('dropLabel').textContent = held ? 'Soltar' : over ? 'Otra vez' : 'Espera';
  $('btnDrop').setAttribute('aria-label', $('dropLabel').textContent);
  $('btnDrop').disabled = !held && !over;
  $('btnDrop').style.opacity = held || over ? 1 : 0.5;
  $('btnRotL').disabled = $('btnRotR').disabled = !held;
  $('btnRotL').style.opacity = $('btnRotR').style.opacity = held ? 1 : 0.4;
}
function updateMetrics() {
  const soft = t => `<span style="color:var(--ink-soft)">${t}</span>`;
  let awake = 0; for (const s of game.stack) if (s.body.isAwake()) awake++;
  const parts = [
    `<b>FPS:</b> ${fps.toFixed(0)} · mínimo en 5 s: ${fpsMin.toFixed(0)}`,
    `<b>Monstruos en la torre:</b> ${game.stack.length} · en movimiento: ${awake}`,
    `<b>Altura:</b> ${towerHeight().toFixed(1)} m · cámara ${camera.y.toFixed(1)} m`,
    `<b>Colisionador:</b> ${state.colliderMode === 'fit' ? 'ajustado' : 'reducido'}`,
  ];
  if (state.auto) parts.push(`<b>Caídas en prueba de carga:</b> ${game.fallenAuto}`);
  if (game.settleTimes.length) parts.push(`<b>Últimos tiempos hasta reposo:</b> ${game.settleTimes.map(t => t == null ? 'no se aquietó' : t.toFixed(2) + ' s').join(' · ')} ${soft('(meta &lt; 2 s)')}`);
  $('metrics').innerHTML = parts.join('<br>');
}
function refreshUI() { setStatus(); updateDropButton(); updateMetrics(); }
function showGameOver() {
  $('goPieces').textContent = game.placed;
  $('goHeight').textContent = `${towerHeight().toFixed(1)} m`;
  $('goBest').textContent = game.best.pieces;
  $('goRecord').hidden = !game.newRecord;
  Sound.play(game.newRecord ? 'nuevo_record' : 'derrota', { vol: 0.8 });
  $('gameover').hidden = false;
  $('btnAgain').focus();
}
// vista previa de la siguiente pieza
function drawNext() {
  const c = $('nextCanvas'), x = c.getContext('2d'), t = game.next;
  x.clearRect(0, 0, c.width, c.height);
  if (!t || !t.image) return;
  const k = Math.min(c.width / t.image.width, c.height / t.image.height) * 0.92;
  const w = t.image.width * k, h = t.image.height * k;
  x.drawImage(t.image, (c.width - w) / 2, (c.height - h) / 2, w, h);
}

function bindSeg(id, key, after) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state[key] = b.dataset.v;
    for (const x of $(id).querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    after && after();
  });
}
function bindRange(id, outId, key, fmt, after) {
  const el = $(id), out = $(outId);
  const sync = () => { out.textContent = fmt(CFG[key]); };
  el.value = CFG[key]; sync();
  el.addEventListener('input', () => { CFG[key] = parseFloat(el.value); sync(); after && after(); });
  return () => { el.value = CFG[key]; sync(); };
}

function setupUI() {
  bindHold($('btnRotL'), 1);    // antihorario
  bindHold($('btnRotR'), -1);   // horario
  $('btnDrop').addEventListener('pointerdown', e => { e.preventDefault(); $('btnDrop').classList.add('pressed'); });
  $('btnDrop').addEventListener('pointerup', () => $('btnDrop').classList.remove('pressed'));
  $('btnDrop').addEventListener('pointercancel', () => $('btnDrop').classList.remove('pressed'));
  $('btnDrop').addEventListener('click', dropAction);
  for (const im of document.querySelectorAll('img[data-ui]')) im.src = UI_IMG[im.dataset.ui];
  applyCover();

  // el primer toque o tecla activa el audio
  const unlock = () => Sound.unlock();
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  syncSoundIcons();
  $('pmSound').addEventListener('click', () => Sound.toggle());
  for (const id of ['btnPlay', 'btnHowtoOk', 'pmRestart', 'pmHowto', 'pmSettings', 'pmHome', 'btnAgain', 'btnGoHome'])
    $(id).addEventListener('click', () => Sound.play('boton_pop', { vol: 0.7 }));
  $('btnPlay').addEventListener('click', play);
  $('btnHowtoOk').addEventListener('click', closeHowto);
  $('btnPause').addEventListener('click', () => setPause(true));
  $('pmResume').addEventListener('click', () => setPause(false));
  $('pmRestart').addEventListener('click', () => { showScreen(null); resetGame(); });
  $('pmHowto').addEventListener('click', () => { howtoNext = 'pause'; showScreen('howto'); });
  $('pmSettings').addEventListener('click', () => { panel.hidden = false; updateMetrics(); });
  $('pmHome').addEventListener('click', goHome);
  $('btnGoHome').addEventListener('click', goHome);
  $('btnAgain').addEventListener('click', resetGame);
  $('btnSwap').addEventListener('click', swapPiece);
  $('chkAuto').addEventListener('change', e => { state.auto = e.target.checked; refreshUI(); });
  $('btnClose').addEventListener('click', () => { panel.hidden = true; });
  bindSeg('segCollider', 'colliderMode', () => { resetGame(); updateMetrics(); });
  bindSeg('segLight', 'lightMode');
  const sel = $('selNext');
  for (const t of Monsters.types) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; sel.appendChild(o); }
  sel.addEventListener('change', () => {
    state.nextId = sel.value;
    Monsters.bag = [];
    if (piece) { piece.type = Monsters.next(); game.next = Monsters.next(); drawNext(); refreshUI(); }   // aplica también a la pieza que cuelga
  });
  $('chkDebug').addEventListener('change', e => { state.debug = e.target.checked; });
  const syncs = [
    bindRange('rngStep', 'outStep', 'tapStepDeg', v => `${v}°`),
    bindRange('rngSpin', 'outSpin', 'spinDegPerSec', v => `${v}°/s`),
    bindRange('rngGrav', 'outGrav', 'gravity', v => `${v} m/s²`, applyMaterial),
    bindRange('rngBounce', 'outBounce', 'restitution', v => v.toFixed(2), applyMaterial),
    bindRange('rngFric', 'outFric', 'friction', v => v.toFixed(2), applyMaterial),
    bindRange('rngAbsorb', 'outAbsorb', 'absorb', v => v.toFixed(2)),
  ];
  $('btnDefaults').addEventListener('click', () => { Object.assign(CFG, DEFAULTS); syncs.forEach(f => f()); applyMaterial(); });

  // arrastre horizontal 1:1 sobre la escena
  canvas.addEventListener('pointerdown', e => {
    if (!piece || piece.phase !== 'held') return;
    input.dragging = true; input.dragX0 = e.clientX; input.pieceX0 = piece.x;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!input.dragging || !piece || piece.phase !== 'held') return;
    const r = canvas.getBoundingClientRect();
    piece.x = input.pieceX0 + (e.clientX - input.dragX0) / r.width * CFG.viewWidth;
  });
  const endDrag = () => { input.dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // teclado
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, button')) { if (e.key === ' ' || e.key === 'Enter') return; }
    if (e.repeat) { if (['ArrowLeft', 'ArrowRight', ' ', 'ArrowDown'].includes(e.key)) e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if ((game.paused || game.phase === 'menu') && k !== 'p' && k !== 'escape') return;
    if (k === 'arrowleft' || k === 'a') { input.left = true; e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { input.right = true; e.preventDefault(); }
    else if (k === 'z' || k === 'q') rotateStart(1);
    else if (k === 'x' || k === 'e') rotateStart(-1);
    else if (k === ' ' || k === 'arrowdown') { e.preventDefault(); dropAction(); }
    else if (k === 'r' && game.phase !== 'menu') resetGame();
    else if (k === 'c') swapPiece();
    else if (k === 'p' || k === 'escape') { if (!$('pause').hidden) setPause(false); else setPause(true); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') input.left = false;
    else if (k === 'arrowright' || k === 'd') input.right = false;
    else if (k === 'z' || k === 'q') rotateEnd(1);
    else if (k === 'x' || k === 'e') rotateEnd(-1);
  });
  window.addEventListener('blur', () => { input.left = input.right = false; input.rot = 0; });
  // si el jugador cambia de app o bloquea el teléfono, la partida se pausa sola
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !game.paused && (game.phase === 'held' || game.phase === 'settling')) setPause(true);
    HomeFx.toggle(!document.hidden && !$('home').hidden);
  });
  // el panel de pruebas solo aparece si la dirección termina en #pruebas
  $('pmSettings').hidden = location.hash !== '#pruebas';

  new ResizeObserver(() => { if (Monsters.loaded && bgArt) resize(); }).observe(canvas);
}
