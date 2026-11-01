# Desplegament a Cloudflare Workers

Guia per a la persona o l'agent que desplegui Bitlla!. Tot el codi és a `main`; no cal tocar res del joc.

## Què es desplega

Un sol Worker, `bitlla` (`wrangler.jsonc`):

- **Static Assets**: el joc compilat a `dist/` (~15 MB: JS, textures del realisme, fonts, icones, `sw.js`).
- **API** (`src/worker/index.ts`), que s'executa abans dels fitxers per a `/api/*`:
  - `GET /api/daily`: data (hora de Catalunya), llavor i minuts per a la propera plantada.
  - `POST /api/daily/score`: envia una partida de la plantada del dia; el servidor la recalcula.
  - `GET /api/daily/ranking`: rànquing del dia.
- **D1** (binding `DB`, base de dades `bitlla`): taula `scores` (`migrations/0001_scores.sql`).

## Requisits

- Node 20 o superior i `npm ci`.
- Un compte de Cloudflare. De forma no interactiva: variables `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID`.
  El token necessita els permisos **Workers Scripts: Edit**, **D1: Edit** i **Account Settings: Read**.
  De forma interactiva: `npx wrangler login`.

## Primer desplegament (un sol cop)

```sh
npm ci
npm test                      # 29 tests, uns segons
npm run build                 # compila a dist/

# 1. Crear la base de dades del rànquing
npx wrangler d1 create bitlla
#    → copia el "database_id" que retorna i substitueix el de wrangler.jsonc
#      (ara hi ha 00000000-0000-0000-0000-000000000000, que fa fallar el desplegament)

# 2. Crear la taula
npx wrangler d1 migrations apply bitlla --remote

# 3. Desplegar
npx wrangler deploy
```

Fes commit del `database_id` real a `wrangler.jsonc`: no és cap secret, i sense ell els desplegaments posteriors fallen.

## Desplegaments següents

```sh
npm ci && npm test && npm run build && npx wrangler deploy
```

Si hi ha migracions noves a `migrations/`, abans: `npx wrangler d1 migrations apply bitlla --remote`.

**Alternativa automàtica:** al tauler de Cloudflare, *Workers & Pages* → el Worker `bitlla` → *Settings* → *Builds* → connecta el repositori de GitHub, branca `main`, ordre de compilació `npm run build`, ordre de desplegament `npx wrangler deploy`. La base de dades D1 s'ha de crear abans (passos 1 i 2).

## Comprovacions després de desplegar

Substitueix `$URL` per l'adreça del Worker (p. ex. `https://bitlla.<compte>.workers.dev`).

```sh
curl -s $URL/api/daily                       # {"date":"AAAA-MM-DD","seed":...,"minutsFinsDema":...}
curl -s $URL/api/daily/ranking               # {"date":...,"count":0,"top":[],"me":null}
# Una partida impossible s'ha de rebutjar amb 422:
curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL/api/daily/score -H 'content-type: application/json' \
  -d "{\"date\":\"$(curl -s $URL/api/daily | sed -E 's/.*\"date\":\"([^\"]+)\".*/\1/')\",\"player\":\"prova-desplegament\",\"name\":\"Prova\",\"tirades\":[]}"
curl -s -o /dev/null -w "%{http_code}\n" $URL/                    # 200
curl -s -o /dev/null -w "%{http_code}\n" $URL/sw.js               # 200
curl -s -o /dev/null -w "%{http_code}\n" $URL/manifest.webmanifest # 200
```

Al mòbil:

1. Obre `$URL`: ha de sortir el menú de fusta i, en uns segons, la pista de Vilanova.
2. Juga una lliçó d'«Aprèn a jugar» i una tirada de «Partida ràpida».
3. Juga la «Plantada del dia», posa un àlies i comprova que surt la posició i el rànquing a la pissarra.
4. Torna a entrar a la plantada del dia: ha d'ensenyar l'acta, no deixar jugar de nou.
5. Android: després de la primera partida, el menú ha d'oferir «Instal·la Bitlla!». iPhone: ha d'explicar com afegir-la a la pantalla d'inici.
6. Obre `$URL/?fps` per veure el rendiment real. Si va lent: `?q=baixa`, o `?estil=gris` per comparar.

## A tenir en compte

- **Sense D1** (binding `DB` absent) el joc i la plantada del dia funcionen, però `/api/daily/score` i `/api/daily/ranking` responen 503 i l'acta diu que no s'ha pogut enviar.
- **Service worker**: la pàgina es demana primer a la xarxa, així que els desplegaments nous arriben sols. Si algun dia canvia l'estratègia de `public/sw.js`, cal pujar el nom de `CACHE`.
- **Hora**: la plantada canvia a mitjanit d'`Europe/Madrid`, tant al Worker com al client.
- **Dades personals**: només es guarda un identificador anònim del dispositiu, l'àlies que tria el jugador i la puntuació.
