# Bitlla!

Bitlles catalanes en 3D per al mòbil. Tomba'n cinc i deixa'n una dreta: val 10 punts. Totes sis, només 6.

**Estat:** prototip jugable. La mecànica i el tutorial funcionen. L'estètica final encara no està decidida: hi ha el gris i una prova de **realisme**.

## Com es juga

Arrossega el dit cap amunt des de la part de baix de la pantalla i deixa anar:

| Gest | Efecte |
|---|---|
| Llargada | Força: on cau el bitllot. Una anella groga mostra el punt de caiguda. |
| Inclinació | Punteria cap a l'esquerra o la dreta. |
| Corba | Efecte: el bitllot surt girant i es desvia cap al costat on acaba la corba. |

Abans de llançar pots tocar un dels bitllots de baix per triar quin llances.

### Regles (Reglament FCBB, 2010)

- Sis bitlles en dues fileres de tres. Cada tirada són tres bitllots.
- Puntuació: 5 tombades = **10** (bitlla), 6 tombades = **6** (llenya), la resta val el nombre de bitlles tombades.
- Una bitlla està tombada quan queda inclinada menys de 45° respecte al terra.
- Si fas bitlla amb el primer o el segon bitllot, la tirada s'acaba.
- Una partida són 9 tirades en 3 rondes de 3.

### Mecàniques del joc

- **La pubilla:** a cada tirada hi ha una bitlla coronada. Si fas bitlla i la que queda dreta és ella, és una bitlla d'or i val el doble.
- **Tria 3 de 4:** a l'inici de cada ronda deixes un dels quatre bitllots a la banqueta.

  | Bitllot | Caràcter |
  |---|---|
  | Alzina | Pesat. Arrasa, però costa deixar-ne una. |
  | Boix | Lleuger i viu. Rebota i va lluny. |
  | Amb cinta | Més control: la punteria és més fina. |
  | Torçat | Efecte exagerat. Corba molt. |

- **Bitllots estalviats:** cada bitllot que no llances perquè ja has fet bitlla suma ×0,5 a la tirada següent.
- **Regla dels 45°:** quan una bitlla tentineja al límit, el temps s'alenteix i apareix un transportador d'angle.

### Modes

- **Tutorial:** set lliçons curtes, de 6,5 m a 8 m (llançar, apuntar, efecte, fer bitlla, pubilla, tria 3 de 4 i la regla dels 45°). El menú el proposa com a primera opció fins que l'acabes o el saltes.
- **Partida ràpida:** 9 tirades a 9,5 m.
- **Plantada del dia:** la mateixa pubilla i el mateix vent per a tothom. En acabar es pot copiar el resultat per compartir-lo:

  ```
  Bitlla! 2026-11-01 · 68 punts
  🟨🟫🌟
  🪵🟨⬛
  🟫🟨🟫
  ```

## Estètiques

| Paràmetre | Què fa |
|---|---|
| `?estil=realisme` (per defecte) | Llum d'una foto HDR real d'un parc de Palerm, terra de sauló, bitlles de fusta d'alzina amb anella de ferro, còdols, pols quan cauen, ombres de contacte i profunditat de camp. |
| `?escenari=vilanova` (per defecte) | Pista de Vilanova i la Geltrú: sauló clar, tanca verda amb xarxa i pistes numerades, fanals, pèrgola, rètol i bitlles amb el cap pintat. |
| `?escenari=parc` | Parc amb terra i plàtans, llum suau de tarda i bitlles amb anelles pintades al coll. |
| `?estil=gris` | Versió en gris per centrar-se en la mecànica. |
| `?q=baixa` | Realisme sense postprocessat i amb ombres i còdols reduïts, per a mòbils modestos. |
| `?fps` | Mostra els fotogrames per segon per provar el rendiment en mòbils reals. |

Les formes i colors del realisme es basen en fotos reals de bitlles catalanes recollides a [docs/referencies](docs/referencies/README.md). Els recursos del realisme són CC0 de [Poly Haven](https://polyhaven.com) (vegeu [public/realisme/LLICENCIES.md](public/realisme/LLICENCIES.md)) i pesen uns 7,5 MB. Per guanyar més realisme, el pas següent és escanejar bitlles i bitllots de debò i una pista real.

## Desenvolupament

Requereix Node 20 o superior.

```sh
npm install
npm run dev        # http://localhost:5173, també accessible des del mòbil a la mateixa xarxa
npm test           # regles, gest, física sense navegador i Worker
npm run typecheck
npm run sim        # dificultat per Monte Carlo (N=40 CAT=masculina npm run sim)
npm run e2e        # amb `npx vite preview --port 4173` engegat: tutorial + partida en un mòbil simulat
```

El codi l'escriuen sobretot agents. Per a l'arquitectura, les convencions i les comprovacions obligatòries després de cada canvi, vegeu [CLAUDE.md](CLAUDE.md).

### Estructura

```
src/game/constants.ts  Mides del reglament (font de veritat)
src/game/rules.ts      Regles pures: puntuació, partida, pubilla, bitllots
src/game/physics.ts    Física amb Rapier, sense render (també corre a Node)
src/game/input.ts      Gest → força, punteria i efecte
src/game/scene.ts      Render amb three.js (gris) i ganxos per a les estètiques
src/game/look-realisme.ts  Estètica realista
src/game/tutorial.ts   Lliçons del tutorial
src/game/feedback.ts   So i vibració
src/main.ts            Flux del joc i HUD
src/worker/index.ts    Worker de Cloudflare
```

## Desplegament a Cloudflare Workers

El Worker (`src/worker/index.ts`) serveix `dist/` amb Static Assets i respon `GET /api/daily` amb `{ date, seed }` per a la plantada del dia.

**Automàtic des de GitHub:** al tauler de Cloudflare, *Workers & Pages* → *Create* → *Import a repository*, tria aquest repositori i la branca `main`, amb l'ordre de compilació `npm run build` i l'ordre de desplegament `npx wrangler deploy`. Cada canvi a `main` es desplegarà sol.

**Des de terminal:**

```sh
npx wrangler login
npm run deploy
```

## Properes passes

- Decidir l'estètica (propostes A–G: diorama, toon, trencadís, riso, revetlla, còmic XIII, realisme). Del realisme: provar-ne el rendiment en mòbils reals, escanejar bitlles de debò i comprimir les textures a KTX2.
- Ajustar el gest i la dificultat amb jugadors reals.
- Rànquing de la plantada del dia (D1 o Durable Object).
- Gira de festes majors: pobles amb modificadors (terra molla, pendent, tramuntana, revetlla).
- App per a les botigues amb Capacitor (vibració nativa a iPhone, notificacions).

Reglament de referència: [Reglament de Joc de Bitlles Catalanes, FCBB (2010)](https://kitcueme-escoles.diba.cat/documents/41289/2305036/REGLAMENT+DE+JOC+DE+BITLLES+CATALANES.pdf/03c798ae-85aa-43ff-b5e8-6a8685e46d14).
