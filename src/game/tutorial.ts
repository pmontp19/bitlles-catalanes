// "Aprèn a jugar": tutorial de la MECÀNICA del joc (controls i sistemes propis de Bitlla!).
// Les regles del reglament real s'expliquen a part, al llibret de `regles.ts`.
import type { BitllotKind } from './rules';
import type { ThrowInput } from './physics';

export type LessonCheck = (s: {
  down: boolean[];
  startDown: boolean[];
  pubilla: number | null;
  inputs: ThrowInput[];
  /** Tipus de bitllot llançat a cada intent. */
  kinds: BitllotKind[];
}) => boolean;

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
  /** Assenyala el bastidor de bitllots. */
  pointRack?: boolean;
  /** S'avalua després del primer llançament i s'acaba. */
  oneShot?: boolean;
  /** Lliçó sense tirada: només explicació (amb il·lustració). */
  explainOnly?: 'tria';
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
    id: 'bitllot',
    title: 'Tria el bitllot',
    intro: 'A baix tens el bastidor amb els bitllots de la tirada. Cada un es comporta diferent: l\'alzina pesa i arrasa, el boix és lleuger i rebota, el de cinta dona més control i el torçat fa més efecte. Toca\'n un per triar-lo abans de llançar.',
    goal: 'Tria el boix al bastidor i llança\'l',
    distance: 8,
    present: ALL,
    pubilla: null,
    bitllots: ['alzina', 'boix', 'cinta'],
    pointRack: true,
    oneShot: true,
    check: (s) => s.kinds[0] === 'boix',
    success: 'Ja saps canviar de bitllot.',
    fail: 'Has llançat un altre bitllot. Abans de llançar, toca el de boix al bastidor de baix.',
  },
  {
    id: 'deixan-una',
    title: 'Deixa\'n una',
    intro: 'Al reglament, tombar-ne cinc i deixar-ne una dreta val més que tombar-les totes. Ja n\'hi ha tres de tombades: tomba\'n dues més amb precisió.',
    goal: 'Deixa exactament una bitlla dreta',
    distance: 8,
    present: [true, true, false, false, true, false],
    pubilla: null,
    bitllots: ['cinta', 'cinta', 'cinta'],
    check: (s) => s.down.filter(Boolean).length === 5,
    success: 'Bitlla! 10 punts.',
    fail: 'No ha quedat exactament una bitlla dreta. Precisió, no força.',
  },
  {
    id: 'pubilla',
    title: 'La pubilla',
    intro: 'Això és propi del joc: a cada tirada hi ha una bitlla coronada, la pubilla. Si fas bitlla i la que queda dreta és ella, és una bitlla d\'or i val el doble.',
    goal: 'Tomba les del mig i deixa la pubilla dreta',
    distance: 8,
    present: [false, true, true, false, true, false],
    pubilla: 2,
    bitllots: ['cinta', 'cinta', 'cinta'],
    check: (s) => s.down.filter(Boolean).length === 5 && !s.down[2],
    success: 'Bitlla d\'or! 20 punts.',
    fail: 'La pubilla ha de quedar dreta i la resta, tombades.',
  },
  {
    id: 'tria',
    title: 'Tria 3 de 4 i bitllots estalviats',
    intro: 'A la partida portes quatre bitllots i, a l\'inici de cada ronda, en deixes un a la banqueta. I si fas bitlla abans del tercer bitllot, els que no llances s\'estalvien: cada un suma ×0,5 a la tirada següent.',
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
];
