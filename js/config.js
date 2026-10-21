/* ---------- config ---------- */
const DEFAULTS = {
  gravity: 22,          // m/s²; más alto que el real para una caída ágil
  restitution: 0,       // sin rebote: goma blanda, no pelota
  absorb: 0.7,          // absorción del impacto al aterrizar (0 = nada, 1 = máxima)
  friction: 0.8,
  tapStepDeg: 5,        // toque breve
  spinDegPerSec: 120,   // velocidad máxima al mantener
};
const CFG = Object.assign({}, DEFAULTS, {
  viewWidth: 10,        // metros visibles a lo ancho
  platformTop: 1.5,     // metros desde el borde inferior
  platformHalfW: 3.6,   // caben dos monstruos lado a lado
  moveSpeed: 6,         // m/s con teclado
  holdDelay: 0.22,      // s antes de empezar el giro continuo
  spinRamp: 0.6,        // s para llegar a la velocidad máxima
  insetScale: 0.93,
  rollResist: 3.5,      // amortiguación de giro al estar apoyado
  restSpeed: 0.08, restSpin: 0.08, restTime: 0.5,
  maxDpr: 2,
});
const state = {
  colliderMode: 'fit',   // 'fit' | 'inset'
  lightMode: 'world',    // 'world' | 'none'
  nextId: 'random',      // monstruo forzado para pruebas, o 'random'
  auto: false,           // prueba de carga
  debug: false,
};
