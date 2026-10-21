/* ---------- sonido ---------- */
// Web Audio: se activa con el primer toque del jugador (los navegadores no permiten sonar antes).
const Sound = {
  ctx: null, buf: {}, last: {}, on: true,
  init() { try { this.on = localStorage.getItem('mt-sound') !== '0'; } catch (e) {} },
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    for (const [k, url] of Object.entries(SFX_DATA)) {
      // con file:// los navegadores bloquean fetch: el juego funciona, pero sin sonido (ver README)
      fetch(url).then(r => r.arrayBuffer()).then(a => this.ctx.decodeAudioData(a, b => { this.buf[k] = b; }, () => {})).catch(() => {});
    }
  },
  // vol: 0–1 · rate: tono · gap: segundos mínimos entre repeticiones del mismo sonido
  play(name, { vol = 1, rate = 1, gap = 0 } = {}) {
    if (!this.on || !this.ctx || !this.buf[name]) return;
    const now = this.ctx.currentTime;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = this.buf[name]; src.playbackRate.value = rate; g.gain.value = vol * 0.8;
    src.connect(g).connect(this.ctx.destination); src.start();
  },
  toggle() {
    this.on = !this.on; try { localStorage.setItem('mt-sound', this.on ? '1' : '0'); } catch (e) {}
    syncSoundIcons(); if (this.on) this.play('boton_pop');
  },
};
Sound.init();
function syncSoundIcons() {
  for (const im of document.querySelectorAll('img[data-sound]')) im.src = UI_IMG[Sound.on ? 'sonido-on' : 'sonido-off'];
  for (const b of document.querySelectorAll('[data-sound-btn]')) b.setAttribute('aria-label', Sound.on ? 'Silenciar sonido' : 'Activar sonido');
}
