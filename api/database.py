import os
import psycopg2
import psycopg2.extras
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def get_pg():
    return psycopg2.connect(
        host=os.getenv("DB_ESCRITA_HOST"),
        port=int(os.getenv("DB_ESCRITA_PORT", 6543)),
        user=os.getenv("DB_ESCRITA_USER"),
        password=os.getenv("DB_ESCRITA_PASSWORD"),
        database=os.getenv("DB_ESCRITA_DATABASE"),
        sslmode="require",
        connect_timeout=5,
        cursor_factory=psycopg2.extras.RealDictCursor
    )

def test_pg():
    try:
        conn = get_pg()
        conn.close()
        return True
    except Exception as e:
        print(f"[PG] indisponível: {e}")
        return False
    
def get_mysql():
    return mysql.connector.connect(
        host=os.getenv("DB_LEITURA_HOST"),
        port=int(os.getenv("DB_LEITURA_PORT", 3306)),
        user=os.getenv("DB_LEITURA_USER"),
        password=os.getenv("DB_LEITURA_PASSWORD"),
        database=os.getenv("DB_LEITURA_DATABASE"),
        connection_timeout=5,
        connect_timeout=5
    )

def test_mysql():
    try:
        conn = get_mysql()
        conn.close()
        return True
    except Exception as e:
        print(f"[MYSQL] indisponível: {e}")
        return False
