// Contingut: jornades, personatges, encàrrecs, reglament i finals.

export const DAYS = [
  { n: 1, date: "DISSABTE 6 D'OCTUBRE DE 1979", quota: 8, feats: [],
    head: 'COMENÇA LA LLIGA COMARCAL',
    body: "LA FEDERACIÓ RECORDA ALS JUGADORS QUE CINC BITLLES TOMBADES FAN BITLLA: 10 PUNTS. TOMBAR-LES TOTES SIS NOMÉS EN VAL 6.",
    rule: null, tut: 'aim' },
  { n: 2, date: "DISSABTE 13 D'OCTUBRE DE 1979", quota: 10, feats: ['spin', 'orders'],
    head: 'EL BAR CAL PEP ACCEPTA ENCÀRRECS',
    body: "ELS VEÏNS JA PODEN DEMANAR FAVORS ALS JUGADORS. LA FEDERACIÓ HO TOLERA... DE MOMENT.",
    rule: 'GIR: FES CERCLES AMB EL DIT ABANS DE LLANÇAR. EL BITLLOT GIRA I ESCOMBRA MÉS BITLLES.', tut: 'spin' },
  { n: 3, date: "DISSABTE 20 D'OCTUBRE DE 1979", quota: 12, feats: ['spin', 'orders', 'wind'],
    head: 'ARRIBA LA TRAMUNTANA',
    body: "VENT FORT A TOTA LA COMARCA. ELS JUGADORS HAURAN DE MIRAR LA BANDERA ABANS DE TIRAR.",
    rule: 'VENT: EL BITLLOT ES DESVIA CAP ON BUFA. COMPENSA L\'APUNTAT.', tut: 'wind' },
  { n: 4, date: "DISSABTE 27 D'OCTUBRE DE 1979", quota: 14, feats: ['spin', 'orders', 'wind', 'seal'],
    head: "LA FEDERACIÓ ESTRENA LA BITLLA D'OR",
    body: "UNA BITLLA DE CADA PLANTADA PORTA EL SEGELL VERMELL DE LA FEDERACIÓ.",
    rule: "BITLLA D'OR: SI FAS BITLLA I LA QUE QUEDA DRETA ÉS LA SEGELLADA, 15 PUNTS.", tut: 'seal' },
  { n: 5, date: 'DISSABTE 3 DE NOVEMBRE DE 1979', quota: 15, feats: ['spin', 'orders', 'wind', 'seal', 'inspect'],
    head: 'ESCÀNDOL: UN PLANTADOR MANDRÓS',
    body: "ALGUNES PLANTADES NO COMPLEIXEN EL REGLAMENT. LA FEDERACIÓ ANUL·LARÀ LES TIRADES IRREGULARS.",
    rule: 'INSPECCIÓ: ABANS DE TIRAR, OBRE LA LUPA, TOCA LA BITLLA MAL PLANTADA (FORA DE LA PLANTILLA O SENSE ANELLA) I RECLAMA. RECLAMACIÓ FALSA: AMONESTACIÓ.', tut: 'inspect' },
  { n: 6, date: 'DISSABTE 10 DE NOVEMBRE DE 1979', quota: 16, feats: ['spin', 'orders', 'wind', 'seal', 'inspect', 'wet'],
    head: 'PLOU A BOTS I BARRALS',
    body: "LA PISTA ESTÀ MULLADA. ELS BITLLOTS LLISQUEN MOLT MÉS QUE DE COSTUM.",
    rule: 'PISTA MULLADA: MENYS FREGAMENT. TIRA AMB MENYS FORÇA.', tut: null },
  { n: 7, date: 'DISSABTE 17 DE NOVEMBRE DE 1979', quota: 17, feats: ['spin', 'orders', 'wind', 'seal', 'inspect', 'night'],
    head: 'PARTIDA DE NIT PER LA FESTA MAJOR',
    body: "ES JUGA AMB FANALS. L'AJUNTAMENT DEMANA DISCRECIÓ AMB LES APOSTES.",
    rule: 'NIT: NOMÉS EL FANAL IL·LUMINA LA PLANTADA.', tut: null },
  { n: 8, date: 'DISSABTE 24 DE NOVEMBRE DE 1979', quota: 18, feats: ['spin', 'orders', 'wind', 'seal', 'inspect', 'inspector'],
    head: "L'INSPECTOR GARRIGA ARRIBA DE BARCELONA",
    body: "LA FEDERACIÓ DOBLA LES INSPECCIONS ALS JUGADORS SOSPITOSOS D'AMANYAR PARTIDES.",
    rule: "INSPECTOR: EL RISC D'EXPEDIENT PER SOSPITA ES DOBLA.", tut: null },
  { n: 9, date: 'DISSABTE 1 DE DESEMBRE DE 1979', quota: 19, feats: ['spin', 'orders', 'wind', 'seal', 'inspect', 'wet', 'inspector'], rent: 6,
    head: 'PUJA EL LLOGUER',
    body: "EL PROPIETARI DEL PIS APUJA EL LLOGUER A 6 PESSETES PER JORNADA. EL POBLE PROTESTA.",
    rule: 'LLOGUER: 6 PTES.', tut: null },
  { n: 10, date: 'DISSABTE 8 DE DESEMBRE DE 1979', quota: 20, feats: ['spin', 'orders', 'wind', 'seal', 'inspect', 'night', 'inspector'], rent: 6, final: true,
    head: 'GRAN FINAL DEL CAMPIONAT',
    body: "TOT EL POBLE A LA PISTA. EL CAMPIÓ COMARCAL ES DECIDEIX AVUI.",
    rule: 'FINAL: CAMPIÓ SI SUMES 150 PUNTS A LA LLIGA.', tut: null },
];

