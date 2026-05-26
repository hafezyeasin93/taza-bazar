require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
// Emergency Render-free-tier strategy: keep the database inside the project root.
// This intentionally ignores /var/data and DATA_DIR so the deployed app always boots from ./data/db.json.
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LOG_FILE = path.join(DATA_DIR, 'activity.log');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Tazabazar@2026';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update(ADMIN_PASSWORD + ':tazabazar.bd.com:session').digest('hex');
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const PAYMENT_NUMBERS = { bkash: '01891548610', nagad: '01629518850' };

app.use(cors({ credentials: true, origin: true }));
app.use(bodyParser.json({ limit: '14mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '14mb' }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(UPLOADS_DIR));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSONAtomic(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('[DB] Read failed:', err.message);
    return fallback;
  }
}

function hashPassword(password, salt) {
  const passwordSalt = salt || crypto.randomBytes(18).toString('hex');
  const hash = crypto.scryptSync(String(password), passwordSalt, 64).toString('hex');
  return { hash, salt: passwordSalt, algorithm: 'scrypt' };
}

function verifyPassword(password, auth) {
  if (!auth || !auth.passwordHash || !auth.passwordSalt) return false;
  const computed = crypto.scryptSync(String(password), auth.passwordSalt, 64);
  const stored = Buffer.from(auth.passwordHash, 'hex');
  return stored.length === computed.length && crypto.timingSafeEqual(stored, computed);
}

function seedProducts() {
  return {
    mango: {
      id: 'mango',
      name: 'খাগড়াছড়ির প্রিমিয়াম আম',
      englishName: 'Premium Mango',
      unit: 'কেজি',
      price: 120,
      minQty: 1,
      maxQty: 50,
      stock: true,
      badge: 'Limited Hill Tracts Harvest',
      description: 'রামগড়, খাগড়াছড়ি থেকে সংগ্রহ করা প্রিমিয়াম রুপালি আম—মিষ্টি, রসালো ও হাতে বাছাই করা।',
      emoji: '🥭',
      images: []
    },
    litchi: {
      id: 'litchi',
      name: 'খাগড়াছড়ির প্রিমিয়াম চায়না-৩ লিচু',
      englishName: 'Premium China-3 Litchi',
      unit: 'কেজি',
      price: 220,
      minQty: 1,
      maxQty: 50,
      stock: true,
      badge: 'In Stock',
      description: 'পার্বত্য এলাকার নির্বাচিত চায়না-৩ লিচু—সুগন্ধি, সতেজ এবং প্রিমিয়াম গ্রেডে প্যাক করা।',
      emoji: '🍒',
      images: []
    }
  };
}

function defaultDB() {
  const auth = hashPassword(ADMIN_PASSWORD);
  return {
    version: 2,
    site: {
      name: 'tazabazar.bd.com',
      owner: 'মোঃ ইয়াসিন (MD Yeasin)',
      address: 'Ramgarh, Khagrachhari',
      addressBn: 'রামগড়, খাগড়াছড়ি',
      phone: '01629518850',
      email: 'hafezyeasin93@gmail.com',
      trustBanner: 'নিরাপদ পেমেন্ট — ১০০% নিরাপদ অগ্রিম পেমেন্ট। বিকাশ বা নগদের মাধ্যমে পেমেন্ট করে ট্রানজেকশন আইডি দিয়ে আপনার অর্ডারটি নিশ্চিত করুন।'
    },
    payments: PAYMENT_NUMBERS,
    auth: {
      username: ADMIN_USERNAME,
      passwordHash: auth.hash,
      passwordSalt: auth.salt,
      passwordAlgorithm: auth.algorithm
    },
    products: seedProducts(),
    orders: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function migrateDB(db) {
  let changed = false;
  if (!db || typeof db !== 'object') { db = defaultDB(); changed = true; }
  if (!db.site) { db.site = defaultDB().site; changed = true; }
  if (!db.payments) { db.payments = PAYMENT_NUMBERS; changed = true; }
  if (!db.products) { db.products = seedProducts(); changed = true; }
  const seed = seedProducts();
  ['mango', 'litchi'].forEach(id => {
    if (!db.products[id]) { db.products[id] = seed[id]; changed = true; }
    if (!Array.isArray(db.products[id].images)) { db.products[id].images = []; changed = true; }
    ['id','name','englishName','unit','price','minQty','maxQty','stock','badge','description','emoji'].forEach(k => {
      if (db.products[id][k] === undefined) { db.products[id][k] = seed[id][k]; changed = true; }
    });
  });
  if (!Array.isArray(db.orders)) { db.orders = []; changed = true; }
  if (!db.auth || !db.auth.passwordHash || !db.auth.passwordSalt) {
    const legacyPassword = db.adminPassword || ADMIN_PASSWORD;
    const auth = hashPassword(legacyPassword);
    db.auth = { username: db.adminUsername || ADMIN_USERNAME, passwordHash: auth.hash, passwordSalt: auth.salt, passwordAlgorithm: auth.algorithm };
    delete db.adminPassword; delete db.adminUsername;
    changed = true;
  }
  if (db.auth.username !== ADMIN_USERNAME) {
    // Lock production username to the requested secure credential.
    db.auth.username = ADMIN_USERNAME;
    changed = true;
  }
  db.updatedAt = db.updatedAt || new Date().toISOString();
  return { db, changed };
}

function loadDB() {
  const migrated = migrateDB(readJSON(DB_FILE, defaultDB()));
  if (migrated.changed) saveDB(migrated.db);
  return migrated.db;
}

function saveDB(db) {
  db.updatedAt = new Date().toISOString();
  writeJSONAtomic(DB_FILE, db);
  try { fs.copyFileSync(DB_FILE, DB_FILE + '.bak'); } catch (e) {}
}

function appendLog(type, message, meta) {
  ensureDir(DATA_DIR);
  const log = {
    id: Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase(),
    type, message, meta: meta || {}, createdAt: new Date().toISOString()
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(log) + '\n');
  return log;
}

function readLogs(limit = 150) {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse().map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index > -1) acc[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return acc;
  }, {});
}

function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + SESSION_MAX_AGE_MS })).toString('base64url');
  return payload + '.' + sign(payload);
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

