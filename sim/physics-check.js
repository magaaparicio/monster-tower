// Prueba de física sin navegador: usa el mismo motor (lib/planck.min.js), las mismas siluetas
// y los mismos parámetros del juego. Sirve para ajustar valores con números en vez de a ojo.
//   node tools/sim/physics-check.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const pl = require(path.join(ROOT, 'lib/planck.min.js'));
const load = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
new Function(load('js/geometry.js') + '\nglobalThis.Geo = Geo;')();
new Function(load('js/data/monsters-data.js') + '\nglobalThis.MONSTER_DATA = MONSTER_DATA;')();

// mismos valores que js/config.js
const CFG = { gravity: 22, friction: 0.8, absorb: 0.7, rollResist: 3.5, platformTop: 1.5, platformHalfW: 3.6, restSpeed: 0.08, restSpin: 0.08, restTime: 0.5, dropGap: 3.2 };
const types = {};
for (const d of MONSTER_DATA) types[d.id] = { id: d.id, outline: d.outline, polys: Geo.decompose(d.outline), reach: Math.max(...d.outline.map(p => Math.hypot(p.x, p.y))) };
const topOf = (b, t) => { const a = b.getAngle(), c = Math.cos(a), s = Math.sin(a), p = b.getPosition(); return Math.max(...t.outline.map(q => p.y + q.x * s + q.y * c)); };

// suelta n piezas una tras otra (como el jugador) y mide reposo, caídas y quietud final
function run({ seq, n, angle = () => 0, xoff = () => 0, maxT = 8 }) {
  const world = new pl.World({ gravity: pl.Vec2(0, -CFG.gravity) });
  world.createBody().createFixture(new pl.Box(CFG.platformHalfW, 0.5, pl.Vec2(5, CFG.platformTop - 0.5), 0), { friction: CFG.friction });
  const stack = []; let sim = 0, fell = 0; const settle = [], stepMs = [];
  world.on('begin-contact', c => {
    for (const b of [c.getFixtureA().getBody(), c.getFixtureB().getBody()]) {
      const s = b.getUserData();
      if (s && !s.landed) { s.landed = s.just = true; for (const o of stack) o.absUntil = sim + 0.35; }
    }
  });
  for (let i = 0; i < n; i++) {
    const t = types[seq(i)];
    const top = Math.max(CFG.platformTop, ...stack.filter(s => s.landed).map(s => topOf(s.b, s.t)));
    const b = world.createBody({ type: 'dynamic', position: pl.Vec2(5 + xoff(i), top + CFG.dropGap + t.reach), angle: angle(i), bullet: true, linearDamping: 0.05, angularDamping: 0.4 });
    for (const P of t.polys) b.createFixture(new pl.Polygon(P.map(p => pl.Vec2(p.x, p.y))), { density: 1, friction: CFG.friction });
    const s = { b, t, landed: false, absUntil: 0 }; b.setUserData(s); stack.push(s);
    const t0 = sim; let clock = 0, done = null;
    while (sim - t0 < maxT) {
      const st = process.hrtime.bigint(); world.step(1 / 60, 10, 4); stepMs.push(Number(process.hrtime.bigint() - st) / 1e6); sim += 1 / 60;
      let rest = true;
      for (let k = stack.length - 1; k >= 0; k--) {
        const o = stack[k], ob = o.b;
        if (o.just) { o.just = false; const v = ob.getLinearVelocity(), f = 1 - 0.6 * CFG.absorb; ob.setLinearVelocity(pl.Vec2(v.x * f, v.y * f)); ob.setAngularVelocity(ob.getAngularVelocity() * f); }
        const on = o.absUntil > sim;
        ob.setLinearDamping(on ? 6 * CFG.absorb : 0.05);
        ob.setAngularDamping(on ? 8 * CFG.absorb : (o.landed ? CFG.rollResist : 0.4));
        if (ob.getPosition().y < CFG.platformTop - 1.2) { world.destroyBody(ob); stack.splice(k, 1); fell++; continue; }
        const v = ob.getLinearVelocity();
        if (ob.isAwake() && (Math.hypot(v.x, v.y) > CFG.restSpeed || Math.abs(ob.getAngularVelocity()) > CFG.restSpin)) rest = false;
      }
      clock = rest ? clock + 1 / 60 : 0;
      if (clock >= CFG.restTime) { done = sim - t0 - CFG.restTime; break; }
    }
    settle.push(done);
  }
  const ref = stack.map(s => ({ x: s.b.getPosition().x, y: s.b.getPosition().y, a: s.b.getAngle() })); let drift = 0;
  for (let k = 0; k < 300; k++) { world.step(1 / 60, 10, 4); stack.forEach((s, i) => { const p = s.b.getPosition(); drift = Math.max(drift, Math.hypot(p.x - ref[i].x, p.y - ref[i].y) + Math.abs(s.b.getAngle() - ref[i].a) * s.t.reach); }); }
  stepMs.sort((a, b) => a - b);
  return { settle, fell, remaining: stack.length, drift, stepMedian: stepMs[stepMs.length >> 1] };
}

const ids = Object.keys(types);
console.log('1) Cada monstruo solo, plano, al centro: tiempo hasta quedar quieto');
for (const id of ids) { const r = run({ seq: () => id, n: 1 }); console.log('   ' + id.padEnd(14), r.settle[0] == null ? 'no se aquietó' : r.settle[0].toFixed(2) + ' s'); }

console.log('2) Pares: ¿se puede poner cada monstruo sobre cada otro en algún ángulo? (12 ángulos)');
let ok = 0, tot = 0; const impossible = [];
for (const lo of ids) for (const up of ids) {
  let good = 0;
  for (let k = 0; k < 12; k++) if (!run({ seq: i => [lo, up][i], n: 2, angle: i => (i ? k * Math.PI / 6 : 0), maxT: 6 }).fell) good++;
  ok += good; tot += 12; if (!good) impossible.push(up + ' sobre ' + lo);
}
console.log(`   ángulos que funcionan: ${(100 * ok / tot).toFixed(0)}% · combinaciones imposibles: ${impossible.join(', ') || 'ninguna'}`);

console.log('3) Torre de 3 bien colocada: ¿tiembla en reposo?');
const r3 = run({ seq: () => 'azul-nube', n: 3 });
console.log(`   movimiento en 5 s de reposo: ${(r3.drift * 100).toFixed(2)} cm (meta < 1 cm) · cayeron ${r3.fell}`);
