/* ---------- geometría (independiente del motor) ---------- */
const Geo = {
  area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; },
  centroid(p) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; const f = q.x * r.y - r.x * q.y; a += f; cx += (q.x + r.x) * f; cy += (q.y + r.y) * f; }
    a /= 2; return { x: cx / (6 * a), y: cy / (6 * a) };
  },
  cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); },
  inTri(p, a, b, c) { return Geo.cross(a, b, p) > 1e-12 && Geo.cross(b, c, p) > 1e-12 && Geo.cross(c, a, p) > 1e-12; },
  isConvex(pts) {
    for (let i = 0; i < pts.length; i++) if (Geo.cross(pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]) < -1e-9) return false;
    return true;
  },
  // Triangulación por orejas + fusión Hertel-Mehlhorn → polígonos convexos de hasta maxV vértices.
  decompose(pts, maxV = 8) {
    if (Geo.area(pts) < 0) pts = pts.slice().reverse();
    const n = pts.length, idx = [...Array(n).keys()], tris = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 5000) {
      let found = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i - 1 + idx.length) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if (Geo.cross(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (const j of idx) { if (j === ia || j === ib || j === ic) continue; if (Geo.inTri(pts[j], a, b, c)) { ok = false; break; } }
        if (!ok) continue;
        tris.push([ia, ib, ic]); idx.splice(i, 1); found = true; break;
      }
      if (!found) break;
    }
    if (idx.length === 3) tris.push(idx.slice());
    let polys = tris, merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
        const I = polys[i], J = polys[j];
        for (let k = 0; k < I.length; k++) {
          const a = I[k], b = I[(k + 1) % I.length], m = J.indexOf(b);
          if (m < 0 || J[(m + 1) % J.length] !== a) continue;
          const out = [];
          for (let t = 0; t < I.length; t++) out.push(I[(k + 1 + t) % I.length]);
          for (let t = 2; t < J.length; t++) out.push(J[(m + t) % J.length]);
          if (out.length <= maxV && Geo.isConvex(out.map(q => pts[q]))) {
            polys[i] = out; polys.splice(j, 1); merged = true; break outer;
          }
        }
      }
    }
    return polys.map(P => P.map(q => pts[q])).filter(P => Math.abs(Geo.area(P)) > 0.004);
  },
  massCenter(polys) {
    let A = 0, x = 0, y = 0;
    for (const P of polys) { const a = Math.abs(Geo.area(P)), c = Geo.centroid(P); A += a; x += c.x * a; y += c.y * a; }
    return { x: x / A, y: y / A };
  },
};