export function dayInfo(n) {
  if (n <= DAYS.length) return DAYS[n - 1];
  const r = (n * 7919) % 100;
  const feats = ['spin', 'orders', 'wind', 'seal', 'inspect', 'inspector'];
  if (r < 30) feats.push('wet'); else if (r < 55) feats.push('night');
  return {
    n, date: `JORNADA EXTRA ${n - 10}`, quota: Math.min(26, 20 + (n - 10)), feats, rent: 6 + Math.floor((n - 10) / 4),
    head: 'LLIGA D\'HIVERN', body: 'LA LLIGA CONTINUA. EL MÍNIM FEDERATIU PUJA CADA JORNADA.', rule: null, tut: null, extra: true,
  };
}

export const CAMPIO_POINTS = 150;

// Retrats generats per codi
export const PEOPLE = {
  batlle: { name: 'SR. BATLLE', skin: '#c99a76', hair: '#d8d4c8', style: 'bald', moust: true, tie: true, coat: '#3e4a5a' },
  mossen: { name: 'MOSSÈN JOAN', skin: '#d6a986', hair: '#2a211c', style: 'short', glasses: true, priest: true, coat: '#1f1c1c' },
  fuster: { name: 'EN FERRAN, FUSTER', skin: '#b5835f', hair: '#5a3a22', style: 'short', beard: true, hat: 'beret', coat: '#5d6b3c' },
  pep: { name: 'EN PEP DEL BAR', skin: '#c48f6c', hair: '#1c1714', style: 'slick', moust: true, apron: true, coat: '#c9c2ad' },
  rosita: { name: 'LA SRA. ROSITA', skin: '#dcb196', hair: '#7a1f1f', style: 'bun', lips: true, coat: '#6b2a4a' },
  nuria: { name: 'LA COSINA NÚRIA', skin: '#e0b896', hair: '#3a2416', style: 'long', coat: '#3f6a6a' },
  inspector: { name: 'INSPECTOR GARRIGA', skin: '#c7a084', hair: '#3a3a3a', style: 'short', hat: 'fedora', glasses: true, moust: true, coat: '#4a4a46' },
};

