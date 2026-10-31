// Lliçons del tutorial. Cada lliçó és una tirada preparada amb un objectiu concret.
import type { BitllotKind } from './rules';
import type { ThrowInput } from './physics';

export type LessonCheck = (s: { down: boolean[]; startDown: boolean[]; pubilla: number | null; inputs: ThrowInput[] }) => boolean;

export type Lesson = {
  id: string;
  title: string;
  /** Text abans de jugar. */
  intro: string;
  /** Recordatori curt mentre jugues. */
  goal: string;
  distance: number;
  present: boolean[];
  pubilla: number | null;
  bitllots: BitllotKind[];
  /** Mostra la mà fantasma fent el gest. */
  ghost?: 'straight' | 'angle' | 'curve';
  /** Lliçó sense tirada: només explicació (amb il·lustració). */
  explainOnly?: 'tria' | 'angle';
  check: LessonCheck;
  success: string;
  fail: string;
};

const ALL = [true, true, true, true, true, true];
const newlyDown = (s: Parameters<LessonCheck>[0]) => s.down.filter((d, i) => d && !s.startDown[i]).length;

export const LESSONS: Lesson[] = [
  {
    id: 'llanca',
    title: 'Llança',
    intro: 'Posa el dit a la part de baix de la pantalla, arrossega\'l cap amunt i deixa anar. Com més llarg és el gest, més lluny arriba el bitllot. L\'anella groga et mostra on caurà.',
    goal: 'Tomba almenys una bitlla',
    distance: 6.5,
    present: ALL,
    pubilla: null,
    bitllots: ['cinta', 'cinta', 'cinta'],
    ghost: 'straight',
    check: (s) => newlyDown(s) >= 1,
    success: 'Molt bé! Ja saps llançar.',
    fail: 'Cap bitlla. Fes el gest més llarg o més curt fins que l\'anella caigui just davant de les bitlles.',
  },
  {
    id: 'apunta',
    title: 'Apunta',
    intro: 'Inclina el gest cap a un costat per apuntar. Ara només queden les bitlles de la dreta.',
    goal: 'Tomba les dues bitlles de la dreta',
    distance: 6.5,
    present: [false, false, true, false, false, true],
    pubilla: null,
    bitllots: ['cinta', 'cinta', 'cinta'],
    ghost: 'angle',
    check: (s) => s.down[2] && s.down[5],
    success: 'Punteria fina!',
    fail: 'Encara en queda alguna. Inclina més el gest cap a la dreta.',
  },
  {
    id: 'efecte',
    title: 'L\'efecte',
    intro: 'Si el gest fa una corba, el bitllot surt girant i es desvia cap al costat on acaba la corba. Serveix per arribar a bitlles amagades darrere d\'altres.',
    goal: 'Llança amb efecte i tomba la bitlla de l\'esquerra',
    distance: 6.5,
    present: [false, false, false, true, false, false],
    pubilla: null,
    bitllots: ['torcat', 'torcat', 'torcat'],
    ghost: 'curve',
    check: (s) => s.down[3] && s.inputs.some((i) => Math.abs(i.spin) > 0.3),
    success: 'Això és efecte!',
    fail: 'Fes el gest en forma de C: comença recte, corba cap a la dreta i acaba cap a l\'esquerra.',
  },
  {
    id: 'bitlla',
    title: 'Fes bitlla',
    intro: 'La clau del joc: tombar-ne cinc i deixar-ne una dreta val 10 punts. Tombar-les totes sis només en val 6. Ja n\'hi ha tres de tombades: tomba\'n dues més i deixa\'n una.',
    goal: 'Deixa exactament una bitlla dreta',
    distance: 8,
    present: [true, true, false, false, true, false],
    pubilla: null,
    bitllots: ['cinta', 'cinta', 'cinta'],
    check: (s) => s.down.filter(Boolean).length === 5,
    success: 'BITLLA! 10 punts.',
    fail: 'No ha quedat exactament una bitlla dreta. Precisió, no força.',
  },
  {
    id: 'pubilla',
    title: 'La pubilla',
    intro: 'A cada tirada hi ha una bitlla coronada: la pubilla. Si fas bitlla i la que queda dreta és ella, és una bitlla d\'or i val el doble.',
    goal: 'Tomba les del mig i deixa la pubilla dreta',
    distance: 8,
    present: [false, true, true, false, true, false],
    pubilla: 2,
    bitllots: ['cinta', 'cinta', 'cinta'],
    check: (s) => s.down.filter(Boolean).length === 5 && !s.down[2],
    success: 'BITLLA D\'OR! 20 punts.',
    fail: 'La pubilla ha de quedar dreta i la resta, tombades.',
  },
  {
    id: 'tria',
    title: 'Tria 3 de 4',
    intro: 'Com al reglament, portes quatre bitllots a la pista i en llances tres. A cada ronda tries quin deixes a la banqueta.',
    goal: '',
    distance: 8,
    present: ALL,
    pubilla: null,
    bitllots: [],
    explainOnly: 'tria',
    check: () => true,
    success: '',
    fail: '',
  },
  {
    id: 'angle',
    title: 'La regla dels 45°',
    intro: 'Una bitlla compta com a tombada quan queda inclinada menys de 45° respecte al terra. Si una bitlla tentineja a prop del límit, el temps s\'alenteix: aguanta la respiració.',
    goal: '',
    distance: 8,
    present: ALL,
    pubilla: null,
    bitllots: [],
    explainOnly: 'angle',
    check: () => true,
    success: '',
    fail: '',
  },
];
