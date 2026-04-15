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
