// Render amb three.js. Només llegeix estats de la física; no en decideix res.
// Per defecte és el gris (greybox). Una estètica (p. ex. `look-realisme.ts`) substitueix materials,
// pista, llum i postprocessat a través dels ganxos públics d'aquesta classe, sense tocar regles ni física.
import * as THREE from 'three';
import { CLUB_PROFILE, LANE_WIDTH, PIN_PROFILE } from './constants';
import type { BodyState } from './physics';

const lathe = (profile: ReadonlyArray<readonly [number, number]>, seg: number) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export const COLORS = {
  sky: 0xdfe3e6,
  ground: 0xcfc6b8,
  lane: 0xc2b6a3,
  line: 0xf7f4ee,
  pin: 0xf4f1ea,
  ring: 0x3a3a3a,
  gold: 0xf2b630,
  aim: 0xf2b630,
  danger: 0xe0533b,
};

const TRAIL_MAX = 90;
const GUIDE_DOTS = 44;
/** Colors de la guia segons on cau el bitllot. */
export const ZONA_COLOR = { curt: 0x7fb2ff, be: 0x3ecf6e, llarg: 0xff6a4a } as const;
export type Zona = keyof typeof ZONA_COLOR;
type P3 = { x: number; y: number; z: number };

export type CameraMode = 'aim' | 'follow' | 'pins';

