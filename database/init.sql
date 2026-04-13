CREATE TABLE IF NOT EXISTS users (
    steam_id VARCHAR(50) PRIMARY KEY,
    persona_name VARCHAR(255),
    profile_url TEXT,
    avatar_url TEXT,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
    appid INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_games (
    steam_id VARCHAR(50) REFERENCES users(steam_id),
    appid INT REFERENCES games(appid),
    playtime_forever INT,
    playtime_2weeks INT,
    last_played TIMESTAMP,
    PRIMARY KEY (steam_id, appid)
);
