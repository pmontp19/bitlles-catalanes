// Il·lustracions en SVG (cadenes pures) per al llibret de regles, el qüestionari i la interfície.
// Formes tretes del reglament i de les fotos de docs/referencies. Colors: `currentColor` = tinta.
import { BITLLOTS, type BitllotKind } from './rules';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Silueta d'una bitlla (vista lateral) dins d'una caixa 20×60, base a y=60. */
const PIN_PATH =
  'M4.6 60 L4.6 57.5 C4.4 44 4.8 35 5.6 31 C6.6 26.5 8 24 8 21.5 L8 15.5 C6.2 14.6 5.2 12.6 5.2 10.4 C5.2 7.2 7.4 5 10 5 C12.6 5 14.8 7.2 14.8 10.4 C14.8 12.6 13.8 14.6 12 15.5 L12 21.5 C12 24 13.4 26.5 14.4 31 C15.2 35 15.6 44 15.4 57.5 L15.4 60 Z';

/** Bitlla petita per a la interfície (fusta, cap pintat opcional). */
export function pinIcon(opts: { down?: boolean; pubilla?: boolean; w?: number } = {}): string {
  const w = opts.w ?? 12;
  const id = `g${Math.random().toString(36).slice(2, 7)}`;
  const head = opts.pubilla ? '#f2b705' : 'none';
  return `<svg class="pin-ico ${opts.down ? 'down' : ''}" viewBox="0 0 20 62" width="${w}" height="${(w * 62) / 20}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#9a6a3a"/><stop offset=".45" stop-color="#e6bf86"/><stop offset="1" stop-color="#8c5c30"/></linearGradient></defs>
    <path d="${PIN_PATH}" fill="url(#${id})" stroke="#4a3018" stroke-width=".8"/>
    <rect x="4.6" y="56.5" width="10.8" height="3.5" fill="#3a3a3a"/>
    ${opts.pubilla ? `<path d="M5.2 10.4 C5.2 7.2 7.4 5 10 5 C12.6 5 14.8 7.2 14.8 10.4 C14.8 12.6 13.8 14.6 12 15.5 L8 15.5 C6.2 14.6 5.2 12.6 5.2 10.4Z" fill="${head}" stroke="#4a3018" stroke-width=".8"/>` : ''}
  </svg>`;
}

/** Bitllot en forma de pera, horitzontal, amb la cinta del color del tipus. */
export function clubIcon(kind: BitllotKind, w = 64): string {
  const b = BITLLOTS[kind];
  const id = `c${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="club-ico" viewBox="0 0 90 30" width="${w}" height="${(w * 30) / 90}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0cf98"/><stop offset=".5" stop-color="${hex(b.color)}"/><stop offset="1" stop-color="#5a3a1c"/></linearGradient></defs>
    <path d="M6 15 C6 5.5 13 3 24 3 C34 3 40 6.5 46 10 C50 12 54 12.6 60 12.6 L84 12.6 C87 12.6 88 13.6 88 15 C88 16.4 87 17.4 84 17.4 L60 17.4 C54 17.4 50 18 46 20 C40 23.5 34 27 24 27 C13 27 6 24.5 6 15 Z" fill="url(#${id})" stroke="#3d2810" stroke-width="1.2"/>
    ${kind === 'cinta' ? '<rect x="64" y="12" width="14" height="6" fill="#2f6fb3" stroke="#1d3f66" stroke-width=".6"/>' : ''}
    ${kind === 'torcat' ? '<path d="M12 9 C22 14 30 8 40 14" stroke="#3d2810" stroke-width="1" fill="none" opacity=".6"/>' : ''}
  </svg>`;
}

/** Plantada vista des de dalt: 6 bitlles (0-2 davant, 3-5 darrere). */
export function plantadaSvg(down: boolean[] = [false, false, false, false, false, false], pubilla: number | null = null, size = 160): string {
  const pos = [[40, 100], [80, 100], [120, 100], [40, 60], [80, 60], [120, 60]];
  const pins = pos.map(([x, y], i) => {
    if (down[i]) {
      const a = [25, -40, 60, -15, 35, -65][i];
      return `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-6" y="-26" width="12" height="30" rx="5" fill="#d9b483" stroke="currentColor" stroke-width="1.5" opacity=".55"/><circle cx="0" cy="-27" r="5" fill="#d9b483" stroke="currentColor" stroke-width="1.5" opacity=".55"/></g>`;
    }
    const pub = i === pubilla;
    return `<g><circle cx="${x}" cy="${y}" r="15" fill="#e8c38c" stroke="currentColor" stroke-width="2"/><circle cx="${x}" cy="${y}" r="7" fill="${pub ? '#f2b705' : '#f3dcb4'}" stroke="currentColor" stroke-width="1.5"/></g>`;
  }).join('');
  return `<svg class="art" viewBox="0 0 160 140" width="${size}" role="img" aria-label="Plantada vista de dalt">
    <line x1="10" y1="100" x2="150" y2="100" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity=".6"/>
    ${pins}
    <text x="80" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity=".75">línia de plantada ↓ tirador</text>
  </svg>`;
}

