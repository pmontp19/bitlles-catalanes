# Recursos del mode realisme

Tots els recursos són de [Poly Haven](https://polyhaven.com) amb llicència **CC0** (domini públic).

| Fitxer | Recurs original | Canvis |
|---|---|---|
| `entorn_1k.hdr` | [Palermo Park](https://polyhaven.com/a/palermo_park) (Andreas Mischok), HDR 1k | cap |
| `entorn_4k.jpg` | [Palermo Park](https://polyhaven.com/a/palermo_park), JPG tonemapped | reduït a 4096×2048 |
| `terra_*` | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04), 2k | color ajustat a sauló (terra de pista), recomprimit |
| `fusta_*` | [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01), 1k | recomprimit |
| `ferro_*` | [Rusty Metal 04](https://polyhaven.com/a/rusty_metal_04) | reduït a 512 px |
| `vilanova_entorn_1k.hdr` | [Wide Street 01](https://polyhaven.com/a/wide_street_01), HDR 1k | cap |
| `vilanova_entorn_4k.jpg` | [Wide Street 01](https://polyhaven.com/a/wide_street_01), JPG tonemapped | reduït a 4096×2048 |
| `saulo_clar_diffuse_2k.jpg` | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04), 2k | menys contrast i color igualat al sauló de les fotos de la pista de Vilanova |

L'escenari "vilanova" fa servir una foto 360° genèrica (cel blau, arbres i blocs de pisos) com a fons i llum provisional. Quan hi hagi una foto 360° de la pista real, substitueix `vilanova_entorn_*` i recalcula `sunInPhoto` i `rotY` a `look-realisme.ts`.
