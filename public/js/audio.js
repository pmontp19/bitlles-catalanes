// Efectes de so sintetitzats amb WebAudio (sense fitxers).
let ac = null, master = null, noiseBuf = null;
export let muted = false;
try { muted = localStorage.getItem('bitlles_mute') === '1'; } catch (e) {}

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('bitlles_mute', muted ? '1' : '0'); } catch (e) {}
  if (master) master.gain.value = muted ? 0 : 0.7;
  return muted;
}

function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function noise(t, dur, freq, q, peak, type = 'bandpass') {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.002, dur, peak);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  return { s, f, g };
}
function tone(t, freq, dur, peak, type = 'sine', slide) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ac.createGain(); env(g, t, 0.003, dur, peak);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

const ok = () => ac && !muted;

export const sfx = {
  clack(intensity = 1) { // fusta contra fusta
    if (!ok()) return; const t = ac.currentTime;
    const f = 900 + Math.random() * 700;
    noise(t, 0.05, f * 1.6, 6, 0.5 * intensity);
    tone(t, f, 0.07, 0.25 * intensity, 'triangle', f * 0.7);
  },
  thud() { // bitlla que cau a terra
    if (!ok()) return; const t = ac.currentTime;
    noise(t, 0.12, 300 + Math.random() * 120, 2, 0.5, 'lowpass');
    tone(t, 140 + Math.random() * 40, 0.12, 0.3, 'sine', 70);
  },
  land() {
    if (!ok()) return; const t = ac.currentTime;
    noise(t, 0.14, 500, 1, 0.35, 'lowpass');
  },
  whoosh() {
    if (!ok()) return; const t = ac.currentTime;
    const n = noise(t, 0.35, 600, 1.5, 0.2);
    n.f.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
  },
  stamp() {
    if (!ok()) return; const t = ac.currentTime;
    tone(t, 90, 0.18, 0.7, 'sine', 45);
    noise(t, 0.08, 1200, 1, 0.5, 'lowpass');
  },
  paper() {
    if (!ok()) return; const t = ac.currentTime;
    const n = noise(t, 0.22, 3000, 0.8, 0.18, 'highpass');
    n.f.frequency.exponentialRampToValueAtTime(5000, t + 0.2);
  },
  click() {
    if (!ok()) return; const t = ac.currentTime;
    tone(t, 1400, 0.03, 0.15, 'square');
  },
  heart(stress = 0) {
    if (!ok()) return; const t = ac.currentTime;
    tone(t, 55, 0.12, 0.25 + stress * 0.2, 'sine', 40);
    tone(t + 0.16, 52, 0.1, 0.18 + stress * 0.15, 'sine', 38);
  },
  wind(v) {
    if (!ok()) return; const t = ac.currentTime;
    const n = noise(t, 1.2, 400 + v * 120, 0.7, 0.04 + v * 0.02, 'lowpass');
  },
  cheer(big = 1) {
    if (!ok()) return; const t = ac.currentTime;
    const n = noise(t, 1.2 * big, 1100, 0.6, 0.22 * big);
    for (let i = 0; i < 10 * big; i++) noise(t + Math.random() * 0.9 * big, 0.03, 2500 + Math.random() * 1500, 4, 0.18);
  },
  groan() {
    if (!ok()) return; const t = ac.currentTime;
    const n = noise(t, 0.9, 500, 1, 0.15, 'lowpass');
    n.f.frequency.exponentialRampToValueAtTime(220, t + 0.8);
  },
  bell() {
    if (!ok()) return; const t = ac.currentTime;
    [523, 659, 784].forEach((f, i) => tone(t + i * 0.09, f, 0.5, 0.12, 'square'));
  },
  anthem() { // fanfara de la Federació
    if (!ok()) return; const t = ac.currentTime;
    const notes = [[392, 0, .25], [392, .25, .12], [523, .4, .35], [494, .8, .2], [440, 1.0, .2], [523, 1.2, .6]];
    for (const [f, s, d] of notes) { tone(t + s, f, d, 0.1, 'square'); tone(t + s, f / 2, d, 0.08, 'triangle'); }
  },
  buzz() {
    if (!ok()) return; const t = ac.currentTime;
    tone(t, 110, 0.25, 0.2, 'sawtooth', 100);
  },
  coin() {
    if (!ok()) return; const t = ac.currentTime;
    tone(t, 988, 0.06, 0.12, 'square'); tone(t + 0.06, 1319, 0.15, 0.12, 'square');
  },
};

export function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
