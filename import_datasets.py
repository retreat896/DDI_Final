import zipfile
import os
import csv
import time
import psycopg
import re
from dotenv import load_dotenv
import urllib.request

# ── Rate-limit configuration ─────────────────────────────────────────────────
# Maximum MB/s sent to the database during COPY.
# Lower = gentler on the server.  Raise once confirmed stable.
MAX_MB_PER_SEC = 2.0          # target upload ceiling (MB/s)
CHUNK_SIZE     = 32 * 1024    # bytes read per chunk  (32 KB)
SLEEP_BETWEEN_FILES = 3       # seconds to pause between the two CSV files
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

DB_PARAMS = {
    "dbname":   os.getenv("DB_NAME"),
    "user":     os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host":     os.getenv("DB_HOST"),
    "port":     os.getenv("DB_PORT"),
}

DB_SCHEMA = os.getenv("DB_SCHEMA", "public")

DATASETS = {
    "steam-full-market-dataset.zip": "https://www.kaggle.com/api/v1/datasets/download/evyatarbensegal/steam-full-market-dataset",
    "steam-store-data.zip":          "https://www.kaggle.com/api/v1/datasets/download/amanbarthwal/steam-store-data",
}

FILES_TO_EXTRACT = {
    "steam-full-market-dataset.zip": ["game_analytics.csv"],
    "steam-store-data.zip":          ["steam-games.csv"],
}


def clean_name(name):
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9_]', '_', name)
    if not name or name[0].isdigit():
        name = '_' + name
    return name


