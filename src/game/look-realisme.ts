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

/** Direcció del sol dins la foto (calculada del píxel més brillant) i gir per tenir-lo a l'esquerra del tirador. */
const SUN_IN_PHOTO = new THREE.Vector3(0.578, 0.625, 0.524);
const ROT_Y = -2.04;
/** Alçada aproximada de la càmera que va fer la foto: fixa l'escala del terra projectat. */
const PHOTO_HEIGHT = 1.7;

function loadTex(loader: THREE.TextureLoader, file: string, srgb: boolean, repeat = 1) {
  return loader.loadAsync(BASE + file).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
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
export async function applyRealisme(gs: GameScene, quality: Quality = 'alta'): Promise<void> {
  const { renderer, scene } = gs;
  const tl = new THREE.TextureLoader();
  const pmrem = new THREE.PMREMGenerator(renderer);

  const [hdr, pano, tD, tN, tA, wD, wN, wA, fD, fN, fA] = await Promise.all([
    new RGBELoader().loadAsync(BASE + 'entorn_1k.hdr'),
    loadTex(tl, 'entorn_4k.jpg', true),
    loadTex(tl, 'terra_diffuse_2k.jpg', true, 6),
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
  renderer.toneMappingExposure = 1.05;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentRotation.set(0, ROT_Y, 0);
  scene.environmentIntensity = 0.75;
  hdr.dispose();
  pmrem.dispose();
  gs.hemi.intensity = 0;
  const sunDir = SUN_IN_PHOTO.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ROT_Y).normalize();
  gs.sun.position.copy(sunDir.multiplyScalar(14)).add(new THREE.Vector3(0, 0, 2));
  gs.sun.target.position.set(0, 0, 2);
  gs.sun.color.set(0xfff0d8);
  gs.sun.intensity = 3.6;
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
  for (const t of [tD, tN, tA]) t.repeat.set(6, 12);
  gs.ground.geometry.dispose();
  gs.ground.geometry = new THREE.PlaneGeometry(12, 24);
  gs.ground.position.set(0, 0.001, 3);
  gs.ground.material = groundMat;

  // ---- Pista: línies de calç ----
  const chalk = chalkAlpha();
  gs.laneFor = (d) => {
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
  const tones = [0xffffff, 0xf3e9dc, 0xfaf0e4, 0xeee2d2, 0xfff6ea, 0xf0e4d6];
  const pinMats = tones.map((tone, i) => {
    const off = (t: THREE.Texture) => { const c = t.clone(); c.offset.set(i * 0.17, i * 0.31); c.repeat.set(0.6, 1.2); return c; };
    return new THREE.MeshPhysicalMaterial({
      map: off(wD), normalMap: off(wN), roughnessMap: off(wA), aoMap: off(wA), color: tone,
      roughness: 0.85, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6,
    });
  });
  gs.pinMatFor = (i) => pinMats[i % pinMats.length];
  gs.ringMat = new THREE.MeshStandardMaterial({ map: fD, normalMap: fN, roughnessMap: fA, metalnessMap: fA, roughness: 1, metalness: 1 });

  // ---- Bitllots: la mateixa fusta, tenyida segons el tipus ----
  gs.clubMatFor = (color) => {
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(color), 0.45);
    return new THREE.MeshPhysicalMaterial({ map: wD, normalMap: wN, roughnessMap: wA, color: tint, roughness: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  };

  // ---- Còdols ----
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebbles = new THREE.InstancedMesh(pebbleGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), quality === 'alta' ? 900 : 300);
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

  // ---- Postprocessat de càmera ----
  if (quality === 'alta') {
    gs.post = new CameraPost();
    const size = renderer.getSize(new THREE.Vector2());
    gs.post.resize(size.x, size.y, renderer.getPixelRatio());
  }
}
