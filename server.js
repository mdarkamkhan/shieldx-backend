// ShieldX backend server
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ShortUniqueId = require('short-unique-id');
const uid = new ShortUniqueId({ length: 20 });

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'state.json');

// Create DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    lockActive: true,
    eepContacts: [],
    lastCode: null,
    lastCodeTs: 0,
    unlockWindowUntil: 0
  }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// GET status
app.get('/status', (req, res) => {
  const db = readDB();
  res.json({ ok: true, lockActive: db.lockActive, unlockWindowUntil: db.unlockWindowUntil });
});

// SET EEP contacts
app.post('/eep/set', (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) return res.json({ ok: false, error: "contacts must be array" });

  const db = readDB();
  db.eepContacts = contacts;
  writeDB(db);

  res.json({ ok: true, saved: contacts.length });
});

// Generate EEP code
app.post('/eep/generate', (req, res) => {
  const db = readDB();
  const code = uid(); // random 20 chars
  const ts = Date.now();

  db.lastCode = code;
  db.lastCodeTs = ts;

  writeDB(db);

  res.json({ ok: true, code, ts });
});

// Validate EEP code
app.post('/eep/validate', (req, res) => {
  const { code } = req.body;
  const db = readDB();

  if (!db.lastCode) return res.json({ ok: false, error: "No code created" });

  const now = Date.now();
  const windowMs = 3 * 60 * 1000; // 3 minutes

  if (code === db.lastCode && now - db.lastCodeTs <= windowMs) {
    db.unlockWindowUntil = now + windowMs;
    writeDB(db);
    return res.json({ ok: true, unlockWindowUntil: db.unlockWindowUntil });
  } else {
    return res.json({ ok: false, error: "Invalid or expired code" });
  }
});

// Check unlock window
app.get('/unlock/status', (req, res) => {
  const db = readDB();
  const active = db.unlockWindowUntil > Date.now();

  res.json({
    ok: true,
    unlockWindowActive: active,
    unlockWindowUntil: db.unlockWindowUntil
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("ShieldX backend running on port", PORT);
});
