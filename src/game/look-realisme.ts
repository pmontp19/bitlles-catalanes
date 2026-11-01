// Estètica "realisme": il·luminació d'una foto HDR real, materials PBR (fusta, terra, ferro),
// fons fotogràfic projectat a terra, còdols, pols i postprocessat de càmera (profunditat de camp, gra, vinyeta).
// Recursos CC0 de Poly Haven a `public/realisme/` (vegeu LLICENCIES.md).
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { LANE_WIDTH } from './constants';
import type { CameraMode, GameScene, PostFX } from './scene';

export type Quality = 'alta' | 'baixa';
const BASE = '/realisme/';

export type EscenariId = 'vilanova' | 'parc';

/** Un escenari: foto 360° (llum i fons), terra, i com es marquen pista i bitlles. */
type Escenari = {
  hdr: string;
  pano: string;
  /** Direcció del sol dins la foto (calculada del píxel més brillant). */
  sunInPhoto: THREE.Vector3;
  /** Gir de la foto perquè la càmera miri cap a la part bonica i el sol il·lumini bé. */
  rotY: number;
  /** Alçada aproximada de la càmera que va fer la foto: fixa l'escala del terra projectat. */
  photoHeight: number;
  groundDiffuse: string;
  /** Mida del terra texturat (amplada, llargada) i el seu centre en z. */
  ground: [number, number, number];
  sun: number;
  env: number;
  exposure: number;
  /** Línies de la pista: calç (parc) o cordill amb barres blanques (Vilanova). */
  lines: 'calc' | 'cordill';
  /** Pintura de les bitlles: anelles al coll o cap pintat. */
  paint: 'anelles' | 'cap';
  pebbles: number;
};

const ESCENARIS: Record<EscenariId, Escenari> = {
  // Palermo Park (Poly Haven): terra i plàtans, llum suau de tarda.
  parc: {
    hdr: 'entorn_1k.hdr', pano: 'entorn_4k.jpg', sunInPhoto: new THREE.Vector3(0.578, 0.625, 0.524), rotY: -2.04, photoHeight: 1.7,
    groundDiffuse: 'terra_diffuse_2k.jpg', ground: [12, 24, 3], sun: 3.6, env: 0.75, exposure: 1.05, lines: 'calc', paint: 'anelles', pebbles: 900,
  },
  // Pista de Vilanova i la Geltrú (fotos de referència): sauló clar, cel blau, sol alt i blocs de pisos.
  // La foto 360° és Wide Street 01 (Poly Haven); l'asfalt queda tapat pel camp i la tanca modelats.
  vilanova: {
    hdr: 'vilanova_entorn_1k.hdr', pano: 'vilanova_entorn_4k.jpg', sunInPhoto: new THREE.Vector3(0.477, 0.796, 0.373), rotY: 0, photoHeight: 1.7,
    groundDiffuse: 'saulo_clar_diffuse_2k.jpg', ground: [30, 44, 4], sun: 3.4, env: 0.85, exposure: 0.95, lines: 'cordill', paint: 'cap', pebbles: 500,
  },
};

