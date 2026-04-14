import psycopg

DB_PARAMS = {
    "dbname": "steam_profiles",
    "user": "steamuser",
    "password": "steampassword",
    "host": "127.0.0.1",
    "port": "5432"
}

try:
    conn = psycopg.connect(**DB_PARAMS)
    with conn.cursor() as cur:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = [row[0] for row in cur.fetchall()]
        print("Tables in database:", tables)
        
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            print(f"Table '{table}' has {count} rows.")
except Exception as e:
    print("Error:", e)
