import os
from db import get_db_connection

def drop_and_create_tables(cur):
    print("Dropping old kaggle tables...")
    cur.execute("DROP TABLE IF EXISTS kaggle_steam_apps CASCADE;")
    cur.execute("DROP TABLE IF EXISTS kaggle_steam_games CASCADE;")
    cur.execute("DROP TABLE IF EXISTS kaggle_raw_game_data CASCADE;")
    cur.execute("DROP TABLE IF EXISTS kaggle_game_analytics CASCADE;")

    print("Creating table kaggle_steam_apps...")
    cur.execute("""
        CREATE TABLE kaggle_steam_apps (
            appid INT PRIMARY KEY,
            name TEXT,
            last_updated TEXT,
            is_fetched BOOLEAN
        );
    """)

    print("Creating table kaggle_steam_games...")
    cur.execute("""
        CREATE TABLE kaggle_steam_games (
            app_id INT PRIMARY KEY,
            title TEXT,
            release_date TEXT,
            genres TEXT,
            categories TEXT,
            developer TEXT,
            publisher TEXT,
            original_price TEXT,
            discount_percentage FLOAT,
            discounted_price TEXT,
            dlc_available TEXT,
            age_rating TEXT,
            content_descriptor TEXT,
            about_description TEXT,
            win_support BOOLEAN,
            mac_support BOOLEAN,
            linux_support BOOLEAN,
            awards TEXT,
            overall_review TEXT,
            overall_review_percent FLOAT,
            overall_review_count FLOAT,
            recent_review TEXT,
            recent_review_percent FLOAT,
            recent_review_count FLOAT
        );
    """)

    print("Creating table kaggle_raw_game_data...")
    cur.execute("""
        CREATE TABLE kaggle_raw_game_data (
            appid INT PRIMARY KEY,
            steam_store_data TEXT,
            steamspy_data TEXT,
            fetched_at TEXT
        );
    """)

    print("Creating table kaggle_game_analytics...")
    cur.execute("""
        CREATE TABLE kaggle_game_analytics (
            appid INT PRIMARY KEY,
            name TEXT,
            genre_primary TEXT,
            developer TEXT,
            publisher TEXT,
            publisher_tier TEXT,
            price_initial TEXT,
            price_final TEXT,
            discount_percent TEXT,
            owners_min BIGINT,
            owners_max BIGINT,
            owners_midpoint BIGINT,
            positive_reviews BIGINT,
            negative_reviews BIGINT,
            tags TEXT,
            release_date TEXT,
            ccu BIGINT,
            peak_ccu BIGINT,
            pc_req_min TEXT,
            pc_req_rec TEXT,
            required_age TEXT,
            languages_count TEXT,
            achievement_count TEXT,
            dlc_count TEXT,
            is_early_access BOOLEAN,
            is_free BOOLEAN,
            steam_deck BOOLEAN,
            controller_support TEXT
        );
    """)

def ingest_csv(cur, table_name, csv_path):
    print(f"Ingesting into {table_name} from {csv_path}...")
    if not os.path.exists(csv_path):
        print(f" ERROR: {csv_path} not found!")
        return
    with open(csv_path, 'r', encoding='utf-8') as f:
        # We use psycopg3 cursor.copy for rapid steaming of CSV rows
        with cur.copy(f"COPY {table_name} FROM STDIN WITH (FORMAT CSV, HEADER)") as copy:
            while True:
                data = f.read(8192 * 1024)
                if not data:
                    break
                copy.write(data)
    print(f"  -> Finished ingesting {table_name}!")

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    # To prevent partial insertions corrupting data, we disable transactions or auto commit
    conn.autocommit = True
    
    try:
        drop_and_create_tables(cur)

        datasets_dir = os.path.join("..", "datasets")
        
        # 1. steam_apps.csv -> kaggle_steam_apps
        ingest_csv(cur, 'kaggle_steam_apps', os.path.join(datasets_dir, 'steam_apps.csv'))
        
        # 2. steam-games.csv -> kaggle_steam_games
        ingest_csv(cur, 'kaggle_steam_games', os.path.join(datasets_dir, 'steam-games.csv'))
        
        # 3. raw_game_data.csv -> kaggle_raw_game_data
        ingest_csv(cur, 'kaggle_raw_game_data', os.path.join(datasets_dir, 'raw_game_data.csv'))
        
        # 4. game_analytics.csv -> kaggle_game_analytics
        ingest_csv(cur, 'kaggle_game_analytics', os.path.join(datasets_dir, 'game_analytics.csv'))

        print("\nAll datasets ingested successfully!")
    except Exception as e:
        print(f"Failed to ingest: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
