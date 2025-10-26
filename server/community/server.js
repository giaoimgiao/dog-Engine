import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 持久化存储文件路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 从文件加载数据
function loadData(file, defaultValue) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error loading ${file}:`, e);
  }
  return defaultValue;
}

// 保存数据到文件
function saveData(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error saving ${file}:`, e);
  }
}

// 持久化存储 (自动从文件加载)
const USERS = new Map(Object.entries(loadData(USERS_FILE, {}))); // username -> { hash, role }
const PROMPTS = loadData(PROMPTS_FILE, []); // { id, name, prompt, likes, visible, createdAt, owner }
const ANNOUNCEMENTS = loadData(ANNOUNCEMENTS_FILE, []); // { id, message, createdAt }

// 定期保存数据
function saveAllData() {
  const usersObj = Object.fromEntries(USERS);
  saveData(USERS_FILE, usersObj);
  saveData(PROMPTS_FILE, PROMPTS);
  saveData(ANNOUNCEMENTS_FILE, ANNOUNCEMENTS);
}

// 每30秒自动保存一次
setInterval(saveAllData, 30000);

// 进程退出时保存数据
process.on('SIGINT', () => {
  console.log('Saving data before exit...');
  saveAllData();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Saving data before exit...');
  saveAllData();
  process.exit(0);
});

const JWT_SECRET = process.env.JWT_SECRET || 'community-secret';
const PORT = process.env.PORT || 8080;

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
  const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/community/health', (req, res) => res.json({ ok: true }));

app.post('/api/community/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username/password required' });
  if (USERS.has(username)) return res.status(400).json({ error: 'user exists' });
  const hash = await bcrypt.hash(password, 10);
  USERS.set(username, { hash, role: 'user' });
  saveAllData(); // 保存到文件
  res.json({ ok: true });
});

app.post('/api/community/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const u = USERS.get(username);
  if (!u) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, u.hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ username, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: u.role });
});

app.get('/api/community/auth/me', auth, (req, res) => {
  const { username } = req.user || {};
  const u = USERS.get(username);
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json({ username, role: u.role });
});

app.get('/api/community/prompts/visible', (req, res) => {
  res.json({ prompts: PROMPTS.filter(p => p.visible).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post('/api/community/prompts', auth, (req, res) => {
  const { name, prompt, visible } = req.body || {};
  if (!name || !prompt) return res.status(400).json({ error: 'name/prompt required' });
  const item = { id: nanoid(), name, prompt, likes: 0, visible: !!visible, createdAt: new Date().toISOString(), owner: req.user?.username || 'unknown' };
  PROMPTS.push(item);
  saveAllData(); // 保存到文件
  res.json({ ok: true, id: item.id });
});

// Admin list all prompts
app.get('/api/community/prompts', auth, (req, res) => {
  const u = USERS.get(req.user?.username);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  res.json({ prompts: PROMPTS.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post('/api/community/prompts/:id/like', (req, res) => {
  const id = req.params.id;
  const idx = PROMPTS.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  PROMPTS[idx].likes += 1;
  saveAllData(); // 保存到文件
  res.json({ likes: PROMPTS[idx].likes });
});

// Edit prompt (owner or admin)
app.put('/api/community/prompts/:id', auth, (req, res) => {
  const id = req.params.id;
  const idx = PROMPTS.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const user = USERS.get(req.user?.username);
  const isOwner = PROMPTS[idx].owner === req.user?.username;
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });
  const { name, prompt, visible } = req.body || {};
  if (typeof name === 'string') PROMPTS[idx].name = name;
  if (typeof prompt === 'string') PROMPTS[idx].prompt = prompt;
  if (typeof visible === 'boolean') PROMPTS[idx].visible = visible;
  saveAllData(); // 保存到文件
  res.json({ ok: true, prompt: PROMPTS[idx] });
});

// Delete prompt (owner or admin)
app.delete('/api/community/prompts/:id', auth, (req, res) => {
  const id = req.params.id;
  const idx = PROMPTS.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const user = USERS.get(req.user?.username);
  const isOwner = PROMPTS[idx].owner === req.user?.username;
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });
  PROMPTS.splice(idx, 1);
  saveAllData(); // 保存到文件
  res.json({ ok: true });
});

// Announcements
app.get('/api/community/announcements', (req, res) => {
  res.json({ announcements: ANNOUNCEMENTS.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)) });
});

app.post('/api/community/announcements', auth, (req, res) => {
  const { username } = req.user || {};
  const u = USERS.get(username);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message required' });
  const item = { id: nanoid(), message: String(message).trim(), createdAt: new Date().toISOString() };
  ANNOUNCEMENTS.push(item);
  saveAllData(); // 保存到文件
  res.json({ ok: true, id: item.id });
});

// static upload page
app.use(express.static(path.join(__dirname, 'public')));
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

app.listen(PORT, () => {
  console.log(`Community server running on :${PORT}`);
  console.log(`Data will be persisted to: ${DATA_DIR}`);
});

// Seed default admin account
(async () => {
  const adminUser = process.env.ADMIN_USER || 'giao';
  const adminPass = process.env.ADMIN_PASS || 'zhang666666';
  if (!USERS.has(adminUser)) {
    const hash = await bcrypt.hash(adminPass, 10);
    USERS.set(adminUser, { hash, role: 'admin' });
    saveAllData(); // 保存初始admin账户
    console.log(`Seeded admin account: ${adminUser}`);
  }
  console.log(`Loaded ${USERS.size} users, ${PROMPTS.length} prompts, ${ANNOUNCEMENTS.length} announcements from disk`);
})();