/** Bitlla inclinada `deg` graus respecte al terra, amb l'angle de 45° marcat. */
export function angleSvg(deg: number, showLimit = true): string {
  return `<svg class="art" viewBox="0 0 220 130" role="img" aria-label="Bitlla inclinada ${deg} graus respecte al terra">
    <line x1="20" y1="118" x2="210" y2="118" stroke="currentColor" stroke-width="2"/>
    ${showLimit ? '<path d="M70 118 L170 18" stroke="#b8322a" stroke-width="1.6" stroke-dasharray="5 4"/><text x="174" y="20" fill="#b8322a" font-size="12" font-weight="700">45°</text>' : ''}
    <g transform="rotate(${90 - deg} 70 118)"><g transform="translate(70 118) scale(1.7) translate(-10 -60)"><path d="${PIN_PATH}" fill="#e2b77c" stroke="currentColor" stroke-width=".8"/><rect x="4.6" y="56.5" width="10.8" height="3.5" fill="#4a4a4a"/></g></g>
    <path d="M128 118 A58 58 0 0 0 ${70 + 58 * Math.cos((deg * Math.PI) / 180)} ${118 - 58 * Math.sin((deg * Math.PI) / 180)}" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <text x="${78 + 70 * Math.cos((deg * Math.PI) / 360)}" y="${122 - 70 * Math.sin((deg * Math.PI) / 360)}" font-size="14" font-weight="700" fill="currentColor">${deg}°</text>
  </svg>`;
}

/** Fitxa tècnica: bitlla i bitllot amb cotes del reglament. */
export function materialSvg(): string {
  return `<svg class="art wide" viewBox="0 0 300 190" role="img" aria-label="Mides de la bitlla i del bitllot">
    <g transform="translate(40 10) scale(2.6)"><path d="${PIN_PATH}" fill="#e2b77c" stroke="currentColor" stroke-width=".5"/><rect x="4.6" y="56.5" width="10.8" height="3.5" fill="#4a4a4a"/></g>
    <g stroke="currentColor" stroke-width="1" fill="currentColor" font-size="10">
      <line x1="30" y1="23" x2="30" y2="166"/><line x1="26" y1="23" x2="34" y2="23"/><line x1="26" y1="166" x2="34" y2="166"/>
      <text x="22" y="98" text-anchor="middle" transform="rotate(-90 22 98)" stroke="none">510 mm</text>
      <text x="66" y="12" text-anchor="middle" stroke="none">cap 65 mm</text>
      <text x="66" y="182" text-anchor="middle" stroke="none">base 90 mm · anella de ferro</text>
    </g>
    <g transform="translate(140 70) scale(1.6)">
      <path d="M6 15 C6 5.5 13 3 24 3 C34 3 40 6.5 46 10 C50 12 54 12.6 60 12.6 L84 12.6 C87 12.6 88 13.6 88 15 C88 16.4 87 17.4 84 17.4 L60 17.4 C54 17.4 50 18 46 20 C40 23.5 34 27 24 27 C13 27 6 24.5 6 15 Z" fill="#c99a62" stroke="currentColor" stroke-width=".6"/>
    </g>
    <g stroke="currentColor" stroke-width="1" fill="currentColor" font-size="10">
      <line x1="149" y1="130" x2="281" y2="130"/><line x1="149" y1="126" x2="149" y2="134"/><line x1="281" y1="126" x2="281" y2="134"/>
      <text x="215" y="146" text-anchor="middle" stroke="none">bitllot: 280 mm</text>
      <text x="180" y="62" text-anchor="middle" stroke="none">base 80 mm</text>
      <text x="255" y="62" text-anchor="middle" stroke="none">mànec 40 mm</text>
    </g>
  </svg>`;
}

/** Pista vista de dalt amb les distàncies de cada categoria. */
export function pistaSvg(): string {
  const rows: [number, string][] = [[6.5, 'benjamí'], [8, 'aleví'], [9.5, 'infantil, femení'], [11.5, 'masculí']];
  const y = (m: number) => 20 + m * 12;
  return `<svg class="art wide" viewBox="0 0 300 190" role="img" aria-label="Distàncies de llançament per categoria">
    <rect x="20" y="12" width="70" height="${y(13) - 12}" fill="#e8d5b2" stroke="currentColor" stroke-width="1.2"/>
    <g fill="#c99a62" stroke="currentColor" stroke-width=".8">${[0, 1, 2].map((i) => `<circle cx="${43 + i * 12}" cy="${y(0)}" r="4"/><circle cx="${43 + i * 12}" cy="${y(0) - 9}" r="4"/>`).join('')}</g>
    ${rows.map(([m, cat]) => `<line x1="20" y1="${y(m)}" x2="90" y2="${y(m)}" stroke="#b8322a" stroke-width="1.4"/><text x="100" y="${y(m) + 4}" font-size="11" fill="currentColor"><tspan font-weight="700">${String(m).replace('.', ',')} m</tspan> · ${cat}</text>`).join('')}
    <text x="100" y="${y(0) + 4}" font-size="11" fill="currentColor" font-weight="700">línia de plantada</text>
  </svg>`;
}