function setSessionCookie(req, res, username) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', 'admin_session=' + encodeURIComponent(createSession(username)) + '; Max-Age=' + Math.floor(SESSION_MAX_AGE_MS / 1000) + '; Path=/; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : ''));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
}

function isAdmin(req) {
  const db = loadDB();
  const session = verifySession(parseCookies(req).admin_session);
  if (session && session.username === db.auth.username) return true;
  const username = req.headers['x-admin-username'] || req.query.username || '';
  const password = req.headers['x-admin-password'] || req.query.password || '';
  return username === db.auth.username && verifyPassword(password, db.auth);
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Unauthorized admin access.' });
    return false;
  }
  return true;
}

function sanitizeFilename(name) {
  return String(name || 'image').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'image';
}

function publicDB(db) {
  return {
    site: db.site,
    payments: db.payments,
    products: db.products,
    trustBanner: db.site.trustBanner,
    storage: { rootDataPath: DATA_DIR, databaseFile: DB_FILE }
  };
}

function paymentName(method) {
  return method === 'nagad' ? 'Nagad Personal' : method === 'bkash' ? 'bKash Personal' : 'Unknown';
}

function calcOrder(items, products) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('কার্টে কোনো প্রোডাক্ট নেই।');
  const normalized = [];
  let total = 0;
  items.forEach(item => {
    const product = products[item.productId];
    if (!product) throw new Error('অবৈধ প্রোডাক্ট নির্বাচন।');
    if (!product.stock) throw new Error(product.name + ' বর্তমানে স্টকে নেই।');
    const qty = parseInt(item.qty, 10);
    if (!qty || qty < product.minQty || qty > product.maxQty) throw new Error(product.name + ' এর জন্য ' + product.minQty + '-' + product.maxQty + ' ' + product.unit + ' অর্ডার করুন।');
    const lineTotal = qty * Number(product.price || 0);
    total += lineTotal;
    normalized.push({ productId: product.id, name: product.name, qty, unit: product.unit, price: Number(product.price || 0), lineTotal });
  });
  return { items: normalized, total };
}

