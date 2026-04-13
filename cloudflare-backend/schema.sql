CREATE TABLE IF NOT EXISTS users (
    steam_id TEXT PRIMARY KEY,
    persona_name TEXT,
    profile_url TEXT,
    avatar_url TEXT,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
);