function loadTex(loader: THREE.TextureLoader, file: string, srgb: boolean, repeat = 1) {
  return loader.loadAsync(BASE + file).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Perfil visual de la bitlla segons fotos reals (docs/referencies): cos gairebé cilíndric amb ranures de torn,
 *  espatlla, coll estret i cap en bola. Mides del reglament: 510 mm, base 90 mm, cap 65 mm. */
export function pinProfileDetall(): [number, number][] {
  const pts: [number, number][] = [[0, 0], [0.044, 0], [0.0455, 0.004]];
  const grooves = [0.035, 0.15, 0.27];
  for (let y = 0.01; y <= 0.3; y += 0.005) {
    let r = 0.0455 - (y / 0.3) * 0.0045;
    for (const g of grooves) if (Math.abs(y - g) < 0.004) r -= 0.0018;
    pts.push([r, y]);
  }
  for (let k = 1; k <= 12; k++) { // espatlla
    const t = k / 12;
    pts.push([0.041 - (0.041 - 0.0205) * (0.5 - 0.5 * Math.cos(t * Math.PI)), 0.3 + t * 0.085]);
  }
  pts.push([0.0195, 0.41], [0.02, 0.452]);
  const cy = 0.4775, R = 0.0325; // cap: bola de 65 mm
  for (let a = -52; a <= 90; a += 8) {
    const th = (a * Math.PI) / 180;
    pts.push([Math.max(0.0005, R * Math.cos(th)), cy + R * Math.sin(th)]);
  }
  pts.push([0, 0.51]);
  return pts;
}

/** Bitllot en forma de pera (fotos reals): part ampla arrodonida de 80 mm, transició i mànec de 40 mm. */
export function clubProfileDetall(): [number, number][] {
  const pts: [number, number][] = [[0, -0.12]];
  for (let a = -90; a <= 0; a += 10) { // cul arrodonit
    const th = (a * Math.PI) / 180;
    pts.push([0.04 * Math.cos(th), -0.085 + 0.035 * Math.sin(th)]);
  }
  pts.push([0.04, -0.05], [0.038, -0.02], [0.033, 0.0], [0.026, 0.015], [0.021, 0.03], [0.02, 0.06], [0.019, 0.14], [0.022, 0.15], [0.02, 0.158], [0, 0.16]);
  return pts;
}

/** Línia de calç: textura d'alfa amb vores irregulars i esquitxos. */
function chalkAlpha(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.random() * 135;
    x.fillStyle = `rgb(${v},${v},${v})`;
    const y = Math.random() * 512;
    const w = 40 + Math.random() * 20;
    x.globalAlpha = 0.25;
    x.fillRect(32 - w / 2 + (Math.random() - 0.5) * 6, y, w, 2 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Pista de Vilanova: cordill fosc als límits i barres blanques estirades a les distàncies de tir. */
function laneCordill(d: number): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const string = new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 });
  const mk = (w: number, l: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, l), string);
    m.position.set(x, 0.002, z);
    m.receiveShadow = true;
    return m;
  };
  out.push(mk(LANE_WIDTH, 0.006, 0, 0), mk(0.006, 16.5, -LANE_WIDTH / 2, 16.5 / 2 - 3), mk(0.006, 16.5, LANE_WIDTH / 2, 16.5 / 2 - 3));
  const bar = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.7 });
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12);
  barGeo.rotateZ(Math.PI / 2);
  // Una barra a cada límit per a cada distància de categoria; la de la distància actual, al mig de la pista.
  for (const z of [6.5, 8, 9.5, 11.5]) for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
    const b = new THREE.Mesh(barGeo, bar);
    b.position.set(x, 0.025, z);
    b.rotation.y = (Math.random() - 0.5) * 0.2;
    b.castShadow = b.receiveShadow = true;
    out.push(b);
  }
  out.push(mk(LANE_WIDTH, 0.006, 0, d));
  return out;
}

/** Alfa radial perquè el terra texturat es fongui amb el terra de la foto. */
function fadeAlpha(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 60, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function dustSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Postprocessat: profunditat de camp segons la distància a les bitlles, vinyeta, gra i corba de color. */
class CameraPost implements PostFX {
  private rt: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private pscene = new THREE.Scene();
  private ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private aperture = 0.6;
  private time = 0;

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.rt.depthTexture = new THREE.DepthTexture(4, 4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tCol: { value: this.rt.texture }, tDep: { value: this.rt.depthTexture }, res: { value: new THREE.Vector2(4, 4) },
        nf: { value: new THREE.Vector2(0.05, 100) }, focus: { value: 2 }, aperture: { value: 0.6 }, time: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tCol; uniform sampler2D tDep; uniform vec2 res; uniform vec2 nf; uniform float focus; uniform float aperture; uniform float time;
        varying vec2 vUv;
        float viewZ(vec2 uv){ float d = texture2D(tDep, uv).x * 2. - 1.; return 2. * nf.x * nf.y / (nf.y + nf.x - d * (nf.y - nf.x)); }
        float coc(float z){ return clamp(abs(z - focus) / z * aperture, 0., 1.) * 14.; }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          float z = viewZ(vUv); float c = coc(z);
          vec3 acc = vec3(0.); float wsum = 0.;
          for (int i = 0; i < 20; i++) {
            float a = float(i) * 2.39996; float r = sqrt((float(i) + .5) / 20.);
            vec2 o = vec2(cos(a), sin(a)) * r * c / res;
            float zs = viewZ(vUv + o);
            // Evita que el fons desenfocat s'escampi per sobre d'objectes enfocats.
            float w = zs < z ? 1. : clamp(coc(zs) / max(c, .5), 0., 1.);
            acc += texture2D(tCol, vUv + o).rgb * w; wsum += w;
          }
          vec3 col = acc / max(wsum, 1e-3);
          col = toneMapping(col);
          col = linearToOutputTexel(vec4(col, 1.)).rgb;
          vec2 q = vUv - .5;
          col *= 1. - .35 * pow(length(q * vec2(1., .8)) * 1.35, 2.4);
          col = mix(col, col * vec3(1.04, 1., .93), .5);
          col += (hash(vUv * res + time) - .5) * .035;
          gl_FragColor = vec4(col, 1.);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.pscene.add(this.quad);
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.max(4, Math.round(w * dpr)), H = Math.max(4, Math.round(h * dpr));
    this.rt.setSize(W, H);
    (this.mat.uniforms.res.value as THREE.Vector2).set(W, H);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: number, mode: CameraMode) {
    const target = mode === 'aim' ? 0.35 : mode === 'follow' ? 0.8 : 1.6;
    this.aperture += (target - this.aperture) * 0.08;
    this.time = (this.time + 1) % 1000;
    const u = this.mat.uniforms;
    u.focus.value = focus;
    u.aperture.value = this.aperture;
    u.time.value = this.time;
    (u.nf.value as THREE.Vector2).set(camera.near, camera.far);
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.pscene, this.ocam);
  }
}

