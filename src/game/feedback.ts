// So i vibració. Aïllat perquè a l'app nativa (Capacitor) es pugui substituir per Haptics natiu.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { ctx = null; }
  }
  void ctx?.resume();
}

/** Cop de fusta sintetitzat: `hard` 0..1. */
export function knock(hard = 0.5, pitch = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(180 * pitch, t + 0.08);
  f.type = 'bandpass';
  f.frequency.value = 900 * pitch;
  f.Q.value = 2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25 + hard * 0.5, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(f).connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.2);
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* iOS Safari no ho suporta */ }
}

export function cheer(big: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = big ? [523, 659, 784, 1046] : [523, 659];
  notes.forEach((n, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'square';
    o.frequency.value = n;
    g.gain.setValueAtTime(0.0001, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.09 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.18);
    o.connect(g).connect(ctx!.destination);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.2);
  });
}
