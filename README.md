# Bitlla!

Bitlles catalanes en 3D per al mòbil. Tomba'n cinc i deixa'n una dreta: val 10 punts. Totes sis, només 6.

Prototip jugable en gris (sense estètica final) per validar la mecànica:

- **Llançament amb un dit**: la llargada del gest és la força, la inclinació és la punteria i la corba és l'efecte. Una anella mostra on caurà el bitllot.
- **La pubilla**: a cada tirada hi ha una bitlla coronada. Bitlla amb la pubilla dreta = bitlla d'or (×2).
- **Tria 3 de 4**: a cada ronda deixes un dels quatre bitllots (alzina, boix, amb cinta, torçat) a la banqueta.
- **Bitllots estalviats**: si fas bitlla aviat, els bitllots que no llances multipliquen la tirada següent.
- **Regla dels 45°**: càmera lenta i transportador quan una bitlla tentineja al límit.
- **Tutorial** de 7 lliçons, **partida ràpida** i **plantada del dia** (llavor comuna servida pel Worker).

## Desenvolupament

```sh
npm install
npm run dev        # http://localhost:5173 (també accessible des del mòbil a la mateixa xarxa)
npm test
npm run sim        # distribució de resultats per Monte Carlo
```

## Desplegament a Cloudflare Workers

```sh
npx wrangler login
npm run deploy
```

El Worker (`src/worker/index.ts`) serveix `dist/` amb Static Assets i respon `GET /api/daily` amb `{ date, seed }`.

Reglament de referència: [Reglament de Joc de Bitlles Catalanes, FCBB (2010)](https://kitcueme-escoles.diba.cat/documents/41289/2305036/REGLAMENT+DE+JOC+DE+BITLLES+CATALANES.pdf/03c798ae-85aa-43ff-b5e8-6a8685e46d14).
