// Física de la pista amb Rapier. No depèn de three.js ni del DOM: es fa servir igual al navegador i als tests.
import RAPIER from '@dimforge/rapier3d-compat';
import { CLUB_PROFILE, GRAVITY, PIN_DENSITY, PIN_LAYOUT, PIN_PROFILE } from './constants';
import { isKnocked, tiltFromVertical, type BitllotSpec, type Quat } from './rules';

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export const STEP = 1 / 120;
const RELEASE_HEIGHT = 0.7;

/** Gest del jugador, normalitzat. */
export type ThrowInput = {
  /** -1 (esquerra) a 1 (dreta). */
  aim: number;
  /** 0 a 1: on cau el bitllot (curt → llarg). */
  power: number;
  /** -1 a 1: efecte. Corba la trajectòria i fa girar el bitllot. */
  spin: number;
};

export type BodyState = { x: number; y: number; z: number; q: Quat };

function lathePoints(profile: ReadonlyArray<readonly [number, number]>, seg = 14): Float32Array {
  const out: number[] = [];
  for (const [r, y] of profile) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      out.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  return new Float32Array(out);
}
const PIN_HULL = lathePoints(PIN_PROFILE);
const CLUB_HULL = lathePoints(CLUB_PROFILE);

/** Paràmetres de llançament derivats del gest (purs, testejables). */
export function launchFromInput(input: ThrowInput, distance: number, spec: Pick<BitllotSpec, 'aimScale' | 'spinScale'>) {
  const power = Math.max(0, Math.min(1, input.power));
  const aim = Math.max(-1, Math.min(1, input.aim));
  const spin = Math.max(-1, Math.min(1, input.spin)) * spec.spinScale;
  const range = distance * (0.6 + 0.55 * power); // on toca terra per primer cop
  const speed = 5.5 + 3.5 * power;
  const angle = aim * 0.16 * spec.aimScale;
  const t = range / speed;
  const vy = (-GRAVITY * t * t * 0.5 - RELEASE_HEIGHT) / t;
  // La corba de l'efecte es compensa perquè la punteria indiqui on arriba el bitllot si no hi hagués efecte.
  const curveAccel = -spin * 0.9;
  return {
    position: { x: 0, y: RELEASE_HEIGHT, z: distance },
    velocity: { x: Math.sin(angle) * speed, y: vy, z: -Math.cos(angle) * speed },
    angular: { x: 0, y: 7 + spin * 16, z: 0 },
    curveAccel,
    landing: { x: Math.sin(angle) * range + 0.5 * curveAccel * t * t, z: distance - Math.cos(angle) * range },
    flightTime: t,
  };
}

export class Field {
  readonly world: RAPIER.World;
  readonly pins: (RAPIER.RigidBody | null)[] = [];
  readonly clubs: { body: RAPIER.RigidBody; spec: BitllotSpec; curve: number; airborne: boolean }[] = [];
  wind = 0;
  time = 0;
  private throwTime = 0;

  constructor(public distance: number) {
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.world.timestep = STEP;
    const ground = RAPIER.ColliderDesc.cuboid(20, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.7).setRestitution(0.15);
    this.world.createCollider(ground);
  }

  /** Planta les bitlles. `present[i] = false` vol dir que la bitlla ja està tombada (tutorials). */
  plant(present: boolean[] = [true, true, true, true, true, true]) {
    for (const p of this.pins) if (p) this.world.removeRigidBody(p);
    for (const c of this.clubs) this.world.removeRigidBody(c.body);
    this.pins.length = 0;
    this.clubs.length = 0;
    PIN_LAYOUT.forEach(([x, z], i) => {
      if (!present[i]) { this.pins.push(null); return; }
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.0005, z).setCcdEnabled(true).setLinearDamping(0.05).setAngularDamping(0.25),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.convexHull(PIN_HULL)!.setDensity(PIN_DENSITY).setFriction(0.5).setRestitution(0.2),
        body,
      );
      body.sleep();
      this.pins.push(body);
    });
  }

  throwClub(input: ThrowInput, spec: BitllotSpec) {
    const l = launchFromInput(input, this.distance, spec);
    // Bitllot pla: l'eix llarg horitzontal i perpendicular a la direcció del vol.
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(l.position.x, l.position.y, l.position.z)
        .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        .setCcdEnabled(true)
        .setAngularDamping(0.1),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.convexHull(CLUB_HULL)!.setDensity(spec.density).setFriction(spec.friction).setRestitution(spec.restitution),
      body,
    );
    body.setLinvel(l.velocity, true);
    body.setAngvel(l.angular, true);
    this.clubs.push({ body, spec, curve: l.curveAccel, airborne: true });
    this.throwTime = this.time;
    return body;
  }

  step() {
    for (const c of this.clubs) {
      if (!c.airborne) continue;
      const p = c.body.translation();
      if (p.y < 0.09 && this.time - this.throwTime > 0.1) { c.airborne = false; continue; }
      const m = c.body.mass();
      c.body.applyImpulse({ x: (c.curve + this.wind) * m * STEP, y: 0, z: 0 }, true);
    }
    this.world.step();
    this.time += STEP;
  }

  pinStates(): (BodyState | null)[] {
    return this.pins.map((b) => {
      if (!b) return null;
      const t = b.translation();
      const r = b.rotation();
      return { x: t.x, y: t.y, z: t.z, q: { x: r.x, y: r.y, z: r.z, w: r.w } };
    });
  }

  clubStates(): BodyState[] {
    return this.clubs.map(({ body }) => {
      const t = body.translation();
      const r = body.rotation();
      return { x: t.x, y: t.y, z: t.z, q: { x: r.x, y: r.y, z: r.z, w: r.w } };
    });
  }

  /** Quines bitlles estan tombades (les absents compten com a tombades). */
  down(): boolean[] {
    return this.pins.map((b) => (b ? isKnocked(b.rotation()) : true));
  }

  tilts(): number[] {
    return this.pins.map((b) => (b ? tiltFromVertical(b.rotation()) : 90));
  }

  /** Tot quiet, o massa temps des del llançament. */
  settled(): boolean {
    const since = this.time - this.throwTime;
    if (since > 6) return true;
    if (since < 0.6) return false;
    const quiet = (b: RAPIER.RigidBody) => {
      if (b.isSleeping()) return true;
      const v = b.linvel();
      const w = b.angvel();
      return Math.hypot(v.x, v.y, v.z) < 0.04 && Math.hypot(w.x, w.y, w.z) < 0.15;
    };
    return this.pins.every((b) => !b || quiet(b)) && this.clubs.every((c) => quiet(c.body) || c.body.translation().y < -1);
  }

  free() {
    this.world.free();
  }
}

/** Simula una tirada sencera sense render (tests i ajust de dificultat). */
export function simulateThrows(
  distance: number,
  throws: { input: ThrowInput; spec: BitllotSpec }[],
  opts: { present?: boolean[]; wind?: number } = {},
): boolean[][] {
  const f = new Field(distance);
  f.wind = opts.wind ?? 0;
  f.plant(opts.present);
  const after: boolean[][] = [];
  for (const t of throws) {
    f.throwClub(t.input, t.spec);
    let n = 0;
    do { f.step(); n++; } while (!f.settled() && n < 120 * 8);
    after.push(f.down());
  }
  f.free();
  return after;
}