function init() {
  ensureDir(DATA_DIR); ensureDir(UPLOADS_DIR);
  const db = loadDB(); saveDB(db);
}

// Public API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'tazabazar.bd.com API', dataDir: DATA_DIR, databaseFile: DB_FILE, storage: 'project-root-json' });
});

app.get('/api/site', (req, res) => {
  res.json(publicDB(loadDB()));
});

app.post('/api/orders', (req, res) => {
  try {
    const db = loadDB();
    const customerName = String(req.body.customerName || '').trim();
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const email = String(req.body.email || '').trim();
    const address = String(req.body.address || '').trim();
    const paymentMethod = String(req.body.paymentMethod || '').toLowerCase();
    const transactionId = String(req.body.transactionId || '').trim();
    const note = String(req.body.note || '').trim();
    if (!customerName || customerName.length < 2) return res.status(400).json({ error: 'নাম লিখুন।' });
    if (!/^01[3-9]\d{8}$/.test(phone)) return res.status(400).json({ error: 'সঠিক বাংলাদেশি ফোন নম্বর লিখুন।' });
    if (!address || address.length < 6) return res.status(400).json({ error: 'পূর্ণ ঠিকানা লিখুন।' });
    if (!['bkash', 'nagad'].includes(paymentMethod)) return res.status(400).json({ error: 'শুধু bKash অথবা Nagad manual payment গ্রহণযোগ্য। COD বন্ধ।' });
    if (!transactionId || transactionId.length < 6) return res.status(400).json({ error: paymentName(paymentMethod) + ' Transaction ID (Txnid) বাধ্যতামূলক।' });
    const summary = calcOrder(req.body.items, db.products);
    const order = {
      id: Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase(),
      customerName, phone, email, address, note,
      items: summary.items,
      totalPrice: summary.total,
      paymentMethod,
      paymentName: paymentName(paymentMethod),
      paymentNumber: db.payments[paymentMethod],
      transactionId,
      status: 'new',
      createdAt: new Date().toISOString()
    };
    db.orders.unshift(order);
    saveDB(db);
    appendLog('order', 'New order received and Txnid captured', { orderId: order.id, paymentMethod, transactionId, totalPrice: order.totalPrice, items: order.items.map(i => i.productId) });
    res.status(201).json({ success: true, order, message: 'আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Order failed.' });
  }
});

// Admin auth
app.post('/api/admin/login', (req, res) => {
  const db = loadDB();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (username === db.auth.username && verifyPassword(password, db.auth)) {
    setSessionCookie(req, res, db.auth.username);
    appendLog('security', 'Admin login successful', { username });
    return res.json({ success: true, username: db.auth.username, sessionDays: 30 });
  }
  appendLog('security', 'Failed admin login attempt', { username });
  res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড।' });
});

app.post('/api/admin/logout', (req, res) => {
  clearSessionCookie(res);
  appendLog('security', 'Admin logged out');
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = loadDB();
  res.json({ username: db.auth.username, sessionDays: 30, dataDir: DATA_DIR, databaseFile: DB_FILE, storage: 'project-root-json' });
});

// Admin data
app.get('/api/admin/dashboard', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = loadDB();
  res.json({ products: db.products, orders: db.orders, logs: readLogs(100), site: db.site, payments: db.payments, dataDir: DATA_DIR, databaseFile: DB_FILE });
});

app.get('/api/admin/orders', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(loadDB().orders);
});

