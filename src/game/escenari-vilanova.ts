// Entorn modelat de la pista de Vilanova i la Geltrú, a partir de les fotos de referència:
// camp ample amb diverses pistes, tanca baixa verda amb xarxa i plaques numerades, fanals galvanitzats
// dins del camp, pèrgola al fons i rètol "Bitlles Catalanes". Tot és decorat: no té física.
import * as THREE from 'three';
import { PIN_LAYOUT } from './constants';

type Ctx = {
  pinGeo: THREE.BufferGeometry;
  pinMat: THREE.Material;
  ringMat: THREE.Material;
  paint: (color: number) => THREE.Material;
  lathe: (p: [number, number][], seg: number) => THREE.BufferGeometry;
  headGeo: THREE.BufferGeometry;
  quality: 'alta' | 'baixa';
};

const FENCE_GREEN = 0x1f6b47;
const GALV = 0xb9bcbd;

/** Textura de malla per a la xarxa verda de la tanca. */
function meshAlpha(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#fff';
  x.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function textTexture(lines: { text: string; font: string; color: string }[], w: number, h: number, bg: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((l, i) => {
    x.font = l.font;
    x.fillStyle = l.color;
    x.fillText(l.text, w / 2, (h / (lines.length + 1)) * (i + 1));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildVilanova(scene: THREE.Scene, ctx: Ctx) {
  const root = new THREE.Group();
  root.name = 'vilanova';
  scene.add(root);
  const std = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const green = std(FENCE_GREEN, 0.5, 0.3);
  const galv = std(GALV, 0.35, 0.9);
  const shadowy = <T extends THREE.Object3D>(o: T) => { o.castShadow = true; o.receiveShadow = true; return o; };

  // ---- Camp: x de -7 a 7, z de -5,5 (fons) a 16 (darrere del tirador) ----
  const X0 = -7, X1 = 7, ZF = -5.5, ZB = 16;

  // ---- Tanca baixa verda: pals, travesser i xarxa ----
  const fenceH = 1.1;
  const postGeo = new THREE.BoxGeometry(0.05, fenceH, 0.05);
  const posts: THREE.Vector3[] = [];
  for (let x = X0; x <= X1 + 0.01; x += 2) posts.push(new THREE.Vector3(x, fenceH / 2, ZF));
  for (let z = ZF + 2; z <= ZB; z += 2) { posts.push(new THREE.Vector3(X0, fenceH / 2, z)); posts.push(new THREE.Vector3(X1, fenceH / 2, z)); }
  const postInst = new THREE.InstancedMesh(postGeo, green, posts.length);
  posts.forEach((p, i) => postInst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  root.add(shadowy(postInst));
  const netMat = new THREE.MeshStandardMaterial({ color: FENCE_GREEN, alphaMap: meshAlpha(), transparent: true, side: THREE.DoubleSide, roughness: 0.7, alphaTest: 0.3 });
  const rail = (len: number, x: number, z: number, rotY: number) => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), green);
    top.position.y = fenceH;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH - 0.05), netMat.clone());
    (net.material as THREE.MeshStandardMaterial).alphaMap!.repeat.set(len * 8, (fenceH - 0.05) * 8);
    net.position.y = (fenceH - 0.05) / 2;
    g.add(shadowy(top), net);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    return g;
  };
  root.add(rail(X1 - X0, 0, ZF, 0), rail(ZB - ZF, X0, (ZF + ZB) / 2, Math.PI / 2), rail(ZB - ZF, X1, (ZF + ZB) / 2, Math.PI / 2));

  // ---- Plaques numerades a la tanca del fons, una per pista ----
  const lanes = [-4.4, -2.2, 0, 2.2, 4.4];
  lanes.forEach((x, i) => {
    const n = 5 + i;
    const tex = textTexture([{ text: String(n), font: 'bold 72px system-ui, sans-serif', color: '#ffffff' }], 128, 128, '#1f6b47');
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    plate.position.set(x, 0.32, ZF + 0.035);
    root.add(plate);
  });

  // ---- Rètol "Bitlles Catalanes" penjat a la tanca ----
  const signTex = textTexture([{ text: 'Bitlles Catalanes', font: 'italic bold 120px Georgia, serif', color: '#2a4f8a' }], 1024, 160, '#f6f6f2');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.38), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
  sign.position.set(-2.9, 0.82, ZF + 0.04);
  root.add(sign);

  // ---- Fanals galvanitzats dins del camp, amb dos projectors ----
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 8, 16);
  const lampGeo = new THREE.BoxGeometry(0.42, 0.28, 0.16);
  const lampMat = std(0x3c3f42, 0.4, 0.6);
  for (const [x, z] of [[-3.3, -1.6], [3.3, -1.6], [-3.3, 7], [3.3, 7.5]] as const) {
    const pole = shadowy(new THREE.Mesh(poleGeo, galv));
    pole.position.set(x, 4, z);
    root.add(pole);
    for (const dx of [-0.25, 0.25]) {
      const lamp = shadowy(new THREE.Mesh(lampGeo, lampMat));
      lamp.position.set(x + dx, 8.05, z);
      lamp.rotation.x = 0.5;
      root.add(lamp);
    }
  }

  // ---- Pèrgola al fons, darrere la tanca ----
  const pergola = new THREE.Group();
  const pz = ZF - 3.2, plen = 18, pd = 3.6, ph = 3.1;
  const dark = std(0x4a4d50, 0.5, 0.6);
  for (let x = -plen / 2; x <= plen / 2 + 0.01; x += 3) for (const z of [pz - pd / 2, pz + pd / 2]) {
    const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.09, ph, 0.09), dark));
    p.position.set(x, ph / 2, z);
    pergola.add(p);
  }
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(plen, 0.04, 0.09), dark, 22);
  for (let i = 0; i < 22; i++) slats.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, ph + 0.05, pz - pd / 2 + (i / 21) * pd));
  pergola.add(shadowy(slats));
  root.add(pergola);

  // ---- Tanques altes de malla negra d'altres pistes, al fons ----
  const tallNet = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, alphaMap: meshAlpha(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  (tallNet.alphaMap as THREE.Texture).repeat.set(60, 20);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5), tallNet);
  wall.position.set(-9, 2.25, ZF - 6.5);
  root.add(wall);

  // ---- Pistes del costat amb jocs de bitlles (decorat) ----
  const blue = ctx.paint(0x2f6fb3);
  const yellow = ctx.paint(0xf2b705);
  const setOfPins = (cx: number, knocked: boolean, headMat: THREE.Material, seed: number) => {
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    PIN_LAYOUT.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.add(shadowy(new THREE.Mesh(ctx.pinGeo, ctx.pinMat)));
      const ring = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.0465, 0.0465, 0.022, 24), ctx.ringMat));
      ring.position.y = 0.012;
      g.add(ring, shadowy(new THREE.Mesh(ctx.headGeo, headMat)));
      g.position.set(cx + x, 0, z);
      if (knocked && i !== 4) {
        g.position.set(cx + x + (rnd() - 0.5) * 0.6, 0.045, z + (rnd() - 0.5) * 0.5 - 0.2);
        g.rotation.set(Math.PI / 2, 0, rnd() * Math.PI * 2, 'YXZ');
      }
      root.add(g);
    });
  };
  setOfPins(-2.2, false, blue, 11);
  setOfPins(2.2, true, yellow, 23);
  if (ctx.quality === 'alta') { setOfPins(-4.4, true, blue, 37); setOfPins(4.4, false, yellow, 41); }

  // Cordills i barres blanques de les pistes del costat.
  const string = std(0x3b3a36, 0.9);
  for (const cx of lanes) {
    if (cx === 0) continue;
    for (const ex of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 16.5), string);
      s.position.set(cx + ex, 0.002, 16.5 / 2 - 3);
      root.add(s);
    }
  }
  return root;
}