/** Postprocessat opcional (el defineix l'estètica). */
export interface PostFX {
  resize(w: number, h: number, dpr: number): void;
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: number, mode: CameraMode): void;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Geometria visual (l'estètica la pot detallar; la física fa servir el perfil de `constants`). */
  pinGeo: THREE.BufferGeometry = lathe(PIN_PROFILE, 28);
  clubGeo: THREE.BufferGeometry = lathe(CLUB_PROFILE, 24);
  pinMat = new THREE.MeshStandardMaterial({ color: COLORS.pin, roughness: 0.6 });
  ringMat: THREE.Material = new THREE.MeshStandardMaterial({ color: COLORS.ring, roughness: 0.5, metalness: 0.4 });
  // ---- Ganxos per a l'estètica ----
  /** Material de cada bitlla (permet variar-les una a una). */
  pinMatFor: (i: number) => THREE.Material = () => this.pinMat;
  /** Material d'un bitllot del color del seu tipus. */
  clubMatFor: (color: number) => THREE.Material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  /** Pista: superfície i línies per a una distància de llançament. */
  laneFor: (d: number) => THREE.Object3D[] = (d) => this.greyLane(d);
  /** Detalls afegits a cada bitlla (anelles pintades...). */
  decoratePin: (g: THREE.Group, i: number) => void = () => {};
  /** Quan una bitlla passa a estar tombada (pols, so...). */
  onKnockDown: (x: number, z: number) => void = () => {};
  /** Després de moure les bitlles (ombres de contacte...). */
  afterSync: (pins: (BodyState | null)[]) => void = () => {};
  /** Coses que s'animen cada fotograma (partícules...). */
  tickers: ((dt: number) => void)[] = [];
  post: PostFX | null = null;
  ground: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  mode: CameraMode = 'aim';
  private prevDown: boolean[] = [];
  private pinMeshes: THREE.Group[] = [];
  private clubMeshes: THREE.Mesh[] = [];
  private lines: THREE.Object3D[] = [];
  private pubillaRing: THREE.Mesh;
  private crown: THREE.Mesh;
  private landing: THREE.Mesh;
  private arc: THREE.Line;
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  // Guia de llançament: punts del vol (com Angry Birds), punts a terra, anelles a les bitlles que tocaria.
  private guide: THREE.InstancedMesh;
  private guideMat = new THREE.MeshBasicMaterial({ color: ZONA_COLOR.be, transparent: true, opacity: 0.95, depthWrite: false });
  private pinRings: THREE.Mesh[] = [];
  // Bitllot a la mà: escena superposada (sense profunditat de camp) que segueix el dit.
  private overlay = new THREE.Scene();
  private hand: THREE.Mesh;
  private handOn = false;
  private handSpin = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  distance = 9.5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 14, 40);

    const hemi = (this.hemi = new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.4));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2.2));
    sun.position.set(-4, 9, 3);
    sun.target.position.set(0, 0, -0.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
    sun.shadow.bias = -0.0004;
    this.scene.add(hemi, sun, sun.target);

    const ground = (this.ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 })));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const ringGeo = new THREE.RingGeometry(0.075, 0.1, 40);
    this.pubillaRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.95 }));
    this.pubillaRing.rotation.x = -Math.PI / 2;
    this.crown = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 5), new THREE.MeshBasicMaterial({ color: COLORS.gold }));
    this.crown.rotation.x = Math.PI;
    this.scene.add(this.pubillaRing, this.crown);

    this.landing = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 32), new THREE.MeshBasicMaterial({ color: COLORS.aim, transparent: true, opacity: 0.9, depthWrite: false }));
    this.landing.rotation.x = -Math.PI / 2;
    this.landing.visible = false;
    this.arc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: COLORS.aim, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.85 }));
    this.arc.visible = false;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trailGeo.setDrawRange(0, 0);
    this.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    this.trail.frustumCulled = false;
    this.scene.add(this.landing, this.arc, this.trail);

    this.guide = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), this.guideMat, GUIDE_DOTS);
    this.guide.frustumCulled = false;
    this.guide.count = 0;
    this.guide.renderOrder = 2;
    this.scene.add(this.guide);
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.scene.add(r);
      this.pinRings.push(r);
    }
    this.hand = new THREE.Mesh(this.clubGeo, new THREE.MeshStandardMaterial({ color: 0xc99a62, roughness: 0.6 }));
    this.hand.visible = false;
    this.overlay.add(this.hand, new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2);
    key.position.set(-1, 2, 1);
    this.overlay.add(key);
    this.setDistance(this.distance);
  }

  /** Pista: 2 m d'ample, línia de llançament a `distance`, línia de plantada a z = 0. */
  setDistance(d: number) {
    this.distance = d;
    for (const l of this.lines) this.scene.remove(l);
    this.lines = this.laneFor(d);
    for (const l of this.lines) this.scene.add(l);
  }

  private greyLane(d: number): THREE.Object3D[] {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH, 16.5), new THREE.MeshStandardMaterial({ color: COLORS.lane, roughness: 1 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.001, 16.5 / 2 - 3);
    lane.receiveShadow = true;
    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.line });
    const mk = (w: number, l: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.002, z); return m;
    };
    return [lane, mk(LANE_WIDTH, 0.04, 0, 0), mk(LANE_WIDTH, 0.05, 0, d), mk(0.03, 16.5, -LANE_WIDTH / 2, 16.5 / 2 - 3), mk(0.03, 16.5, LANE_WIDTH / 2, 16.5 / 2 - 3)];
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.post?.resize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Crea les malles de les bitlles. `present[i] = false` amaga la bitlla (ja tombada al tutorial). */
  plant(present: boolean[]) {
    for (const g of this.pinMeshes) this.scene.remove(g);
    for (const c of this.clubMeshes) this.scene.remove(c);
    this.pinMeshes = [];
    this.clubMeshes = [];
    this.trailPts = [];
    this.trail.geometry.setDrawRange(0, 0);
    this.prevDown = present.map((p) => !p);
    present.forEach((p, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.pinGeo, this.pinMatFor(i));
      body.castShadow = body.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0465, 0.0465, 0.022, 28), this.ringMat);
      ring.position.y = 0.012;
      ring.castShadow = true;
      g.add(body, ring);
      this.decoratePin(g, i);
      g.visible = p;
      this.scene.add(g);
      this.pinMeshes.push(g);
    });
  }

  addClub(color: number) {
    const m = new THREE.Mesh(this.clubGeo, this.clubMatFor(color));
    m.castShadow = true;
    this.scene.add(m);
    this.clubMeshes.push(m);
    this.trailPts = [];
  }

  sync(pins: (BodyState | null)[], clubs: BodyState[], pubilla: number | null, down: boolean[], t: number) {
    pins.forEach((s, i) => {
      const g = this.pinMeshes[i];
      if (!g || !s) return;
      g.position.set(s.x, s.y, s.z);
      g.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w);
    });
    clubs.forEach((s, i) => {
      const m = this.clubMeshes[i];
      if (!m) return;
      m.position.set(s.x, s.y, s.z);
      m.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w);
    });
    down.forEach((d, i) => {
      if (d && !this.prevDown[i] && pins[i]) this.onKnockDown(pins[i]!.x, pins[i]!.z);
    });
    this.prevDown = [...down];
    this.afterSync(pins);
    const last = clubs[clubs.length - 1];
    if (last && last.y > 0.05 && last.z > -3) {
      this.trailPts.push(new THREE.Vector3(last.x, last.y, last.z));
      if (this.trailPts.length > TRAIL_MAX) this.trailPts.shift();
      const attr = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      this.trailPts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
      attr.needsUpdate = true;
      this.trail.geometry.setDrawRange(0, this.trailPts.length);
    }
    const ps = pubilla !== null ? pins[pubilla] : null;
    const show = !!ps && !down[pubilla!];
    this.pubillaRing.visible = !!ps;
    this.crown.visible = show;
    if (ps) {
      this.pubillaRing.position.set(ps.x, 0.004, ps.z);
      (this.pubillaRing.material as THREE.MeshBasicMaterial).color.setHex(down[pubilla!] ? COLORS.danger : COLORS.gold);
      this.crown.position.set(ps.x, ps.y + 0.62 + Math.sin(t * 3) * 0.02, ps.z);
      this.crown.rotation.y = t;
    }
  }

  /**
   * Guia del gest: punts al llarg del vol previst (amb l'efecte), punts a terra fins on lliscaria,
   * color segons la zona de caiguda i anelles a les bitlles que tocaria. `fade` l'atenua (després de llançar).
   */
  showGuide(g: { vol: P3[]; terra: P3; zona: Zona; toca: boolean[] } | null, fade = false) {
    if (!g) { this.guide.count = 0; this.pinRings.forEach((r) => (r.visible = false)); this.landing.visible = false; this.arc.visible = false; return; }
    this.arc.visible = false;
    const m = new THREE.Matrix4();
    const pts: P3[] = [];
    const step = Math.max(1, Math.floor(g.vol.length / 30));
    // Només la baixada (l'últim 45% del vol): la pujada surt per dalt de la pantalla i tapa les bitlles.
    const inici = Math.floor(g.vol.length * 0.55);
    for (let i = inici; i < g.vol.length; i += step) pts.push(g.vol[i]);
    const last = g.vol[g.vol.length - 1];
    for (let k = 1; k <= 8; k++) pts.push({ x: last.x + ((g.terra.x - last.x) * k) / 8, y: 0.02, z: last.z + ((g.terra.z - last.z) * k) / 8 });
    const n = Math.min(GUIDE_DOTS, pts.length);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const r = (p.y <= 0.03 ? 0.02 : 0.024) * (1 - (i / n) * 0.3);
      m.makeScale(r, p.y <= 0.03 ? r * 0.4 : r, r).setPosition(p.x, Math.max(0.012, p.y), p.z);
      this.guide.setMatrixAt(i, m);
    }
    this.guide.count = n;
    this.guide.instanceMatrix.needsUpdate = true;
    this.guideMat.color.setHex(ZONA_COLOR[g.zona]);
    this.guideMat.opacity = fade ? 0.3 : 0.95;
    this.landing.visible = !fade;
    this.landing.position.set(last.x, 0.006, last.z);
    (this.landing.material as THREE.MeshBasicMaterial).color.setHex(ZONA_COLOR[g.zona]);
    this.pinRings.forEach((r, i) => {
      const pin = this.pinMeshes[i];
      r.visible = !fade && !!g.toca[i] && !!pin?.visible;
      if (pin) r.position.set(pin.position.x, 0.007, pin.position.z);
    });
  }

  /** Bitllot a la mà: segueix el dit (coordenades de pantalla normalitzades -1..1), s'inclina amb la punteria i gira amb l'efecte. */
  showHand(h: { nx: number; ny: number; aim: number; spin: number; power: number; color: number } | null) {
    this.handOn = !!h;
    this.hand.visible = !!h;
    if (!h) return;
    (this.hand.material as THREE.MeshStandardMaterial).color.setHex(h.color);
    // Distància perquè el bitllot (28 cm) ocupi ~20% de l'alçada de pantalla, sigui quin sigui el camp de visió.
    const dist = 0.28 / (0.2 * 2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const v = new THREE.Vector3(h.nx, h.ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    this.hand.position.copy(this.camera.position).addScaledVector(v, dist);
    this.handSpin += h.spin * 0.35;
    // Agafat pel mànec (a baix, sota el dit) amb la part ampla amunt; s'inclina amb la punteria i es tira enrere amb la força.
    const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI + 0.25 + h.power * 0.45, this.handSpin, h.aim * 0.6, 'XZY'));
    this.hand.quaternion.copy(this.camera.quaternion).multiply(local);
    this.hand.scale.setScalar(1 + h.power * 0.15);
  }

  /** Previsió del gest: anella on cau el bitllot i arc discontinu. */
  showAim(landing: { x: number; z: number } | null, from?: { x: number; y: number; z: number }) {
    this.landing.visible = !!landing;
    this.arc.visible = !!landing;
    if (!landing || !from) return;
    this.landing.position.set(landing.x, 0.006, landing.z);
    const pts: THREE.Vector3[] = [];
    const peak = Math.min(1.8, 0.4 + (from.z - landing.z) * 0.12);
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push(new THREE.Vector3(from.x + (landing.x - from.x) * t, from.y * (1 - t) + Math.sin(t * Math.PI) * peak, from.z + (landing.z - from.z) * t));
    }
    this.arc.geometry.setFromPoints(pts);
    this.arc.computeLineDistances();
  }

  /** Càmera: `aim` darrere la línia, `follow` darrere del bitllot, `pins` a prop de la plantada. */
  updateCamera(mode: CameraMode, club: BodyState | undefined, dt: number, snap = false) {
    this.mode = mode;
    const d = this.distance;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3(0, 0.22, -0.1);
    if (mode === 'aim') { pos.set(0, 2.1, d + 1.0); look.set(0, 0.05, Math.min(1.2, d * 0.12)); }
    else if (mode === 'follow' && club) {
      pos.set(club.x * 0.6, Math.max(0.9, club.y + 0.55), Math.max(2.1, club.z + 2.4));
      look.set(club.x * 0.3, 0.2, Math.min(club.z - 3, -0.1));
    } else pos.set(0.55, 0.95, 2.0);
    const k = snap ? 1 : 1 - Math.exp(-dt * (mode === 'follow' ? 6 : 3));
    // A l'hora d'apuntar, més teleobjectiu com més lluny: les bitlles s'han de veure bé a 11,5 m.
    const fov = mode === 'aim' ? Math.max(22, 40 - d * 1.6) : 36;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Posició a pantalla (px) d'un punt del món, per al transportador de 45°. */
  project(x: number, y: number, z: number, w: number, h: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
  }

  render(dt = 0) {
    for (const t of this.tickers) t(dt);
    if (this.post) {
      const focus = this.camera.position.distanceTo(new THREE.Vector3(0, 0.25, -0.08));
      this.post.render(this.renderer, this.scene, this.camera, focus, this.mode);
    } else this.renderer.render(this.scene, this.camera);
    if (this.handOn) {
      // El bitllot a la mà es dibuixa a sobre, nítid, amb la mateixa llum d'entorn.
      this.overlay.environment = this.scene.environment;
      this.hand.geometry = this.clubGeo;
      const auto = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.overlay, this.camera);
      this.renderer.autoClear = auto;
    }
  }
}
