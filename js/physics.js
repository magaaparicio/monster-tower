/* ---------- physics (Planck.js) ---------- */
let pl, world, piece = null;   // piece = monstruo que el jugador sostiene (o null)
function makeWorld() {
  world = new pl.World({ gravity: pl.Vec2(0, -CFG.gravity) });
  const ground = world.createBody();
  const hh = 0.5;
  ground.createFixture(new pl.Box(CFG.platformHalfW, hh, pl.Vec2(CFG.viewWidth / 2, CFG.platformTop - hh), 0), { friction: CFG.friction, restitution: CFG.restitution });
  // al primer contacto de una pieza, la pila absorbe el impacto (ver stepSim)
  world.on('begin-contact', contact => {
    for (const b of [contact.getFixtureA().getBody(), contact.getFixtureB().getBody()]) {
      const s = b.getUserData();
      if (s && !s.landed) { s.landed = true; s.justLanded = true; s.ex.impactUntil = simTime + 0.45;
        const v = b.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
        Sound.play('aterrizar_plop', { vol: Math.min(1, 0.35 + sp / 12), rate: 0.9 + Math.random() * 0.2 }); for (const o of game.stack) o.absorbUntil = simTime + 0.35; }
    }
  });
}
function createPieceBody(type, x, y, angle) {
  const body = world.createBody({ type: 'dynamic', position: pl.Vec2(x, y), angle, bullet: true, linearDamping: 0.05, angularDamping: 0.4 });
  for (const P of polysOf(type)) {
    body.createFixture(new pl.Polygon(P.map(p => pl.Vec2(p.x, p.y))), { density: 1, friction: CFG.friction, restitution: CFG.restitution });
  }
  return body;
}
function applyMaterial() {
  if (!world) return;
  world.setGravity(pl.Vec2(0, -CFG.gravity));
  for (let b = world.getBodyList(); b; b = b.getNext()) {
    for (let f = b.getFixtureList(); f; f = f.getNext()) { f.setFriction(CFG.friction); f.setRestitution(CFG.restitution); }
    b.setAwake(true);
  }
}
