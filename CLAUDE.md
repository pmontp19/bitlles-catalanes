# Bitlla! — guia per a agents

Joc mòbil 3D de bitlles catalanes. La mecànica és la prioritat; l'estètica encara no està decidida. Hi ha dues estètiques: gris (greybox) i realisme (prova).

## Ordres

- `npm test`: regles, gest, física (Rapier sense navegador) i Worker. Ràpid (<2 s). Executa'l sempre.
- `npm run typecheck`: TypeScript estricte.
- `npm run build`: compila a `dist/`.
- `npm run sim`: ajust de dificultat per Monte Carlo (`N=40 CAT=masculina npm run sim`). Fes-lo servir abans i després de tocar física o el mapa del gest, i posa els números al missatge del commit.
- `npm run e2e`: amb `npx vite preview --port 4173` engegat, juga el tutorial sencer i una partida de 9 tirades en un mòbil simulat i desa captures. Falla si hi ha errors de pàgina. Al contenidor el render és per programari i va lent: `E2E_QUERY='&estil=gris'` o `'&q=baixa'` per accelerar-lo.
- `npm run cf:dev` / `npm run deploy`: Worker de Cloudflare (Static Assets + `/api/daily`).

## Arquitectura

```
src/game/constants.ts  Mides i regles del reglament FCBB. Font de veritat.
src/game/rules.ts      Regles pures: puntuació, tirada, partida, pubilla, bitllots, llavor diària. Sense física ni DOM.
src/game/physics.ts    Rapier. Sense three.js ni DOM: es testeja a Node. `launchFromInput` mapeja gest → velocitats.
src/game/input.ts      Gest (pantalla) → ThrowInput {aim, power, spin}. Funció pura `gestureToInput`.
src/game/scene.ts      Render three.js (gris per defecte). Només llegeix estats; mai decideix regles. Exposa ganxos per a l'estètica.
src/game/look-realisme.ts  Estètica realista: HDR, PBR, fons fotogràfic, còdols, pols, ombres de contacte, profunditat de camp.
public/realisme/       Recursos CC0 (Poly Haven). Vegeu LLICENCIES.md abans d'afegir-ne.
src/game/tutorial.ts   Lliçons (dades + funció `check`).
src/game/feedback.ts   So i vibració. Punt únic per canviar-ho per Haptics natiu (Capacitor).
src/main.ts            Màquina d'estats de la sessió (menú, tutorial, partida, diària) i HUD.
src/worker/index.ts    Worker de Cloudflare.
```

Regla de dependències: `constants` ← `rules` ← `physics` ← `main`; `scene` només depèn de `constants` i tipus. No importis three.js a `rules`/`physics`.

Estètiques: una estètica és un mòdul que rep el `GameScene` i en canvia materials (`pinMatFor`, `clubMatFor`, `ringMat`), pista (`laneFor`), llum (`sun`, `hemi`, `scene.environment`), terra (`ground`), efectes (`onKnockDown`, `afterSync`, `tickers`) i postprocessat (`post`). Es carrega amb `import()` dinàmic a `main.ts` perquè el gris no pagui el pes. Mai toquis regles ni física des d'una estètica.

Paràmetres d'URL: `?estil=gris|realisme` (per defecte realisme), `?q=baixa` (sense postprocessat, ombres i còdols reduïts), `?fps` (comptador de rendiment per provar en mòbils reals), `?tutorial=N`.

## Reglament (resum, FCBB 2010)

- 6 bitlles (510 mm, base 90 mm, cap 65 mm) en dues fileres de 3, 7,5 cm entre bases. Fila davantera sobre la línia (z = 0).
- Bitllot de 280 mm. Distància: 11,5 m (sènior masc.), 9,5 m (fem./infantil), 8 m (alevina), 6,5 m (benjamina).
- Tirada: 3 bitllots. Si fas bitlla amb el 1r o 2n, ja no llances més. Es poden portar 4 bitllots i llançar-ne 3.
- Puntuació: 5 tombades = 10 ("bitlla"), 6 = 6 ("llenya"), la resta = nombre de tombades.
- Tombada: angle amb l'horitzontal < 45°.
- Partida: 9 tirades, 3 rondes de 3.

Mecàniques afegides (no són del reglament): pubilla (bitlla d'or ×2), bitllots estalviats (+×0,5 per bitllot a la tirada següent), tipus de bitllot, vent a la plantada del dia, càmera lenta a prop dels 45°.

## Convencions

- Textos de la interfície en català. Comentaris en català.
- Qualsevol canvi de física o del gest: `npm test` + `npm run sim`, i comprova que les bitlles plantades no cauen soles (test).
- Qualsevol canvi visual o de flux: `npm run e2e` i mira les captures.
- `window.__bitlla` exposa l'estat per a proves.
- Recursos visuals: llicència CC0 o pròpia, documentats a `public/realisme/LLICENCIES.md`. Pressupost actual del realisme: ~7,5 MB. Comprimeix (JPG/KTX2) abans d'afegir-ne.
- El rendiment real només es pot mesurar en mòbils: el contenidor fa servir render per programari.
