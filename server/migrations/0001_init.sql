-- プレイヤー（登録不要の匿名アカウント。トークンはハッシュのみ保存）
CREATE TABLE players (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    rating      INTEGER NOT NULL DEFAULT 1500,
    wins        INTEGER NOT NULL DEFAULT 0,   -- レート戦の戦績
    losses      INTEGER NOT NULL DEFAULT 0,
    draws       INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_players_rating ON players (rating DESC);

-- 対戦履歴（winner: 0 = p1, 1 = p2, -1 = 引き分け）
CREATE TABLE matches (
    id          TEXT PRIMARY KEY,
    mode        TEXT NOT NULL,
    p1          TEXT NOT NULL,
    p2          TEXT NOT NULL,
    char1       TEXT NOT NULL,
    char2       TEXT NOT NULL,
    winner      INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    turns       INTEGER NOT NULL DEFAULT 0,
    r1_before   INTEGER,
    r1_after    INTEGER,
    r2_before   INTEGER,
    r2_after    INTEGER,
    created_at  INTEGER NOT NULL
);
CREATE INDEX idx_matches_p1 ON matches (p1, created_at DESC);
CREATE INDEX idx_matches_p2 ON matches (p2, created_at DESC);