app.patch('/api/admin/orders/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = loadDB();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const status = String(req.body.status || '');
  if (!['new', 'confirmed', 'delivered', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  order.status = status; order.updatedAt = new Date().toISOString();
  saveDB(db);
  appendLog('order-status', 'Order status updated', { orderId: order.id, status, paymentMethod: order.paymentMethod, transactionId: order.transactionId });
  res.json({ success: true, order });
});

app.put('/api/admin/products/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = req.params.id === 'litchi' ? 'litchi' : 'mango';
  const db = loadDB();
  const product = db.products[id];
  ['name', 'englishName', 'unit', 'badge', 'description', 'emoji'].forEach(key => {
    if (req.body[key] !== undefined) product[key] = String(req.body[key]).trim();
  });
  if (req.body.price !== undefined) product.price = Math.max(0, Number(req.body.price) || 0);
  if (req.body.minQty !== undefined) product.minQty = Math.max(1, parseInt(req.body.minQty, 10) || 1);
  if (req.body.maxQty !== undefined) product.maxQty = Math.max(product.minQty, parseInt(req.body.maxQty, 10) || product.minQty);
  if (req.body.stock !== undefined) product.stock = req.body.stock === true || req.body.stock === 'true';
  saveDB(db);
  appendLog('product', id + ' product updated', { productId: id, price: product.price, stock: product.stock });
  res.json({ success: true, product, products: db.products });
});

app.post('/api/admin/products/:id/images', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = req.params.id === 'litchi' ? 'litchi' : 'mango';
  const db = loadDB();
  const product = db.products[id];
  const match = String(req.body.dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i);
  if (!match) return res.status(400).json({ error: 'Only PNG, JPG, WEBP or GIF images are allowed.' });
  const mime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Image size must be under 8MB.' });
  const imageId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
  const fileName = imageId + '-' + id + '-' + sanitizeFilename(req.body.name).replace(/\.[a-z0-9]+$/i, '') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
  const image = { id: imageId, name: req.body.name || fileName, url: '/uploads/' + fileName, showInSlider: req.body.showInSlider !== false, createdAt: new Date().toISOString() };
  product.images.unshift(image);
  saveDB(db);
  appendLog('image', id + ' image uploaded', { productId: id, imageId, showInSlider: image.showInSlider });
  res.status(201).json({ success: true, image, product });
});

app.patch('/api/admin/products/:productId/images/:imageId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const productId = req.params.productId === 'litchi' ? 'litchi' : 'mango';
  const db = loadDB();
  const image = (db.products[productId].images || []).find(img => img.id === req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found.' });
  if (req.body.showInSlider !== undefined) image.showInSlider = req.body.showInSlider === true || req.body.showInSlider === 'true';
  if (req.body.name !== undefined) image.name = String(req.body.name).trim() || image.name;
  saveDB(db);
  appendLog('image', productId + ' image slider setting updated', { productId, imageId: image.id, showInSlider: image.showInSlider });
  res.json({ success: true, image });
});

app.delete('/api/admin/products/:productId/images/:imageId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const productId = req.params.productId === 'litchi' ? 'litchi' : 'mango';
  const db = loadDB();
  const images = db.products[productId].images || [];
  const index = images.findIndex(img => img.id === req.params.imageId);
  if (index === -1) return res.status(404).json({ error: 'Image not found.' });
  const image = images[index];
  if (image.url && image.url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(image.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  images.splice(index, 1);
  saveDB(db);
  appendLog('image', productId + ' image deleted', { productId, imageId: image.id });
  res.json({ success: true });
});

app.get('/api/admin/logs', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(readLogs(parseInt(req.query.limit, 10) || 150));
});

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'order.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

init();
app.listen(PORT, () => {
  console.log('\n✅ tazabazar.bd.com running on http://localhost:' + PORT);
  console.log('💾 Root JSON DB:', DB_FILE);
  console.log('🔐 Admin:', ADMIN_USERNAME, '(password hashed with scrypt)\n');
});
