# Bitlla! — guia per a agents

Joc mòbil 3D de bitlles catalanes. La mecànica és la prioritat. Estètica única: realisme (`look-realisme.ts`), sempre activa.

## Ordres

- `npm test`: regles, gest, física (Rapier sense navegador) i Worker. Ràpid (<2 s). Executa'l sempre.
- `npm run typecheck`: TypeScript estricte.
- `npm run build`: compila a `dist/`.
- `npm run sim`: ajust de dificultat per Monte Carlo (`N=40 CAT=masculina npm run sim`). Fes-lo servir abans i després de tocar física o el mapa del gest, i posa els números al missatge del commit.
- `npm run e2e`: amb `npx vite preview --port 4173` engegat, juga el tutorial sencer i una partida de 9 tirades en un mòbil simulat i desa captures. Falla si hi ha errors de pàgina. Per defecte fa servir `?proves` (sense realisme: el render per programari del contenidor el faria trigar més d'una hora); per provar el realisme, `E2E_QUERY='&q=baixa'` i molta paciència.
- `npm run cf:dev` / `npm run deploy`: Worker de Cloudflare (Static Assets + API de la plantada del dia). **Per desplegar, segueix [DEPLOY.md](DEPLOY.md)** (cal crear la D1 i posar-ne el `database_id` a `wrangler.jsonc`).

## Arquitectura

```
src/game/constants.ts  Mides i regles del reglament FCBB. Font de veritat.
src/game/rules.ts      Regles pures: puntuació, tirada, partida, pubilla, bitllots, llavor diària. Sense física ni DOM.
src/game/physics.ts    Rapier. Sense three.js ni DOM: es testeja a Node. `launchFromInput` mapeja gest → velocitats; `prediuTrajectoria`/`bitllesEnCami`/`zonaDeCaiguda` alimenten la guia.
src/game/input.ts      Gest (pantalla) → ThrowInput {aim, power, spin}. Funció pura `gestureToInput`.
src/game/gest-fx.ts    Feedback del gest en una capa 2D: traç del dit pel color de la zona (curt/bé/llarg), indicador de força amb la franja bona, fletxa d'efecte.
src/game/scene.ts      Render three.js de base (materials simples). Només llegeix estats; mai decideix regles. Exposa ganxos que el realisme omple.
src/game/look-realisme.ts  Estètica realista: HDR, PBR, fons fotogràfic, còdols, pols, ombres de contacte, profunditat de camp.
                       Escenaris a `ESCENARIS` (foto 360°, sol, terra, línies, pintura).
src/game/escenari-vilanova.ts  Decorat modelat de la pista de Vilanova (tanca, fanals, pèrgola, pistes veïnes).
public/realisme/       Recursos CC0 (Poly Haven). Vegeu LLICENCIES.md abans d'afegir-ne.
docs/referencies/      Fotos reals (Wikimedia Commons) amb autoria i llicència. Consulta-les abans de tocar formes o materials. No s'empaqueten.
src/game/tutorial.ts   "Aprèn a jugar": lliçons de MECÀNICA (controls i sistemes propis del joc). Dades + `check`.
src/game/regles.ts     "Les regles del joc": llibret del reglament real (pàgines) i qüestionari determinista.
src/game/art.ts        Il·lustracions SVG (bitlla, bitllot, plantada, angle, pista, fitxa tècnica) i icones del HUD.
src/game/feedback.ts   So i vibració. Punt únic per canviar-ho per Haptics natiu (Capacitor).
src/main.ts            Màquina d'estats (menú, tutorial, regles, qüestionari, partida, diària, acta) i HUD.
src/style.css          HUD de joc net; menús, lliçons, llibret i acta esqueuomòrfics (fusta, paper, placa esmaltada, segell).
public/fonts/          Zilla Slab (rètols), Caveat (mà/guix), Source Serif 4 (llibret). OFL, allotjades al joc.
src/game/diaria.ts     Plantada del dia, compartit client/servidor: data (Europe/Madrid), llavor, verificació de partides, àlies.
src/worker/index.ts    Worker de Cloudflare: Static Assets + API de la plantada (rànquing a D1, binding `DB`).
src/installa.ts        PWA: quan i com proposar la instal·lació (Android: avís natiu; iOS: instruccions). Registra el service worker.
public/sw.js           Service worker: pàgina amb xarxa primer, fitxers amb memòria cau primer, /api/ mai. Si canvies l'estratègia, puja `CACHE`.
public/icones/         Icones de l'app (generades: placa esmaltada amb una bitlla dreta i dues de tombades).
migrations/            Esquema de D1. Canvis d'esquema: nova migració, mai editar una d'aplicada.
```

Regla de dependències: `constants` ← `rules` ← `physics` ← `main`; `scene` només depèn de `constants` i tipus. No importis three.js a `rules`/`physics`.

Estètiques: una estètica és un mòdul que rep el `GameScene` i en canvia geometria visual (`pinGeo`, `clubGeo`, `decoratePin`), materials (`pinMatFor`, `clubMatFor`, `ringMat`), pista (`laneFor`), llum (`sun`, `hemi`, `scene.environment`), terra (`ground`), efectes (`onKnockDown`, `afterSync`, `tickers`) i postprocessat (`post`). El realisme es carrega sempre a l'arrencada (`import()` a `main.ts`); no hi ha cap altra estètica seleccionable. Mai toquis regles ni física des d'una estètica.

Paràmetres d'URL: `?escenari=vilanova|parc` (per defecte vilanova), `?q=baixa` (sense postprocessat, ombres i còdols reduïts), `?fps` (comptador de rendiment per provar en mòbils reals), `?tutorial=N`. Només per a proves: `?proves` (no carrega el realisme).

## Reglament (resum, FCBB 2010)

- 6 bitlles (510 mm, base 90 mm, cap 65 mm) en dues fileres de 3, 7,5 cm entre bases. Fila davantera sobre la línia (z = 0).
- Bitllot de 280 mm. Distància: 11,5 m (sènior masc.), 9,5 m (fem./infantil), 8 m (alevina), 6,5 m (benjamina).
- Tirada: 3 bitllots. Si fas bitlla amb el 1r o 2n, ja no llances més. Es poden portar 4 bitllots i llançar-ne 3.
- Puntuació: 5 tombades = 10 ("bitlla"), 6 = 6 ("llenya"), la resta = nombre de tombades.
- Tombada: angle amb l'horitzontal < 45°.
- Partida: 9 tirades, 3 rondes de 3.

Mecàniques afegides (no són del reglament): pubilla (bitlla d'or ×2), bitllots estalviats (+×0,5 per bitllot a la tirada següent), tipus de bitllot, vent a la plantada del dia, càmera lenta a prop dels 45°.

## Tutorial i regles: no els barregis

- **Aprèn a jugar** (`tutorial.ts`) ensenya a *controlar* el joc: gest, punteria, efecte, bastidor, i les mecàniques pròpies (pubilla, tria 3 de 4, bitllots estalviats). Cada lliçó és una tirada amb objectiu.
- **Les regles del joc** (`regles.ts`) expliquen el *reglament real*: material, plantada, tirada, distàncies, puntuació, 45°, partida. Llibret + qüestionari.
- Si una lliçó necessita una regla, en dona una línia i remet al llibret; no la torna a explicar.

## Interfície

El HUD de joc (marcador, bitlles, bastidor, objectiu, resultat, transportador) és net i pla, sense materials. L'esqueumorfisme és per a la resta: cada targeta és un material (`card(html, botons, variant)`): `board` (rètol de fusta, menú), `note` (nota clavada, lliçons), `book` (llibret), `acta` (full de partida), `paper`. Botons: `.btn` (placa de fusta), `.btn.primary` (placa esmaltada verda), `.btn.flat` (enllaç). Resultats amb `.stamp` (segell de tinta). Textures només amb CSS/SVG; res d'imatges.

## Feedback del gest

Mentre arrossegues: bitllot a la mà (escena superposada sense profunditat de camp, mida fixa a pantalla), guia de punts amb la baixada del vol i la lliscada (amb l'efecte, sense el vent), anelles a les bitlles que tocaria, traç i indicador de força (`gest-fx.ts`) i vibració per esglaons. En llançar, la guia queda atenuada per comparar-la amb la traça real. La guia és orientativa: la física mana.

## Plantada del dia

El servidor no es fia del client: rep `{down, used}` de cada tirada i recalcula la puntuació amb `verificaPartida` (mateixes regles que el joc, pubilla real del dia). Un intent per jugador i dia (clau `(date, player)`); el client també ho desa a `localStorage` (`diaria:<data>`). Prova local: `npx wrangler d1 migrations apply bitlla --local` i `npm run cf:dev`.

## Convencions

- Textos de la interfície en català. Comentaris en català.
- Qualsevol canvi de física o del gest: `npm test` + `npm run sim`, i comprova que les bitlles plantades no cauen soles (test).
- Qualsevol canvi visual o de flux: `npm run e2e` i mira les captures.
- `window.__bitlla` exposa l'estat i l'escena (`scene()`) per a proves; amb la targeta del menú oberta pots moure la càmera per fer vistes generals.
- Recursos visuals: llicència CC0 o pròpia, documentats a `public/realisme/LLICENCIES.md`. Pressupost actual del realisme: ~7,5 MB. Comprimeix (JPG/KTX2) abans d'afegir-ne.
- El rendiment real només es pot mesurar en mòbils: el contenidor fa servir render per programari.
