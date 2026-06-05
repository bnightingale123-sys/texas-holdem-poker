// ============================================
// server/auth.js - Account & Session Management
// ============================================
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'accounts.json');
const PBKDF2_ITERATIONS = 100000;
const TOKEN_BYTES = 32;

let accounts = {};
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  try {
    if (fs.existsSync(DB_PATH)) {
      accounts = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[Auth] Load error:', e.message);
  }
  loaded = true;
}

function save() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error('[Auth] Save error:', e.message);
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Register a new account.
 * Username: 3-16 chars, alphanumeric + underscore.
 * Password: 4-32 chars.
 */
function register(username, password) {
  ensureLoaded();

  if (!username || typeof username !== 'string') {
    return { ok: false, reason: '用户名不能为空' };
  }
  if (!/^[a-zA-Z0-9_一-龥]{2,16}$/.test(username)) {
    return { ok: false, reason: '用户名需2-16位，支持字母、数字、下划线、中文' };
  }
  if (!password || password.length < 4 || password.length > 32) {
    return { ok: false, reason: '密码需4-32位' };
  }

  const key = username.toLowerCase();
  if (accounts[key]) {
    return { ok: false, reason: '用户名已存在' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  accounts[key] = {
    username,
    password: hashPassword(password, salt),
    salt,
    token: null,
    createdAt: Date.now()
  };
  save();

  console.log(`[Auth] Registered: ${username}`);
  return { ok: true };
}

/**
 * Log in with username and password.
 * Returns a session token.
 */
function login(username, password) {
  ensureLoaded();

  if (!username || !password) {
    return { ok: false, reason: '用户名或密码不能为空' };
  }

  const key = username.toLowerCase();
  const account = accounts[key];
  if (!account) {
    return { ok: false, reason: '用户名或密码错误' };
  }

  if (hashPassword(password, account.salt) !== account.password) {
    return { ok: false, reason: '用户名或密码错误' };
  }

  // Generate new session token
  const token = generateToken();
  account.token = token;
  save();

  console.log(`[Auth] Login: ${username}`);
  return { ok: true, token };
}

/**
 * Verify a session token for auto-login.
 */
function verifyToken(username, token) {
  ensureLoaded();

  if (!username || !token) return false;

  const key = username.toLowerCase();
  const account = accounts[key];
  if (!account) return false;
  if (!account.token) return false;

  const a = Buffer.from(account.token);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Logout — clear session token.
 */
function logout(username) {
  ensureLoaded();
  const key = username.toLowerCase();
  if (accounts[key]) {
    accounts[key].token = null;
    save();
    console.log(`[Auth] Logout: ${username}`);
  }
}

module.exports = { register, login, verifyToken, logout };