def download_datasets(datasets_dir):
    if not os.path.exists(datasets_dir):
        os.makedirs(datasets_dir)
        print(f"Created directory: {datasets_dir}")

    for filename, url in DATASETS.items():
        path = os.path.join(datasets_dir, filename)
        if not os.path.exists(path):
            print(f"Downloading {filename} from {url}...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"Successfully downloaded {filename}")
            except Exception as e:
                print(f"Failed to download {filename}: {e}")
        else:
            print(f"Dataset zip '{filename}' already exists, skipping download.")


def extract_specific_files(datasets_dir):
    for zip_name, files in FILES_TO_EXTRACT.items():
        zip_path = os.path.join(datasets_dir, zip_name)
        if not os.path.exists(zip_path):
            continue

        with zipfile.ZipFile(zip_path, 'r') as z:
            for file_to_extract in files:
                target_path = os.path.join(datasets_dir, file_to_extract)
                if not os.path.exists(target_path):
                    print(f"Extracting {file_to_extract} from {zip_name}...")
                    z.extract(file_to_extract, datasets_dir)
                    print(f"Extracted to {target_path}")
                else:
                    print(f"{file_to_extract} already exists, skipping extraction.")


def link_tables(conn):
    print("\nLinking tables and optimizing indices...")
    with conn.cursor() as cur:
        print("  -> Optimizing game_analytics (appid)...")
        cur.execute(f'''
            ALTER TABLE "{DB_SCHEMA}"."game_analytics"
            ALTER COLUMN appid TYPE INTEGER USING (NULLIF(appid, '')::INTEGER);
            CREATE INDEX IF NOT EXISTS idx_game_analytics_appid ON "{DB_SCHEMA}"."game_analytics"(appid);
        ''')

        print("  -> Optimizing steam_games (app_id)...")
        cur.execute(f'''
            ALTER TABLE "{DB_SCHEMA}"."steam_games"
            ALTER COLUMN app_id TYPE INTEGER USING (NULLIF(app_id, '')::INTEGER);
            CREATE INDEX IF NOT EXISTS idx_steam_games_appid ON "{DB_SCHEMA}"."steam_games"(app_id);
        ''')

    print("Optimization completed.")


def _fmt_bytes(n):
    """Human-readable byte count."""
    for unit in ('B', 'KB', 'MB', 'GB'):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def rate_limited_copy(cur, table_name, csv_path):
    """
    Stream a CSV into PostgreSQL COPY, throttled to MAX_MB_PER_SEC.

    Strategy
    --------
    After each CHUNK_SIZE read we check how long that chunk took.
    If it finished faster than the rate limit allows, we sleep for the
    remaining time before sending the next chunk.  This keeps the average
    throughput at or below MAX_MB_PER_SEC without any external libraries.
    """
    file_size  = os.path.getsize(csv_path)
    bytes_sent = 0
    chunks     = 0
    start_all  = time.monotonic()

    # Seconds per chunk at the target rate
    min_chunk_secs = CHUNK_SIZE / (MAX_MB_PER_SEC * 1024 * 1024)

    print(f"     Streaming {csv_path}  ({_fmt_bytes(file_size)})  "
          f"at ≤ {MAX_MB_PER_SEC} MB/s …")

    with open(csv_path, 'rb') as f:
        with cur.copy(f'COPY \"{DB_SCHEMA}\".\"{table_name}\" FROM STDIN WITH (FORMAT CSV, HEADER)') as copy:
            while True:
                t0   = time.monotonic()
                data = f.read(CHUNK_SIZE)
                if not data:
                    break

                copy.write(data)
                bytes_sent += len(data)
                chunks     += 1

                # ── Rate limiting ──────────────────────────────────────────
                elapsed   = time.monotonic() - t0
                to_sleep  = min_chunk_secs - elapsed
                if to_sleep > 0:
                    time.sleep(to_sleep)

                # Progress every 200 chunks (~6 MB)
                if chunks % 200 == 0:
                    pct       = bytes_sent / file_size * 100
                    rate      = bytes_sent / (time.monotonic() - start_all) / (1024 * 1024)
                    remaining = (file_size - bytes_sent) / (rate * 1024 * 1024) if rate > 0 else 0
                    print(f"       {pct:5.1f}%  {_fmt_bytes(bytes_sent)} / {_fmt_bytes(file_size)}"
                          f"  {rate:.2f} MB/s  ETA {remaining:.0f}s")

    total_elapsed = time.monotonic() - start_all
    avg_rate      = bytes_sent / total_elapsed / (1024 * 1024) if total_elapsed > 0 else 0
    print(f"     COPY complete: {_fmt_bytes(bytes_sent)} in {total_elapsed:.1f}s "
          f"(avg {avg_rate:.2f} MB/s)")


def import_datasets():
    datasets_dir = 'datasets'

    download_datasets(datasets_dir)
    extract_specific_files(datasets_dir)

    print("\nConnecting to database...")
    try:
        conn = psycopg.connect(**DB_PARAMS)
    except Exception as e:
        print(f"Failed to connect to db: {e}")
        return

    conn.autocommit = True

    # Create schema if it doesn't exist
    with conn.cursor() as cur:
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}";')
        print(f"Schema '{DB_SCHEMA}' ready.")

    target_csvs = ["game_analytics.csv", "steam-games.csv"]

    for i, csv_name in enumerate(target_csvs):
        csv_path = os.path.join(datasets_dir, csv_name)
        if not os.path.exists(csv_path):
            print(f"Skipping {csv_name} (not found)...")
            continue

        table_name = clean_name(os.path.splitext(csv_name)[0])
        print(f"\n  -> Processing {csv_name} into table '{table_name}'")

        # --- Create table from headers ---
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            first_line = f.readline()
            reader     = csv.reader([first_line])
            headers    = next(reader)

            cleaned_headers = [clean_name(h) for h in headers]
            seen, final_headers = {}, []
            for h in cleaned_headers:
                if h in seen:
                    seen[h] += 1
                    final_headers.append(f"{h}_{seen[h]}")
                else:
                    seen[h] = 0
                    final_headers.append(h)

            columns_def  = ", ".join([f'"{h}" TEXT' for h in final_headers])
            create_query = (
                f'DROP TABLE IF EXISTS "{DB_SCHEMA}"."{table_name}"; '
                f'CREATE TABLE "{DB_SCHEMA}"."{table_name}" ({columns_def});'
            )
            with conn.cursor() as cur:
                cur.execute(create_query)
                print(f"     Created table '{DB_SCHEMA}.{table_name}' with {len(final_headers)} columns.")

        # --- Rate-limited COPY ---
        try:
            with conn.cursor() as cur:
                rate_limited_copy(cur, table_name, csv_path)
        except Exception as e:
            print(f"     Error copying {csv_name}: {e}")

        # Pause between files so the DB server can breathe
        if i < len(target_csvs) - 1:
            print(f"\n     Pausing {SLEEP_BETWEEN_FILES}s before next file…")
            time.sleep(SLEEP_BETWEEN_FILES)

    link_tables(conn)
    conn.close()
    print("\nAll datasets processed.")


if __name__ == '__main__':
    import_datasets()
