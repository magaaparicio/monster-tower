/* ---------- monsters ---------- */
// Datos generados por tools/build_assets.py a partir de los PNG de ChatGPT:
// contorno trazado desde la transparencia, en metros, con origen en el centro visual.
// Rostros y expresiones: ver FACES y drawFace.
// Rostros medidos por tools/measure_faces.py en las referencias de ChatGPT (metros, y hacia arriba).
const FACES = FACE_DATA;
function makeType(d) {
  const base = d.outline, cen = Geo.centroid(base);
  const inset = base.map(p => ({ x: cen.x + (p.x - cen.x) * CFG.insetScale, y: cen.y + (p.y - cen.y) * CFG.insetScale }));
  return {
    id: d.id, label: d.label, src: d.body, spriteWM: d.spriteWM, spriteHM: d.spriteHM,
    outline: base, face: FACES[d.id] || null,
    colliders: { fit: Geo.decompose(base), inset: Geo.decompose(inset) },
    reach: Math.max(...base.map(p => Math.hypot(p.x, p.y))),   // radio máximo al girar
    image: null, sprite: null,
  };
}
const Monsters = {
  types: MONSTER_DATA.map(makeType),
  bag: [], loaded: false,
  byId(id) { return this.types.find(t => t.id === id); },
  load() {
    return Promise.all(this.types.map(t => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => { t.image = i; res(); }; i.onerror = rej; i.src = t.src;
    }))).then(() => { this.loaded = true; });
  },
  next() {
    if (state.nextId !== 'random') return this.byId(state.nextId);
    if (!this.bag.length) this.bag = this.types.slice().sort(() => Math.random() - 0.5);
    return this.bag.pop();
  },
};
const polysOf = type => type.colliders[state.colliderMode];
