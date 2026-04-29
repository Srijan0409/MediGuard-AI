-- Create records table

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
);