// Tipus d'encàrrec
export const ORDERS = [
  { who: 'batlle', kind: 'deixa', pay: 4, pen: 1, sus: 0, minDay: 2,
    text: p => `DEIXA DRETA LA BITLLA Nº${p.pin}. ÉS LA QUE VA PAGAR L'AJUNTAMENT. NOMÉS COMPTA SI FAS BITLLA.` },
  { who: 'mossen', kind: 'bitlla', pay: 2, pen: 0, sus: 0, minDay: 2,
    text: () => `QUE DÉU GUIÏ EL TEU BITLLOT. FES BITLLA EN AQUESTA TIRADA I LA PARRÒQUIA T'HO AGRAIRÀ.` },
  { who: 'nuria', kind: 'minim', pay: 1, pen: 0, sus: 0, minDay: 2,
    text: () => `HE CONVIDAT EL MEU XICOT A VEURE'T. TOMBA'N ALMENYS QUATRE, NO EM FACIS QUEDAR MALAMENT!` },
  { who: 'fuster', kind: 'llenya', pay: 4, pen: 1, sus: 0, minDay: 3,
    text: () => `NECESSITO LLENYA PER A L'HIVERN. TOMBA-LES TOTES SIS, ENCARA QUE ET COSTI PUNTS.` },
  { who: 'pep', kind: 'nobitlla', pay: 6, pen: 2, sus: 1, minDay: 3,
    text: () => `HE APOSTAT CONTRA TU AL BAR. NO FACIS BITLLA EN AQUESTA TIRADA I ET TOCA LA TEVA PART.` },
  { who: 'rosita', kind: 'zero', pay: 10, pen: 3, sus: 2, minDay: 5,
    text: () => `NO EN TOMBIS CAP, BONIC. NI UNA. NINGÚ NO HO SABRÀ... I JO SÓC MOLT GENEROSA.` },
];

export function orderOk(o, r) {
  switch (o.kind) {
    case 'deixa': return r.n === 5 && r.standing[0] === o.pin;
    case 'bitlla': return r.n === 5;
    case 'minim': return r.n >= 4;
    case 'llenya': return r.n === 6;
    case 'nobitlla': return r.n !== 5;
    case 'zero': return r.n === 0;
  }
  return false;
}

export const POINTS = [0, 1, 2, 3, 4, 10, 6];

export const REGLAMENT = [
  { t: 'OBJECTIU', lines: [
    "TOMBAR CINC DE LES SIS BITLLES PLANTADES: FER BITLLA.",
    "ES LLANCEN D'UN A TRES BITLLOTS PER TIRADA.",
    '',
    'PUNTUACIÓ:',
    '5 TOMBADES ... 10 (BITLLA)',
    '6 TOMBADES ...  6',
    '4 TOMBADES ...  4',
    '3 / 2 / 1  ... 3 / 2 / 1',
    'CAP ...........  0',
  ] },
  { t: 'LA TIRADA', lines: [
    'UNA TIRADA SÓN TRES BITLLOTS, L\'UN DESPRÉS DE L\'ALTRE.',
    'SI FAS BITLLA AMB EL 1R O EL 2N, JA NO CAL LLANÇAR ELS ALTRES.',
    'UNA BITLLA ÉS TOMBADA SI LA SEVA INCLINACIÓ ÉS INFERIOR A 45º RESPECTE AL TERRA.',
    'UNA BITLLA RECOLZADA EN UNA ALTRA NO ESTÀ TOMBADA!',
  ] },
  { t: 'MATERIAL', diagram: 'pin', lines: [
    'BITLLA: 51 CM, CAP 6,5 CM, BASE 9 CM. FUSTA D\'ALZINA AMB ANELLA DE FERRO.',
    'BITLLOT: 28 CM, BASE 8 CM.',
    'PLANTADA: DUES FILERES DE TRES, 7,5 CM ENTRE BITLLES.',
    'DISTÀNCIA: 11,5 M (9,5 M FEMENINA).',
  ] },
  { t: 'COM ES TIRA', lines: [
    'ARROSSEGA EL DIT CAP A LES BITLLES: LA LÍNIA DE PUNTS MOSTRA ON VA.',
    'MÉS LLARG = MÉS FORÇA. MASSA FORÇA: MENYS PRECISIÓ.',
    'DEIXA ANAR PER LLANÇAR.',
    'EL POLS TREMOLA: AMB GIR, VENT O NERVIS TREMOLA MÉS. TRIA BÉ EL MOMENT.',
  ] },
  { t: 'LA JORNADA', lines: [
    'CADA JORNADA: UNA RONDA DE TRES TIRADES.',
    'CAL ARRIBAR AL MÍNIM FEDERATIU. SI NO, MULTA DE 3 PTES. TRES VEGADES: EXPULSIÓ.',
    'PREMI: 1 PTA PER CADA 2 PUNTS.',
    'RATXA: BITLLES SEGUIDES DONEN PESSETES EXTRA.',
  ] },
];

