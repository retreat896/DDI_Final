from db import get_db_connection

def count_rows():
    conn = get_db_connection()
    cur = conn.cursor()
    tables = [
        "kaggle_steam_apps",
        "kaggle_steam_games",
        "kaggle_raw_game_data",
        "kaggle_game_analytics"
    ]
    for t in tables:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            count = cur.fetchone()[0]
            print(f"{t}: {count} rows")
        except Exception as e:
            print(f"{t}: Error / Not Created Yet ({e})")
            conn.rollback()

if __name__ == "__main__":
    count_rows()
