// ============================================
// server/persistence.js - JSON File Database
// ============================================
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'players.json');

let players = {};
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      players = JSON.parse(raw);
    }
  } catch (e) {
    console.error('[DB] Load error:', e.message);
  }
  loaded = true;
}

function save() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(players, null, 2));
  } catch (e) {
    console.error('[DB] Save error:', e.message);
  }
}

function getPlayer(id) {
  if (!id) return null;
  ensureLoaded();
  return players[id] || null;
}

function updatePlayer(id, data) {
  if (!id) return;
  ensureLoaded();
  players[id] = { ...(players[id] || {}), ...data, lastSeen: Date.now() };
  save();
}

module.exports = { getPlayer, updatePlayer };
