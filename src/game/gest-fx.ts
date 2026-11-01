// Capa 2D sobre l'escena amb el feedback del gest (com Flick Kick, Bowling King o Golf Clash):
// - el traç del dit, del color de la zona on caurà el bitllot (blau curt, verd bé, vermell llarg);
// - un indicador de força al costat del dit, amb la franja que fa caure el bitllot just davant de les bitlles;
// - una fletxa d'efecte quan el gest fa corba.
// Després de llançar, el traç s'esvaeix.
import type { Pt } from './input';
import type { Zona } from './scene';

const COLOR: Record<Zona, string> = { curt: '#7fb2ff', be: '#3ecf6e', llarg: '#ff6a4a' };
const TEXT: Record<Zona, string> = { curt: 'curt', be: 'bé!', llarg: 'llarg' };

export class GestFx {
  private ctx: CanvasRenderingContext2D;
  private path: Pt[] = [];
  private zona: Zona = 'curt';
  private spin = 0;
  private power = 0;
  private good: [number, number] | null = null;
  private fade = 0; // 0 = visible; > 0 = s'esvaeix
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  update(path: Pt[], zona: Zona, spin: number, power: number, good: [number, number] | null) {
    this.path = path.slice(-80);
    this.zona = zona;
    this.spin = spin;
    this.power = power;
    this.good = good;
    this.fade = 0;
  }

  release() { if (this.path.length) this.fade = 0.0001; }
  clear() { this.path = []; this.fade = 0; }

  draw(dt: number) {
    const c = this.ctx;
    const r = this.canvas.getBoundingClientRect();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.path.length < 2) return;
    let alpha = 1;
    if (this.fade > 0) {
      this.fade += dt;
      alpha = Math.max(0, 1 - this.fade / 0.7);
      if (alpha <= 0) { this.path = []; return; }
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, -r.left * this.dpr, -r.top * this.dpr);
    c.globalAlpha = alpha;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // Traç del dit: vora fosca per llegir-se sobre qualsevol fons i color de la zona.
    const line = (w: number, style: string) => {
      c.beginPath();
      this.path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.lineWidth = w;
      c.strokeStyle = style;
      c.stroke();
    };
    line(16, 'rgba(20,24,22,.45)');
    line(10, COLOR[this.zona]);

    const a = this.path[0];
    const b = this.path[this.path.length - 1];
    // Punt d'inici (on has posat el dit).
    c.beginPath(); c.arc(a.x, a.y, 9, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();

    // Fletxa d'efecte: cap a on es desviarà el bitllot (spin > 0 → esquerra).
    if (Math.abs(this.spin) > 0.12 && this.fade === 0) {
      const dir = this.spin > 0 ? -1 : 1;
      const x = b.x + dir * 34, y = b.y - 30;
      c.beginPath();
      c.arc(x - dir * 18, y + 18, 22, dir > 0 ? Math.PI : 0, dir > 0 ? Math.PI * 1.5 : -Math.PI * 0.5, dir < 0);
      c.lineWidth = 5; c.strokeStyle = '#fffaf0'; c.stroke();
      c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + dir * 9, y + 2); c.lineTo(x - dir * 2, y + 9); c.closePath(); c.fillStyle = '#fffaf0'; c.fill();
      label(c, 'efecte', x, y - 16);
    }

    // Indicador de força al costat del dit.
    if (this.fade === 0) {
      const side = b.x > r.left + r.width * 0.7 ? -1 : 1;
      const gx = b.x + side * 48, gh = 120, gw = 14, gy = Math.min(Math.max(b.y - gh / 2, r.top + 70), r.bottom - gh - 110);
      c.fillStyle = 'rgba(20,24,22,.55)';
      roundRect(c, gx - gw / 2 - 3, gy - 3, gw + 6, gh + 6, 9); c.fill();
      if (this.good) {
        const [p0, p1] = this.good;
        c.fillStyle = 'rgba(62,207,110,.45)';
        c.fillRect(gx - gw / 2, gy + gh * (1 - p1), gw, gh * (p1 - p0));
      }
      c.fillStyle = COLOR[this.zona];
      const fh = gh * Math.max(0.02, this.power);
      roundRect(c, gx - gw / 2, gy + gh - fh, gw, fh, 6); c.fill();
      label(c, TEXT[this.zona], gx, gy - 12);
    }
    c.globalAlpha = 1;
  }
}

function label(c: CanvasRenderingContext2D, t: string, x: number, y: number) {
  c.font = '800 15px system-ui, -apple-system, sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 4;
  c.strokeStyle = 'rgba(20,24,22,.7)';
  c.strokeText(t, x, y);
  c.fillStyle = '#fffaf0';
  c.fillText(t, x, y);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
