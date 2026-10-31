// Primitives de píxel (sense antialiasing) sobre un context 2D.
export const C = {
  bg: '#1b1716', ink: '#2c2622', ink2: '#5a5044', paper: '#d8d0b4', paper2: '#c4bb9c', paperSh: '#8f866b',
  red: '#a8322b', redL: '#c8483a', redD: '#6e1f1b', green: '#5b7a3a', greenL: '#7d9a4c', greenD: '#3a5224',
  wood: '#4a3426', woodL: '#5c4230', woodD: '#2e2018', woodDD: '#21170f', chalk: '#e6dfcc', gold: '#d9a934', goldD: '#9a7420',
  blue: '#3c6ea8', blueL: '#6a95c4',
  dirt1: '#8c6b4a', dirt2: '#7d5e40', dirt3: '#6c5037', dirt4: '#5a4230',
  grass1: '#4f5638', grass2: '#424a30', grass3: '#363d28',
  sky1: '#3d4a50', sky2: '#56635f', sky3: '#7b8577', hill: '#323d38', hill2: '#27302c',
  white: '#efe9d8', grey: '#8a8a84', greyD: '#55534f', dark: '#100d0c',
  pinL: '#ecd3a2', pinM: '#c99d63', pinD: '#8d6237', pinO: '#3b2a1c', pinS: '#5e3f22',
  ironL: '#7a7a80', ironM: '#55555b', ironD: '#33333a',
  bitL: '#d4a066', bitM: '#a4703f', bitD: '#6a4424', bitO: '#2e1d10', tape: '#d8d0c0',
  shadow: 'rgba(20,12,8,0.45)',
};

const SPAN = [];
for (let r = 0; r <= 48; r++) {
  const a = [];
  for (let dy = -r; dy <= r; dy++) a.push(Math.floor(Math.sqrt(Math.max(0, (r + 0.5) ** 2 - dy * dy))));
  SPAN[r] = a;
}

export class Gfx {
  constructor(ctx) { this.ctx = ctx; }
  rect(x, y, w, h, c) { const g = this.ctx; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  px(x, y, c) { const g = this.ctx; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  disc(cx, cy, r, c) {
    const g = this.ctx; g.fillStyle = c;
    r = Math.max(0, Math.min(48, Math.round(r))); cx = Math.round(cx); cy = Math.round(cy);
    const s = SPAN[r];
    for (let i = 0; i < s.length; i++) g.fillRect(cx - s[i], cy - r + i, s[i] * 2 + 1, 1);
  }
  ellipse(cx, cy, rx, ry, c) {
    const g = this.ctx; g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
    ry = Math.max(0, Math.round(ry));
    for (let dy = -ry; dy <= ry; dy++) {
      const h = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
      g.fillRect(cx - h, cy + dy, h * 2 + 1, 1);
    }
  }
  line(x0, y0, x1, y1, c, dash = 0, phase = 0) {
    const g = this.ctx; g.fillStyle = c;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = phase;
    for (let n = 0; n < 2000; n++) {
      if (!dash || (Math.floor(i / dash) % 2 === 0)) g.fillRect(x0, y0, 1, 1);
      i++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  box(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); }
  dither(x, y, w, h, c, density = 2) {
    const g = this.ctx; g.fillStyle = c;
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = (j + x + y) % density; i < w; i += density) g.fillRect(x + i, y + j, 1, 1);
  }
}

export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
