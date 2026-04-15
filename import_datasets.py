import zipfile
import os
import csv
import psycopg
import re
import urllib.request

# Database connection details
DB_PARAMS = {
    "dbname": "steam_profiles",
    "user": "steamuser",
    "password": "steampassword",
    "host": "127.0.0.1",
    "port": "5432"
}

# Dataset download URLs
DATASETS = {
    "steam-full-market-dataset.zip": "https://www.kaggle.com/api/v1/datasets/download/evyatarbensegal/steam-full-market-dataset",
    "steam-store-data.zip": "https://www.kaggle.com/api/v1/datasets/download/amanbarthwal/steam-store-data"
}

# Specific files to extract
FILES_TO_EXTRACT = {
    "steam-full-market-dataset.zip": ["game_analytics.csv"],
    "steam-store-data.zip": ["steam-games.csv"]
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
                    print(f"{file_to_extract} already exists in {datasets_dir}, skipping extraction.")

def link_tables(conn):
    print("\nLinking tables and optimizing indices...")
    with conn.cursor() as cur:
        # 1. game_analytics: Convert appid to INT and index it
        print("  -> Optimizing game_analytics (appid)...")
        cur.execute('''
            ALTER TABLE game_analytics 
            ALTER COLUMN appid TYPE INTEGER USING (NULLIF(appid, '')::INTEGER);
            CREATE INDEX IF NOT EXISTS idx_game_analytics_appid ON game_analytics(appid);
        ''')

        # 2. steam_games: Convert app_id to INT and index it
        print("  -> Optimizing steam_games (app_id)...")
        cur.execute('''
            ALTER TABLE steam_games 
            ALTER COLUMN app_id TYPE INTEGER USING (NULLIF(app_id, '')::INTEGER);
            CREATE INDEX IF NOT EXISTS idx_steam_games_appid ON steam_games(app_id);
        ''')

        # 3. games: Ensure appid is indexed
        print("  -> Optimizing games (appid)...")
        cur.execute('CREATE INDEX IF NOT EXISTS idx_games_appid ON games(appid);')
        
    print("Optimization completed.")

def import_datasets():
    datasets_dir = 'datasets'
    
    # Ensure datasets are downloaded and extracted
    download_datasets(datasets_dir)
    extract_specific_files(datasets_dir)

    print("\nConnecting to database...")
    try:
        conn = psycopg.connect(**DB_PARAMS)
    except Exception as e:
        print(f"Failed to connect to db: {e}")
        return

    conn.autocommit = True

    # Import target CSV files
    target_csvs = ["game_analytics.csv", "steam-games.csv"]
    
    for csv_name in target_csvs:
        csv_path = os.path.join(datasets_dir, csv_name)
        if not os.path.exists(csv_path):
            print(f"Skipping {csv_name} (not found)...")
            continue
            
        table_name = clean_name(os.path.splitext(csv_name)[0])
        print(f"\n  -> Processing {csv_name} into table {table_name}")
        
        # Get Headers first
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            first_line = f.readline()
            reader = csv.reader([first_line])
            headers = next(reader)
            
            cleaned_headers = [clean_name(h) for h in headers]
            seen = {}
            final_headers = []
            for h in cleaned_headers:
                if h in seen:
                    seen[h] += 1
                    final_headers.append(f"{h}_{seen[h]}")
                else:
                    seen[h] = 0
                    final_headers.append(h)
            
            columns_def = ", ".join([f'"{h}" TEXT' for h in final_headers])
            create_query = f'DROP TABLE IF EXISTS "{table_name}"; CREATE TABLE "{table_name}" ({columns_def});'
            
            with conn.cursor() as cur:
                cur.execute(create_query)
                print(f"     Created table {table_name} with {len(final_headers)} columns.")
        
        # Stream the file directly to DB
        print(f"     Starting COPY from {csv_name}...")
        try:
            with open(csv_path, 'rb') as f:
                with conn.cursor() as cur:
                    with cur.copy(f'COPY "{table_name}" FROM STDIN WITH (FORMAT CSV, HEADER)') as copy:
                        while data := f.read(65536):
                            copy.write(data)
            print(f"     COPY completed for {csv_name}")
        except Exception as e:
            print(f"     Error copying {csv_name}: {e}")

    # Link and optimize tables
    link_tables(conn)

    conn.close()
    print("\nAll datasets processed.")

if __name__ == '__main__':
    import_datasets()
