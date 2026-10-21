/* ---------- arranque ----------
   Planck se carga desde lib/planck.min.js (en index.html). Si faltara, se intenta desde una CDN. */
const PLANCK_URLS = [
  'https://cdn.jsdelivr.net/npm/planck@1.5.0/dist/planck.min.js',
  'https://unpkg.com/planck@1.5.0/dist/planck.min.js',
];
function loadPlanck(i = 0) {
  return new Promise((res, rej) => {
    if (i >= PLANCK_URLS.length) return rej(new Error('sin motor'));
    const s = document.createElement('script');
    s.src = PLANCK_URLS[i];
    s.onload = () => window.planck ? res(window.planck) : loadPlanck(i + 1).then(res, rej);
    s.onerror = () => loadPlanck(i + 1).then(res, rej);
    document.head.appendChild(s);
  });
}

setupUI();
function loadArt() {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => {
      bgArt = i;
      // color del borde superior del fondo, para continuar el cielo sin corte
      try {
        const c = document.createElement('canvas'); c.width = 16; c.height = 1;
        const x = c.getContext('2d'); x.drawImage(i, 0, 0, i.width, Math.max(1, i.height * 0.02), 0, 0, 16, 1);
        const d = x.getImageData(0, 0, 16, 1).data; let r = 0, g = 0, b = 0;
        for (let k = 0; k < 64; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
        skyTop = `rgb(${r / 16 | 0},${g / 16 | 0},${b / 16 | 0})`;
      } catch (e) { /* con file:// no se puede leer la imagen; se usa el color por defecto */ }
      res();
    };
    i.onerror = rej; i.src = UI_IMG['fondo-inicio'];
  });
}
let booted = false;
function boot() {
  $('overlayText').textContent = 'Cargando…'; $('btnRetry').hidden = true; $('overlay').hidden = false;
  const physics = window.planck ? Promise.resolve(window.planck) : loadPlanck().catch(() => { throw new Error('motor'); });
  Promise.all([physics, Monsters.loaded ? null : Monsters.load(), bgArt ? null : loadArt()]).then(([lib]) => {
    pl = lib;
    resize();
    if (!world) makeWorld();
    goHome();
    $('overlay').hidden = true;
    if (!booted) { booted = true; requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); }); }
  }).catch(err => {
    console.error(err);
    $('overlayText').textContent = err && err.message === 'motor'
      ? 'No se pudo descargar el motor de física. Revisa tu conexión a internet.'
      : 'Algo falló al iniciar el juego.';
    $('btnRetry').hidden = false;
  });
}
$('btnRetry').addEventListener('click', boot);
boot();
