import sqlite3

DB_NAME = "mediguard.db"


# ---------------- CREATE TABLE ----------------
def create_table():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        original_name TEXT,
        stored_name TEXT,
        file_type TEXT,

        raw_text TEXT,
        clean_text TEXT,

        amount TEXT,
        date TEXT,

        prediction TEXT,
        confidence REAL,

        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


# ---------------- INSERT RECORD ----------------
def insert_record(file_data, ocr_result, prediction=None, confidence=None):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Extract fields safely
    fields = ocr_result.get("fields", {})

    amount = None
    date = None

    if fields.get("amounts"):
        amount = fields["amounts"][0]

    if fields.get("dates"):
        date = fields["dates"][0]

    cursor.execute("""
    INSERT INTO records 
    (original_name, stored_name, file_type, raw_text, clean_text, amount, date, prediction, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        file_data.get("original_name"),
        file_data.get("stored_name"),
        file_data.get("file_type"),

        ocr_result.get("raw_text"),
        ocr_result.get("clean_text"),

        amount,
        date,

        prediction,
        confidence
    ))

    conn.commit()
    conn.close()


# ---------------- FETCH ALL RECORDS ----------------
def get_all_records():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM records")
    rows = cursor.fetchall()

    conn.close()
    return rows


# ---------------- FETCH BY ID ----------------
def get_record_by_id(record_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM records WHERE id = ?", (record_id,))
    row = cursor.fetchone()

    conn.close()
    return row


# ---------------- DELETE RECORD ----------------
def delete_record(record_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM records WHERE id = ?", (record_id,))

    conn.commit()
    conn.close()
