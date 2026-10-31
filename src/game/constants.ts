// Mides i regles del Reglament de Joc de Bitlles Catalanes (FCBB, 29/06/2010).
// Unitats: metres, quilograms, segons. L'eix Z negatiu va del tirador cap a les bitlles.

/** Perfil de la bitlla (radi, alçada). Alçada 510 mm, cap 65 mm, base 90 mm (reglament 2.1.2). */
export const PIN_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.045, 0], [0.046, 0.012], [0.046, 0.03], [0.045, 0.2], [0.041, 0.29], [0.033, 0.35],
  [0.026, 0.395], [0.024, 0.415], [0.028, 0.44], [0.0325, 0.47], [0.032, 0.49], [0.024, 0.505], [0.012, 0.51],
];
export const PIN_HEIGHT = 0.51;

/** Perfil del bitllot (radi, alçada) centrat a l'origen. Llargada 280 mm, base 80 mm, empunyadura 40 mm (2.2.2). */
export const CLUB_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.03, -0.12], [0.038, -0.105], [0.04, -0.05], [0.038, 0], [0.03, 0.02], [0.021, 0.045], [0.02, 0.06], [0.02, 0.15], [0.016, 0.16],
];

/** Distància entre bases: 7,5 cm (4.2). Centres: 9 cm de base + 7,5 cm. */
export const PIN_SPACING = 0.09 + 0.075;

/**
 * Plantada: dues fileres de tres (4.1). La primera filera, sobre la línia (z = 0).
 * Índexs: 0 1 2 = filera davantera (esquerra→dreta), 3 4 5 = filera del darrere.
 */
export const PIN_LAYOUT: ReadonlyArray<readonly [number, number]> = [
  [-PIN_SPACING, 0], [0, 0], [PIN_SPACING, 0],
  [-PIN_SPACING, -PIN_SPACING], [0, -PIN_SPACING], [PIN_SPACING, -PIN_SPACING],
];

/** Distàncies de llançament per categoria (5.1). */
export const THROW_DISTANCE = {
  benjamina: 6.5,
  alevina: 8,
  infantil: 9.5,
  femenina: 9.5,
  masculina: 11.5,
} as const;
export type Category = keyof typeof THROW_DISTANCE;

/** Camp: 16,5 m de llarg, entre 1,75 i 2 m d'ample (3.2). */
export const LANE_WIDTH = 2;

/** Bitlla tombada: angle amb el pla horitzontal inferior a 45° (6.5). */
export const KNOCK_ANGLE_DEG = 45;

/** Una partida: 9 tirades en 3 rondes de 3 (6.1). Una tirada: 3 bitllots (6.2). */
export const TIRADES_PER_RONDA = 3;
export const RONDES = 3;
export const BITLLOTS_PER_TIRADA = 3;
/** Es poden portar fins a 4 bitllots a la pista i llançar-ne 3 (6.2). */
export const BITLLOTS_A_PISTA = 4;

/** Densitats estimades (el reglament no fixa pesos). Alzina ≈ 0,9 g/cm³; la bitlla és més lleugera per jugabilitat. */
export const PIN_DENSITY = 800;
export const GRAVITY = -9.81;
