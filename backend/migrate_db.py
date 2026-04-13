from db import get_db_connection

def migrate():
    print("Migrating DB...")
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Add columns to games if not exist
        cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_windows BOOLEAN;")
        cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_mac BOOLEAN;")
        cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_linux BOOLEAN;")
        cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS release_date VARCHAR(50);")
        
        # Create game_price_history
        cur.execute("""
            CREATE TABLE IF NOT EXISTS game_price_history (
                id SERIAL PRIMARY KEY,
                appid INT REFERENCES games(appid),
                price_initial INT,
                price_final INT,
                discount_percent INT,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        print("Done!")
    except Exception as e:
        print(f"Error migrating: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    migrate()
