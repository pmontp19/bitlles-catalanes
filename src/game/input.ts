// Gest d'un dit: arrossegar cap amunt. Llargada = força, inclinació = punteria, corba = efecte.
import type { ThrowInput } from './physics';

export type Pt = { x: number; y: number };

/** Converteix un traç (en píxels de pantalla) en un llançament. Pur i testejable. */
export function gestureToInput(path: Pt[], screenH: number): (ThrowInput & { valid: boolean }) {
  if (path.length < 2) return { aim: 0, power: 0, spin: 0, valid: false };
  const a = path[0];
  const b = path[path.length - 1];
  const dx = b.x - a.x;
  const dy = a.y - b.y; // cap amunt és positiu
  const len = Math.hypot(dx, dy);
  const valid = dy > screenH * 0.06;
  const power = Math.max(0, Math.min(1, (dy / screenH - 0.08) / 0.42));
  const aim = Math.max(-1, Math.min(1, Math.atan2(dx, Math.max(1, dy)) / ((25 * Math.PI) / 180)));
  // Desviació màxima respecte a la corda; positiva si el traç es desvia cap a la dreta.
  let dev = 0;
  if (len > 1) {
    const nx = dy / len;
    const ny = dx / len; // normal cap a la dreta de la corda (en coordenades de pantalla)
    for (const p of path) {
      const d = (p.x - a.x) * nx + (p.y - a.y) * ny;
      if (Math.abs(d) > Math.abs(dev)) dev = d;
    }
  }
  const spin = len > 1 ? Math.max(-1, Math.min(1, dev / len / 0.22)) : 0;
  return { aim, power, spin: Math.abs(spin) < 0.12 ? 0 : spin, valid };
}

export class SwipeInput {
  private path: Pt[] = [];
  private active = false;
  enabled = false;
  onMove: (input: ThrowInput & { valid: boolean }, path: Pt[]) => void = () => {};
  onRelease: (input: ThrowInput) => void = () => {};
  onCancel: () => void = () => {};

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button > 0) return;
      this.active = true;
      this.path = [{ x: e.clientX, y: e.clientY }];
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this.path.push({ x: e.clientX, y: e.clientY });
      this.onMove(gestureToInput(this.path, el.clientHeight), this.path);
    });
    const end = (e: PointerEvent) => {
      if (!this.active) return;
      this.active = false;
      this.path.push({ x: e.clientX, y: e.clientY });
      const g = gestureToInput(this.path, el.clientHeight);
      if (g.valid && this.enabled) this.onRelease(g);
      else this.onCancel();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { this.active = false; this.onCancel(); });
  }
}