export const RULE_PAGES = {
  spin: { t: 'GIR', lines: ['FES CERCLES AMB EL DIT ABANS DE LLANÇAR. CADA VOLTA DONA MÉS GIR AL BITLLOT.', 'SENSE GIR: EL BITLLOT VA DE PUNTA, PRECÍS.', 'AMB GIR: ESCOMBRA MÉS BITLLES... I EL POLS TREMOLA MÉS.'] },
  orders: { t: 'ENCÀRRECS', lines: ['ELS VEÏNS ET FARAN ENCÀRRECS. SEGELLA ACCEPTAT O REFUSAT.', 'SI COMPLEIXES, COBRES. SI FALLES, PAGUES LA PENYORA.', 'ALGUNS ENCÀRRECS SÓN IL·LEGALS: AUGMENTEN LA SOSPITA.', 'AMB MOLTA SOSPITA, LA FEDERACIÓ OBRE EXPEDIENT.'] },
  wind: { t: 'VENT', lines: ['LA BANDERA I EL MARCADOR INDIQUEN EL VENT.', 'EL BITLLOT ES DESVIA FINS A 10 CM CAP ON BUFA.'] },
  seal: { t: "BITLLA D'OR", lines: ['UNA BITLLA PORTA EL SEGELL VERMELL.', 'FES BITLLA DEIXANT-LA DRETA: 15 PUNTS.'] },
  inspect: { t: 'INSPECCIÓ', lines: ['TOCA LA LUPA PER VEURE LA PLANTILLA OFICIAL.', 'BITLLA FORA DEL SEU CERCLE O SENSE ANELLA DE FERRO: IRREGULAR.', 'TOCA-LA I PREM RECLAMAR.', 'SI TIRES SOBRE UNA PLANTADA IRREGULAR, LA TIRADA POT SER NUL·LA.', 'RECLAMACIÓ FALSA: AMONESTACIÓ (-2 PUNTS A PARTIR DE LA SEGONA).'] },
  wet: { t: 'PISTA MULLADA', lines: ['EL BITLLOT LLISCA MOLT MÉS. TIRA MÉS SUAU.'] },
  night: { t: 'NIT', lines: ['NOMÉS EL FANAL IL·LUMINA LA PLANTADA.'] },
  inspector: { t: 'INSPECTOR', lines: ["AMB L'INSPECTOR A LA PISTA, EL RISC D'EXPEDIENT ES DOBLA."] },
};

export const ENDINGS = {
  desnonat: { t: 'DESNONAT', text: "NO HAS POGUT PAGAR EL LLOGUER. LA FAMÍLIA I TU MARXEU A CASA LA TIETA, A TERRASSA. ELS BITLLOTS ES QUEDEN AL TRASTER." },
  inhabilitat: { t: 'INHABILITAT', text: "LA FEDERACIÓ HA DESCOBERT ELS TEUS TRATES. CARNET DE JUGADOR RETIRAT DE PER VIDA. A CAL PEP ARA HI SERVEIXES CAFÈS." },
  expulsat: { t: 'EXPULSAT', text: "TRES JORNADES SENSE ARRIBAR AL MÍNIM FEDERATIU. LA FEDERACIÓ ET DONA DE BAIXA DE LA LLIGA." },
  sol: { t: 'SOL', text: "LA CASA ÉS BUIDA. TOTHOM HA MARXAT. NOMÉS ET QUEDEN TRES BITLLOTS I UN ACTA SENSE SIGNAR." },
  campio: { t: 'CAMPIÓ COMARCAL', text: "EL POBLE ET PORTA A COLLIBÉ FINS A LA PLAÇA. LA FEDERACIÓ ET LLIURA LA BITLLA DE PLATA. VISCA!" },
  supervivent: { t: 'FI DE LLIGA', text: "NO ETS EL CAMPIÓ, PERÒ HAS ACABAT LA LLIGA I A CASA NO HI FALTA PA. L'ANY QUE VE, POTSER." },
};

export const FAMILY = ['L\'ÀVIA ROSA', 'LA MONTSE', 'EL PETIT QUIM'];
