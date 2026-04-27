import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_SCHEMA = os.getenv('DB_SCHEMA', 'public')

def get_db_connection():
    conn = psycopg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        dbname=os.getenv('DB_NAME', 'steam_profiles'),
        user=os.getenv('DB_USER', 'steamuser'),
        password=os.getenv('DB_PASSWORD', 'steampassword'),
        port=os.getenv('DB_PORT', '5432')
    )
    return conn
