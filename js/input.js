/* ---------- input ---------- */
const input = { left: false, right: false, rot: 0, rotHeld: 0, dragging: false, dragX0: 0, pieceX0: 0 };
function rotateStart(dir) {
  if (!piece || piece.phase !== 'held') return;
  input.rot = dir; input.rotHeld = 0;
  piece.angle += dir * CFG.tapStepDeg * Math.PI / 180;   // ajuste inmediato del toque breve
  Sound.play('girar_boing', { vol: 0.4, rate: dir > 0 ? 1.04 : 0.96, gap: 0.15 });
}
function rotateEnd(dir) { if (input.rot === dir) { input.rot = 0; input.rotHeld = 0; } }

function bindHold(btn, dir) {
  const down = e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('pressed'); rotateStart(dir); };
  const up = () => { btn.classList.remove('pressed'); rotateEnd(dir); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); btn.classList.add('pressed'); rotateStart(dir); } });
  btn.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') up(); });
}

function dropAction() {
  if (piece) release();
  else if (game.phase === 'over') resetGame();
}
