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
    name VARCHAR(255),
    platform_windows BOOLEAN,
    platform_mac BOOLEAN,
    platform_linux BOOLEAN,
    release_date VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS game_price_history (
    id SERIAL PRIMARY KEY,
    appid INT REFERENCES games(appid),
    price_initial INT,
    price_final INT,
    discount_percent INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_games (
    steam_id VARCHAR(50) REFERENCES users(steam_id),
    appid INT REFERENCES games(appid),
    playtime_forever INT,
    playtime_2weeks INT,
    last_played TIMESTAMP,
    PRIMARY KEY (steam_id, appid)
);
