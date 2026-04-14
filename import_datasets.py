import zipfile
import os
import csv
import psycopg
import re

# Database connection details
DB_PARAMS = {
    "dbname": "steam_profiles",
    "user": "steamuser",
    "password": "steampassword",
    "host": "127.0.0.1",
    "port": "5432"
}

def clean_name(name):
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9_]', '_', name)
    if not name or name[0].isdigit():
        name = '_' + name
    return name

def import_datasets():
    print("Connecting to database...")
    try:
        conn = psycopg.connect(**DB_PARAMS)
    except Exception as e:
        print(f"Failed to connect to db: {e}")
        return

    conn.autocommit = True
    datasets_dir = 'datasets'

    for zip_name in os.listdir(datasets_dir):
        if not zip_name.endswith('.zip'):
            continue
            
        zip_path = os.path.join(datasets_dir, zip_name)
        print(f"Processing zip file: {zip_path}")
        
        with zipfile.ZipFile(zip_path, 'r') as z:
            for file_info in z.infolist():
                if not file_info.filename.endswith('.csv'):
                    continue
                
                # Exclude macOS resource fork files like __MACOSX/._steam-games.csv
                if file_info.filename.startswith('__MACOSX') or os.path.basename(file_info.filename).startswith('._'):
                    continue

                table_name = clean_name(os.path.splitext(os.path.basename(file_info.filename))[0])
                print(f"\n  -> Extracting and inserting {file_info.filename} to table {table_name}")
                
                # Get Headers first
                with z.open(file_info.filename) as f:
                    first_line = f.readline().decode('utf-8', errors='ignore')
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
                
                # Stream the whole file directly to DB
                with z.open(file_info.filename) as f:
                    print(f"     Starting COPY from {file_info.filename}...")
                    try:
                        with conn.cursor() as cur:
                            with cur.copy(f'COPY "{table_name}" FROM STDIN WITH (FORMAT CSV, HEADER)') as copy:
                                while data := f.read(65536):
                                    copy.write(data)
                        print(f"     COPY completed for {file_info.filename}")
                    except Exception as e:
                        print(f"     Error copying {file_info.filename}: {e}")

    conn.close()
    print("All datasets processed.")

if __name__ == '__main__':
    import_datasets()
