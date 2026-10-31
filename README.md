# BITLLES · Lliga Comarcal 1979

Joc de **bitlles catalanes** per a mòbil: pixel art isomètric, estètica *Papers, Please*.
Ets un jugador de la Lliga Comarcal del 1979. Cada dissabte has de fer punts, pagar el lloguer, alimentar la família i decidir quins encàrrecs (legals o no) acceptes dels veïns.

> **Cinc són deu. Sis són sis.**

## Regles reals (Reglament de Joc FCBB, 2010)

- 6 bitlles de 51 cm (cap 6,5 cm, base 9 cm, anella de ferro), en **dues fileres de tres**, a **7,5 cm** entre bitlles.
- Bitllot de 28 cm (base Ø 8 cm). Distància de tir: 11,5 m (9,5 m femenina).
- Una **tirada** són fins a 3 bitllots. Si fas bitlla amb el 1r o el 2n, la tirada s'acaba.
- **Puntuació:** 5 tombades = **10 (bitlla)**, 6 tombades = 6, 4/3/2/1 = 4/3/2/1, cap = 0.
- Una bitlla és tombada si la seva inclinació és inferior a 45º respecte al terra (al joc, una bitlla recolzada en una altra **no** compta com a tombada).
- Partida oficial: 9 tirades en 3 rondes. Al joc, cada jornada és una ronda de 3 tirades.
- Amonestacions: la primera és un avís; a partir de la segona es resten 2 punts.

Font: Reglament de Joc de Bitlles Catalanes, Federació Catalana de Bitlles i Bowling (29/06/2010).

## La mecànica

El repte és **apuntar per salvar**: no guanya qui tomba més bitlles, sinó qui en deixa exactament una dreta. La física simula cada bitlla com un bloc que bascula, amb reaccions en cadena, bitlles que trontollen i bitlles que queden recolzades.

- **Arrossega cap a les bitlles** per apuntar. La línia de punts mostra el camí. Com més llarg l'arrossegament, més força.
- **Fes cercles amb el dit** abans de llançar per donar **gir**: el bitllot escombra més bitlles, però el pols tremola més.
- **El pols**: l'apuntat oscil·la i és més inestable amb gir, vent, sospita i pressió. Tria bé el moment de deixar anar.
- **Paperassa**: encàrrecs dels veïns (segellar ACCEPTAT/REFUSAT), sospita de la Federació, inspecció de plantades irregulars amb la lupa, acta de tirada, i el balanç de final de jornada (lloguer, menjar, llenya, medicines).

### Jornades

| Jornada | Novetat |
|---|---|
| 1 | Bàsic: apuntar i fer bitlla |
| 2 | Gir i encàrrecs |
| 3 | Vent (tramuntana) |
| 4 | Bitlla d'or: deixa dreta la bitlla segellada → 15 punts |
| 5 | Inspecció de la plantada |
| 6 | Pista mullada |
| 7 | Partida de nit |
| 8 | L'inspector de la Federació |
| 9 | Puja el lloguer |
| 10 | Gran final. Després, lliga d'hivern infinita |

Finals: campió, supervivent, desnonat, expulsat, inhabilitat, sol.

## Tecnologia

- HTML5 Canvas a 216 px d'amplada, escalat amb píxels sencers. Sense dependències ni compilació.
- Font bitmap 5x7 pròpia amb accents catalans (À È É Í Ï Ò Ó Ú Ü Ç L·L).
- Sons sintetitzats amb WebAudio i vibració al mòbil.
- Progrés desat a `localStorage`. PWA instal·lable (manifest i icones).

```
public/
  index.html
  js/main.js      estat del joc, render isomètric, UI
  js/physics.js   física de bitlles i bitllot
  js/font.js      font bitmap
  js/gfx.js       primitives de píxel
  js/audio.js     efectes de so
  js/data.js      jornades, personatges, reglament
test/             proves de física (node) i captures (Playwright)
```

## Desenvolupament

```bash
npm run serve        # servidor estàtic a http://localhost:8787
npm test             # Monte Carlo de la física
node test/balance.mjs
```

## Desplegament a Cloudflare Workers

El projecte es desplega com a Worker amb **static assets** (`wrangler.jsonc` apunta a `./public`).

```bash
npm install
npx wrangler login
npm run deploy
```
