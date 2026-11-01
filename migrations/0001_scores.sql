-- Rànquing de la plantada del dia. Un intent per jugador i dia.
CREATE TABLE IF NOT EXISTS scores (
  date       TEXT    NOT NULL,           -- AAAA-MM-DD (hora de Catalunya)
  player     TEXT    NOT NULL,           -- identificador anònim del dispositiu
  name       TEXT    NOT NULL,           -- àlies triat pel jugador
  total      INTEGER NOT NULL,           -- recalculat pel servidor
  bitlles    INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (date, player)
);
CREATE INDEX IF NOT EXISTS scores_date_total ON scores (date, total DESC);
