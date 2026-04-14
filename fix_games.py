import psycopg
conn=psycopg.connect("dbname=steam_profiles user=steamuser password=steampassword host=127.0.0.1 port=5432")
conn.autocommit=True
cur=conn.cursor()
try:
    cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_windows BOOLEAN;")
    cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_mac BOOLEAN;")
    cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS platform_linux BOOLEAN;")
    cur.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS release_date VARCHAR(50);")
except Exception as e:
    print(e)
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='games';")
print("Games columns:", cur.fetchall())
