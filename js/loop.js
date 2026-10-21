/* ---------- loop con paso fijo ---------- */
const STEP = 1 / 60;
let simTime = 0, acc = 0, last = 0, fps = 60, fpsAcc = 0, fpsN = 0;

function stepSim(dt) {
  if (piece) {
    // giro continuo al mantener, con rampa suave
    if (input.rot) {
      input.rotHeld += dt;
      if (input.rotHeld > CFG.holdDelay) {
        const ramp = Math.min(1, (input.rotHeld - CFG.holdDelay) / CFG.spinRamp);
        const speed = CFG.spinDegPerSec * (0.3 + 0.7 * ramp * ramp);
        piece.angle += input.rot * speed * dt * Math.PI / 180;
      }
    }
    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (kx) piece.x += kx * CFG.moveSpeed * dt;
    piece.x = Math.max(1, Math.min(CFG.viewWidth - 1, piece.x));
    // prueba de carga: suelta sola la pieza sobre el centro de la torre
    if (state.auto && simTime > game.autoAt) { piece.x = CFG.viewWidth / 2 + (Math.random() - 0.5) * 0.6; piece.angle = 0; release(); }
  }
  world.step(dt, 10, 4);
  simTime += dt;

  // absorción del impacto: frena la energía justo después de aterrizar y luego vuelve a la física normal
  for (const s of game.stack) {
    const b = s.body, k = CFG.absorb;
    if (s.justLanded) {
      s.justLanded = false;
      const v = b.getLinearVelocity();
      b.setLinearVelocity(pl.Vec2(v.x * (1 - 0.6 * k), v.y * (1 - 0.6 * k)));
      b.setAngularVelocity(b.getAngularVelocity() * (1 - 0.6 * k));
    }
    const on = s.absorbUntil > simTime && k > 0;
    b.setLinearDamping(on ? 6 * k : 0.05);
    // resistencia al rodar: una goma blanda apoyada no rueda como una rueda (medido en tools/sim)
    b.setAngularDamping(on ? 8 * k : (s.landed ? CFG.rollResist : 0.4));
  }

  let allRest = true, top = CFG.platformTop, shaking = false;
  for (let i = game.stack.length - 1; i >= 0; i--) {
    const s = game.stack[i], b = s.body, p = b.getPosition();
    s.prev = s.cur; s.cur = { x: p.x, y: p.y, a: b.getAngle() };
    if (s.cur.y < FALL_Y) {
      if (state.auto || game.phase === 'over') {
        // en prueba de carga o tras perder, retirar la pieza cuando sale de la escena
        if (s.cur.y < camera.y - 6) { world.destroyBody(b); game.stack.splice(i, 1); if (state.auto) game.fallenAuto++; }
        continue;
      }
      gameOver();
      continue;
    }
    const v = b.getLinearVelocity();
    if (b.isAwake() && (Math.hypot(v.x, v.y) > CFG.restSpeed || Math.abs(b.getAngularVelocity()) > CFG.restSpin)) allRest = false;
    if (s.landed) top = Math.max(top, worldAABB(s.cur, s.type).maxY);
    s.shake = 0;
    if (s.landed && simTime > s.absorbUntil + 0.2 && b.isAwake()) {
      const m = Math.hypot(v.x, v.y) + Math.abs(b.getAngularVelocity()) * s.type.reach;
      if (m > 0.35) { s.shake = m; shaking = true; }
    }
  }
  if (game.phase !== 'over') game.towerTop = top;
  if (shaking && game.phase !== 'over') {
    Sound.play('alerta_inestable', { vol: 0.55, gap: 3 });
    for (const s of game.stack) if (s.landed) s.ex.nervousUntil = simTime + 1.0;
  }

  if (game.phase === 'settling') {
    const elapsed = simTime - game.releasedAt;
    game.settleClock = allRest ? game.settleClock + dt : 0;
    const settled = game.settleClock >= CFG.restTime, timedOut = elapsed > SETTLE_TIMEOUT;
    if (settled || timedOut) {
      game.settleTimes.push(settled ? elapsed - CFG.restTime : null);   // null = no llegó a reposo (posible temblor)
      if (game.settleTimes.length > 6) game.settleTimes.shift();
      game.placed = game.stack.length;
      spawn();
    }
  }
}

// la cámara sube para dejar siempre espacio de caída sobre la torre; nunca baja durante la partida
function updateCamera(dt) {
  const reach = piece ? piece.type.reach : 1.7, gap = 3.2;
  const target = Math.max(0, game.towerTop + gap + reach * 2 + 0.1 + view.topM - view.h);
  if (target > camera.y) camera.y += (target - camera.y) * Math.min(1, dt * 3.5);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (!panel.hidden) updateMetrics(); }
  acc += dt;
  let n = 0;
  if (game.paused) acc = 0;
  while (acc >= STEP && n++ < 4) { stepSim(STEP); acc -= STEP; }
  if (!game.paused) updateCamera(dt);
  fpsTrack(dt);
  if (game.phase === 'over' && $('gameover').hidden && simTime - game.overAt > 1.2) showGameOver();
  if (n >= 4) acc = 0;   // si el equipo no alcanza, el juego se ralentiza en vez de congelarse
  render(acc / STEP);
  requestAnimationFrame(frame);
}
