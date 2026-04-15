-- Indices for optimized joining
CREATE INDEX IF NOT EXISTS idx_games_appid ON games(appid);
-- Note: game_analytics and steam_games tables are created by import_datasets.py
-- These indices will be applicable once those tables exist.
CREATE INDEX IF NOT EXISTS idx_game_analytics_appid ON game_analytics(appid);
CREATE INDEX IF NOT EXISTS idx_steam_games_appid ON steam_games(app_id);
