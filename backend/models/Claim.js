const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../mediguard.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    extractedText TEXT NOT NULL,
    fraud INTEGER NOT NULL,
    probability REAL NOT NULL,
    decision TEXT NOT NULL,
    rejectionReason TEXT DEFAULT '',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const Claim = {
  save: function(data) {
    const stmt = db.prepare(`
      INSERT INTO claims (filename, extractedText, fraud, probability, decision, rejectionReason)
      VALUES (@filename, @extractedText, @fraud, @probability, @decision, @rejectionReason)
    `);
    return stmt.run(data);
  },
  find: function() {
    return db.prepare('SELECT * FROM claims ORDER BY timestamp DESC').all();
  },
  updateStatus: function(id, status) {
    const stmt = db.prepare('UPDATE claims SET decision = ? WHERE id = ?');
    return stmt.run(status, id);
  }
};

module.exports = Claim;