/** Aplica l'estètica realista a una escena ja creada. Torna quan tot està carregat. */
export async function applyRealisme(gs: GameScene, quality: Quality = 'alta', escenari: EscenariId = 'vilanova'): Promise<void> {
  const { renderer, scene } = gs;
  const E = ESCENARIS[escenari];
  const ROT_Y = E.rotY, PHOTO_HEIGHT = E.photoHeight, SUN_IN_PHOTO = E.sunInPhoto;
  const tl = new THREE.TextureLoader();
  const pmrem = new THREE.PMREMGenerator(renderer);

  const [hdr, pano, tD, tN, tA, wD, wN, wA, fD, fN, fA] = await Promise.all([
    new RGBELoader().loadAsync(BASE + E.hdr),
    loadTex(tl, E.pano, true),
    loadTex(tl, E.groundDiffuse, true, 6),
    loadTex(tl, 'terra_nor_2k.jpg', false, 6),
    loadTex(tl, 'terra_arm_2k.jpg', false, 6),
    loadTex(tl, 'fusta_diffuse_1k.jpg', true),
    loadTex(tl, 'fusta_nor_1k.jpg', false),
    loadTex(tl, 'fusta_arm_1k.jpg', false),
    loadTex(tl, 'ferro_diffuse_512.jpg', true),
    loadTex(tl, 'ferro_nor_512.jpg', false),
    loadTex(tl, 'ferro_arm_512.jpg', false),
  ]);

  // ---- Llum: la foto il·lumina l'escena; el sol directe fa les ombres ----
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = E.exposure;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentRotation.set(0, ROT_Y, 0);
  scene.environmentIntensity = E.env;
  hdr.dispose();
  pmrem.dispose();
  gs.hemi.intensity = 0;
  const sunDir = SUN_IN_PHOTO.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ROT_Y).normalize();
  gs.sun.position.copy(sunDir.multiplyScalar(14)).add(new THREE.Vector3(0, 0, 2));
  gs.sun.target.position.set(0, 0, 2);
  gs.sun.color.set(0xfff0d8);
  gs.sun.intensity = E.sun;
  gs.sun.shadow.mapSize.set(quality === 'alta' ? 4096 : 1024, quality === 'alta' ? 4096 : 1024);
  Object.assign(gs.sun.shadow.camera, { left: -4, right: 4, top: 8, bottom: -8, near: 1, far: 40 });
  gs.sun.shadow.camera.updateProjectionMatrix();
  gs.sun.shadow.bias = -0.0002;
  gs.sun.shadow.normalBias = 0.02;

  // ---- Fons: la foto projectada sobre un terra pla ----
  pano.mapping = THREE.EquirectangularReflectionMapping;
  const sky = new GroundedSkybox(pano, PHOTO_HEIGHT, 70);
  sky.position.y = PHOTO_HEIGHT - 0.01;
  sky.rotation.y = ROT_Y;
  scene.add(sky);
  scene.background = null;
  scene.fog = null;

  // ---- Terra compactat que es fon amb el terra de la foto ----
  const groundMat = new THREE.MeshStandardMaterial({
    map: tD, normalMap: tN, roughnessMap: tA, aoMap: tA, roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(0.8, 0.8), alphaMap: fadeAlpha(), transparent: true, depthWrite: true,
  });
  // Les textures del terra es repeteixen cada 2 m; l'alfa (sense repetició) fon les vores amb la foto.
  const [gw, gl, gz] = E.ground;
  for (const t of [tD, tN, tA]) t.repeat.set(gw / 2, gl / 2);
  gs.ground.geometry.dispose();
  gs.ground.geometry = new THREE.PlaneGeometry(gw, gl);
  gs.ground.position.set(0, 0.001, gz);
  gs.ground.material = groundMat;

  // ---- Pista: línies de calç ----
  const chalk = chalkAlpha();
  if (E.lines === 'cordill') gs.laneFor = (d) => laneCordill(d);
  else gs.laneFor = (d) => {
    const mk = (w: number, l: number, x: number, z: number, along: boolean) => {
      const a = chalk.clone();
      a.repeat.set(1, along ? l / 2 : 1);
      if (!along) { a.rotation = Math.PI / 2; a.repeat.set(1, w / 2); }
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, l),
        new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 1, alphaMap: a, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.003, z);
      m.receiveShadow = true;
      return m;
    };
    return [
      mk(LANE_WIDTH, 0.05, 0, 0, false), mk(LANE_WIDTH, 0.06, 0, d, false),
      mk(0.05, 16.5, -LANE_WIDTH / 2, 16.5 / 2 - 3, true), mk(0.05, 16.5, LANE_WIDTH / 2, 16.5 / 2 - 3, true),
    ];
  };
  gs.setDistance(gs.distance);

  // ---- Bitlles d'alzina: cada una amb la veta desplaçada i un to lleugerament diferent ----
  // To mel envernissat, com els jocs nous de les fotos; cada bitlla una mica diferent.
  const tones = [0xf2c896, 0xe8bb88, 0xf5cf9f, 0xe3b27c, 0xf0c48e, 0xe9bf8c];
  const pinMats = tones.map((tone, i) => {
    const off = (t: THREE.Texture) => { const c = t.clone(); c.offset.set(i * 0.17, i * 0.31); c.repeat.set(0.6, 1.2); return c; };
    return new THREE.MeshPhysicalMaterial({
      map: off(wD), normalMap: off(wN), roughnessMap: off(wA), aoMap: off(wA), color: tone,
      roughness: 0.8, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45,
    });
  });
  gs.pinMatFor = (i) => pinMats[i % pinMats.length];
  const lathe = (p: [number, number][], seg: number) => new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  gs.pinGeo = lathe(pinProfileDetall(), 40);
  gs.clubGeo = lathe(clubProfileDetall(), 32);
  const paint = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  // Cap pintat (Vilanova): la part de dalt de la bitlla, de l'espatlla al cap, amb una capa de pintura.
  const headPts = pinProfileDetall().filter(([, y]) => y >= 0.37 && y < 0.51).map(([r, y]) => [r + 0.0007, y] as [number, number]);
  const headGeo = lathe([[0, 0.37], ...headPts, [0, 0.5107]], 40);
  const headPaint = paint(0xf2b705);
  // Anelles pintades al coll, com molts jocs reals: vermella i groga.
  const red = paint(0xb8322a), yellow = paint(0xe0b23a);
  const band = (y0: number, y1: number) => lathe([[0, y0], [0.0212, y0], [0.0212, y1], [0, y1]].map(([r, y]) => [r + (y > 0.4 ? 0 : 0.0006), y]) as [number, number][], 32);
  const bandRed = band(0.392, 0.402), bandYellow = band(0.404, 0.409);
  gs.decoratePin = (g) => {
    if (E.paint === 'cap') {
      const h = new THREE.Mesh(headGeo, headPaint);
      h.castShadow = true;
      g.add(h);
      return;
    }
    const a = new THREE.Mesh(bandRed, red), b = new THREE.Mesh(bandYellow, yellow);
    a.castShadow = b.castShadow = true;
    g.add(a, b);
  };
  gs.ringMat = new THREE.MeshStandardMaterial({ map: fD, normalMap: fN, roughnessMap: fA, metalnessMap: fA, roughness: 1, metalness: 1 });

  // ---- Bitllots: la mateixa fusta, tenyida segons el tipus ----
  gs.clubMatFor = (color) => {
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(color), 0.45);
    return new THREE.MeshPhysicalMaterial({ map: wD, normalMap: wN, roughnessMap: wA, color: tint, roughness: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  };

  // ---- Còdols ----
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebbles = new THREE.InstancedMesh(pebbleGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), quality === 'alta' ? E.pebbles : Math.round(E.pebbles / 3));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const palette = [0x9a8f84, 0x7d7268, 0xb5aa9c, 0x6b5f55, 0xc4b8a8];
  for (let i = 0; i < pebbles.count; i++) {
    const x = (Math.random() - 0.5) * 4.2, z = -2 + Math.random() * 15;
    if (Math.abs(x) < 0.35 && z > -0.35 && z < 0.12) { i--; continue; } // ni sota les bitlles
    const s = 0.003 + Math.pow(Math.random(), 4) * 0.02;
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    m4.compose(new THREE.Vector3(x, s * 0.2, z), q.setFromEuler(e), new THREE.Vector3(s * (1 + Math.random() * 0.6), s * 0.55, s));
    pebbles.setMatrixAt(i, m4);
    pebbles.setColorAt(i, col.setHex(palette[i % palette.length]));
  }
  pebbles.castShadow = pebbles.receiveShadow = true;
  scene.add(pebbles);

  // ---- Ombra de contacte: taca fosca i difusa sota cada bitlla dreta ----
  const blob = new THREE.MeshBasicMaterial({ map: dustSprite(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const blobs = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), blob.clone());
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    scene.add(m);
    return m;
  });
  gs.afterSync = (pins) => {
    pins.forEach((p, i) => {
      const m = blobs[i];
      m.visible = !!p;
      if (!p) return;
      // Com més dreta, més concentrada; estirada, l'ombra la fa el sol.
      const up = 1 - 2 * (p.q.x * p.q.x + p.q.z * p.q.z);
      m.position.set(p.x, 0.004, p.z);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.max(0, up) * Math.max(0, 1 - p.y * 8);
    });
  };

  // ---- Pols quan cau una bitlla ----
  const sprite = dustSprite();
  const puffs: { pts: THREE.Points; vel: Float32Array; age: number }[] = [];
  gs.onKnockDown = (x, z) => {
    const n = 26;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.2 + Math.random() * 0.5;
      pos.set([x + Math.cos(a) * 0.1, 0.03, z + Math.sin(a) * 0.1], i * 3);
      vel.set([Math.cos(a) * s, 0.15 + Math.random() * 0.35, Math.sin(a) * s], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: sprite, color: 0xc9b9a3, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(pts);
    puffs.push({ pts, vel, age: 0 });
  };
  gs.tickers.push((dt) => {
    for (let k = puffs.length - 1; k >= 0; k--) {
      const p = puffs[k];
      p.age += dt;
      const attr = p.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        p.vel[i * 3] *= 0.96; p.vel[i * 3 + 1] = p.vel[i * 3 + 1] * 0.96 - 0.05 * dt; p.vel[i * 3 + 2] *= 0.96;
        attr.setXYZ(i, attr.getX(i) + p.vel[i * 3] * dt, Math.max(0.01, attr.getY(i) + p.vel[i * 3 + 1] * dt), attr.getZ(i) + p.vel[i * 3 + 2] * dt);
      }
      attr.needsUpdate = true;
      const mat = p.pts.material as THREE.PointsMaterial;
      mat.opacity = 0.55 * Math.max(0, 1 - p.age / 1.6);
      mat.size = 0.12 + p.age * 0.12;
      if (p.age > 1.6) { scene.remove(p.pts); p.pts.geometry.dispose(); mat.dispose(); puffs.splice(k, 1); }
    }
  });

  // ---- Entorn modelat de l'escenari ----
  if (escenari === 'vilanova') {
    const { buildVilanova } = await import('./escenari-vilanova');
    buildVilanova(scene, { pinGeo: gs.pinGeo, pinMat: pinMats[2], ringMat: gs.ringMat, paint, lathe, headGeo, quality });
  }

  // ---- Postprocessat de càmera ----
  if (quality === 'alta') {
    gs.post = new CameraPost();
    const size = renderer.getSize(new THREE.Vector2());
    gs.post.resize(size.x, size.y, renderer.getPixelRatio());
  }
}
