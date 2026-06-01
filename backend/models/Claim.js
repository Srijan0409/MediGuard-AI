const Database = require('better-sqlite3');
const path = require('path');
const mongoose = require('mongoose');

// SQLite Setup (Fallback)
const sqliteDb = new Database(path.join(__dirname, '../../mediguard.db'));

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    extractedText TEXT NOT NULL,
    fraud INTEGER NOT NULL,
    probability REAL NOT NULL,
    decision TEXT NOT NULL,
    rejectionReason TEXT DEFAULT '',
    amount INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Execute column migration if claims table already exists without the amount column
try {
  sqliteDb.exec("ALTER TABLE claims ADD COLUMN amount INTEGER DEFAULT 0");
} catch (err) {
  // Column may already exist, ignore this error
}

// MongoDB Claim Schema & Model
const ClaimSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  extractedText: { type: String, required: true },
  fraud: { type: Number, required: true },
  probability: { type: Number, required: true },
  decision: { type: String, required: true },
  rejectionReason: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const MongoClaim = mongoose.models.Claim || mongoose.model('Claim', ClaimSchema);

const Claim = {
  save: async function(data) {
    // If MongoDB is connected, save to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = new MongoClaim({
          filename: data.filename,
          extractedText: data.extractedText,
          fraud: data.fraud,
          probability: data.probability,
          decision: data.decision,
          rejectionReason: data.rejectionReason,
          amount: data.amount || 0
        });
        const saved = await doc.save();
        return { id: saved._id.toString() };
      } catch (err) {
        console.error("❌ MongoDB Save failed, falling back to SQLite:", err.message);
      }
    }

    // Fallback SQLite Save
    const stmt = sqliteDb.prepare(`
      INSERT INTO claims (filename, extractedText, fraud, probability, decision, rejectionReason, amount)
      VALUES (@filename, @extractedText, @fraud, @probability, @decision, @rejectionReason, @amount)
    `);
    const runResult = stmt.run({
      filename: data.filename,
      extractedText: data.extractedText,
      fraud: data.fraud,
      probability: data.probability,
      decision: data.decision,
      rejectionReason: data.rejectionReason || '',
      amount: data.amount || 0
    });
    return { id: runResult.lastInsertRowid };
  },

  find: async function() {
    // If MongoDB is connected, fetch from MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await MongoClaim.find().sort({ timestamp: -1 });
        return docs.map(doc => ({
          id: doc._id.toString(),
          filename: doc.filename,
          extractedText: doc.extractedText,
          fraud: doc.fraud,
          probability: doc.probability,
          decision: doc.decision,
          rejectionReason: doc.rejectionReason || '',
          amount: doc.amount || 0,
          timestamp: doc.timestamp
        }));
      } catch (err) {
        console.error("❌ MongoDB Find failed, falling back to SQLite:", err.message);
      }
    }

    // Fallback SQLite Find
    return sqliteDb.prepare('SELECT * FROM claims ORDER BY timestamp DESC').all();
  },

  updateStatus: async function(id, status) {
    // If MongoDB is connected and the ID looks like a MongoDB ID
    if (mongoose.connection.readyState === 1 && typeof id === 'string' && id.length > 10) {
      try {
        await MongoClaim.findByIdAndUpdate(id, { decision: status });
        return;
      } catch (err) {
        console.error("❌ MongoDB Update failed, falling back to SQLite:", err.message);
      }
    }

    // Fallback SQLite Update
    const stmt = sqliteDb.prepare('UPDATE claims SET decision = ? WHERE id = ?');
    return stmt.run(status, id);
  }
};

module.exports = Claim;
