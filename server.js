require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
const ADMIN_DEFAULT_USERNAME = 'admin';
const ADMIN_DEFAULT_PASSWORD = 'TazaBazar@2026!';
const BKASH_NUMBER = '01891548610';
const NAGAD_NUMBER = '01629518850';

app.use(cors());
app.use(bodyParser.json({ limit: '12mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '12mb' }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(UPLOADS_DIR));

function initDataFiles() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      product: {
        name: 'রুপালি আম',
        pricePerKg: 120,
        stockAvailable: true,
        minOrderKg: 1,
        maxOrderKg: 50,
        description: 'এই মৌসুমের সেরা রুপালি আম। টাটকা, সুস্বাদু ও রসালো। সরাসরি বাগান থেকে সংগ্রহ করা।'
      },
      adminUsername: ADMIN_DEFAULT_USERNAME,
      adminPassword: ADMIN_DEFAULT_PASSWORD,
      websiteImages: []
    }, null, 2));
  }
}

function getOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function getSettings() {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  let changed = false;
  if (!settings.adminUsername) { settings.adminUsername = ADMIN_DEFAULT_USERNAME; changed = true; }
  if (!settings.adminPassword || settings.adminPassword === 'taza2024') { settings.adminPassword = ADMIN_DEFAULT_PASSWORD; changed = true; }
  if (!Array.isArray(settings.websiteImages)) { settings.websiteImages = []; changed = true; }
  if (changed) saveSettings(settings);
  return settings;
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function authAdmin(req) {
  const settings = getSettings();
  const username = req.headers['x-admin-username'] || req.query.username || '';
  const password = req.headers['x-admin-password'] || req.query.password || '';
  return username === settings.adminUsername && password === settings.adminPassword;
}

function requireAdmin(req, res) {
  if (!authAdmin(req)) {
    res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
    return false;
  }
  return true;
}

function sanitizeFilename(name) {
  return String(name || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

function publicSiteData() {
  const settings = getSettings();
  const sliderImages = (settings.websiteImages || []).filter(function(img) { return img.showInSlider; });
  return {
    product: settings.product,
    sliderImages: sliderImages,
    bKashNumber: BKASH_NUMBER,
    nagadNumber: NAGAD_NUMBER,
    siteName: 'tazabazar.bd.com'
  };
}

function paymentProviderName(method) {
  if (method === 'bkash') return 'bKash Manual';
  if (method === 'nagad') return 'Nagad Manual';
  return 'Manual Payment';
}

function paymentProviderNumber(method) {
  if (method === 'bkash') return BKASH_NUMBER;
  if (method === 'nagad') return NAGAD_NUMBER;
  return '';
}

let emailTransporter = null;
function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return emailTransporter;
}

async function sendSMS(to, message) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('[SMS] Twilio not configured. Skipping SMS.');
    console.log('[SMS] Would send to:', to);
    console.log('[SMS] Message:', message);
    return { success: false, reason: 'Twilio not configured' };
  }
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    console.log('[SMS] Sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('[SMS] Failed:', error.message);
    return { success: false, reason: error.message };
  }
}

async function sendEmail(to, subject, html) {
  const transporter = getEmailTransporter();
  if (!transporter) {
    console.log('[Email] Not configured. Skipping.');
    return { success: false, reason: 'Email not configured' };
  }
  try {
    const info = await transporter.sendMail({
      from: '"tazabazar.bd.com" <' + process.env.EMAIL_USER + '>',
      to: to,
      subject: subject,
      html: html
    });
    console.log('[Email] Sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed:', error.message);
    return { success: false, reason: error.message };
  }
}

async function notifyOwner(order) {
  const ownerPhone = process.env.OWNER_PHONE || '01629518850';
  const ownerEmail = process.env.OWNER_EMAIL || 'hafezyeasin93@gmail.com';

  const smsMessage = 'tazabazar.bd.com - নতুন অর্ডার!\n' +
    order.customerName + ' (' + order.phone + ')\n' +
    order.quantity + 'kg রুপালি আম\n' +
    'মোট: ' + order.totalPrice + ' টাকা\n' +
    'পেমেন্ট: ' + paymentProviderName(order.paymentMethod) + ' (' + order.transactionId + ')' + '\n' +
    'ঠিকানা: ' + order.address;

  const emailHTML = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">🛒 নতুন অর্ডার!</h1>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:bold;color:#555;">👤 ক্রেতা</td><td>${order.customerName}</td></tr>
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">📱 ফোন</td><td>${order.phone}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#555;">📧 ইমেইল</td><td>${order.email || 'N/A'}</td></tr>
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">🥭 পরিমাণ</td><td style="font-size:18px;font-weight:bold;color:#ea580c;">${order.quantity} কেজি</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#555;">💰 মূল্য/কেজি</td><td>${order.pricePerKg} টাকা</td></tr>
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">💵 মোট</td><td style="font-size:20px;font-weight:bold;color:#16a34a;">${order.totalPrice} টাকা</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#555;">📍 ঠিকানা</td><td>${order.address}</td></tr>
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">💳 পেমেন্ট</td><td>${paymentProviderName(order.paymentMethod)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#555;">📲 Payment Number</td><td>${order.paymentNumber || paymentProviderNumber(order.paymentMethod)}</td></tr>
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">Txnid</td><td>${order.transactionId}</td></tr>
          ${order.note ? '<tr><td style="padding:8px 0;font-weight:bold;color:#555;">📝 নোট</td><td>' + order.note + '</td></tr>' : ''}
        </table>
        <div style="margin-top:20px;padding:12px;background:#fef2f2;border-radius:8px;text-align:center;font-size:13px;color:#991b1b;">
          অর্ডার আইডি: #${order.id} | ${new Date(order.createdAt).toLocaleString('bn-BD')}
        </div>
      </div>
    </div>
  `;

  const smsResult = await sendSMS(ownerPhone, smsMessage);
  const emailResult = await sendEmail(ownerEmail, 'নতুন অর্ডার #' + order.id + ' - ' + order.customerName, emailHTML);
  return { sms: smsResult, email: emailResult };
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'tazabazar.bd.com API', version: '1.0.0' });
});

app.get('/api/product', (req, res) => {
  const settings = getSettings();
  res.json(settings.product);
});

app.get('/api/site', (req, res) => {
  res.json(publicSiteData());
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, phone, email, address, quantity, paymentMethod, transactionId, note } = req.body;
    if (!customerName || !phone || !address || !quantity) {
      return res.status(400).json({ error: 'অনুগ্রহ করে সব আবশ্যক তথ্য পূরণ করুন।' });
    }
    const settings = getSettings();
    const product = settings.product;
    if (!product.stockAvailable) {
      return res.status(400).json({ error: 'দুঃখিত, বর্তমানে আমের স্টক শেষ।' });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < (product.minOrderKg || 1) || qty > (product.maxOrderKg || 50)) {
      return res.status(400).json({ error: 'অনুগ্রহ করে ' + (product.minOrderKg || 1) + '-' + (product.maxOrderKg || 50) + ' কেজির মধ্যে অর্ডার করুন।' });
    }
    const selectedPayment = String(paymentMethod || '').trim().toLowerCase();
    const allowedPaymentMethods = ['bkash', 'nagad'];
    if (!allowedPaymentMethods.includes(selectedPayment)) {
      return res.status(400).json({ error: 'পেমেন্ট পদ্ধতি হিসেবে bKash বা Nagad নির্বাচন করুন।' });
    }
    const cleanTransactionId = String(transactionId || '').trim();
    if (cleanTransactionId.length < 6) {
      return res.status(400).json({ error: paymentProviderName(selectedPayment) + ' Transaction ID (Txnid) দিতে হবে।' });
    }
    const orders = getOrders();
    const orderId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const totalPrice = qty * product.pricePerKg;
    const newOrder = {
      id: orderId,
      customerName, phone,
      email: email || '',
      address,
      quantity: qty,
      pricePerKg: product.pricePerKg,
      totalPrice,
      paymentMethod: selectedPayment,
      transactionId: cleanTransactionId,
      paymentNumber: paymentProviderNumber(selectedPayment),
      bKashNumber: selectedPayment === 'bkash' ? BKASH_NUMBER : '',
      nagadNumber: selectedPayment === 'nagad' ? NAGAD_NUMBER : '',
      note: note || '',
      status: 'new',
      createdAt: new Date().toISOString()
    };
    orders.unshift(newOrder);
    saveOrders(orders);
    notifyOwner(newOrder).catch(err => console.error('Notification error:', err));
    console.log('[Order] New order #' + orderId + ' by ' + customerName);
    res.status(201).json({
      success: true,
      order: newOrder,
      message: 'আপনার অর্ডার সফলভাবে গৃহীত হয়েছে! শীঘ্রই আমাদের পক্ষ থেকে যোগাযোগ করা হবে।'
    });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: 'সার্ভার সমস্যা। অনুগ্রহ করে পরে চেষ্টা করুন।' });
  }
});

app.get('/api/admin/orders', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(getOrders());
});

app.patch('/api/admin/orders/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['new', 'confirmed', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'অবৈধ স্ট্যাটাস।' });
  }
  const orders = getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'অর্ডার পাওয়া যায়নি।' });
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveOrders(orders);
  res.json({ success: true, order });
});

app.put('/api/admin/product', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const { pricePerKg, stockAvailable, minOrderKg, maxOrderKg, description } = req.body;
  if (pricePerKg !== undefined) settings.product.pricePerKg = parseFloat(pricePerKg);
  if (stockAvailable !== undefined) settings.product.stockAvailable = stockAvailable === true || stockAvailable === 'true';
  if (minOrderKg !== undefined) settings.product.minOrderKg = parseInt(minOrderKg);
  if (maxOrderKg !== undefined) settings.product.maxOrderKg = parseInt(maxOrderKg);
  if (description !== undefined) settings.product.description = description;
  saveSettings(settings);
  res.json({ success: true, product: settings.product });
});

app.put('/api/admin/account', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const { newUsername, newPassword } = req.body;
  if (!newUsername || String(newUsername).trim().length < 3) {
    return res.status(400).json({ error: 'ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।' });
  }
  if (!newPassword || String(newPassword).length < 10) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' });
  }
  settings.adminUsername = String(newUsername).trim();
  settings.adminPassword = String(newPassword);
  saveSettings(settings);
  res.json({ success: true, username: settings.adminUsername, message: 'অ্যাডমিন অ্যাকাউন্ট আপডেট হয়েছে।' });
});

app.put('/api/admin/password', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 10) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' });
  }
  settings.adminPassword = newPassword;
  saveSettings(settings);
  res.json({ success: true, message: 'পাসওয়ার্ড আপডেট হয়েছে।' });
});

app.get('/api/admin/images', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  res.json(settings.websiteImages || []);
});

app.post('/api/admin/images', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, dataUrl, showInSlider } = req.body;
  const match = String(dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: 'শুধু PNG, JPG, WEBP বা GIF ছবি আপলোড করা যাবে।' });
  }
  const mimeType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[mimeType];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'ছবির সাইজ সর্বোচ্চ ৮MB হতে পারবে।' });
  }
  const id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 7).toUpperCase();
  const fileName = id + '-' + sanitizeFilename(name).replace(/\.[a-z0-9]+$/i, '') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
  const settings = getSettings();
  const image = {
    id: id,
    name: name || fileName,
    url: '/uploads/' + fileName,
    showInSlider: showInSlider !== false,
    createdAt: new Date().toISOString()
  };
  settings.websiteImages.unshift(image);
  saveSettings(settings);
  res.status(201).json({ success: true, image: image });
});

app.patch('/api/admin/images/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const image = (settings.websiteImages || []).find(function(img) { return img.id === req.params.id; });
  if (!image) return res.status(404).json({ error: 'ছবি পাওয়া যায়নি।' });
  if (req.body.name !== undefined) image.name = String(req.body.name).trim() || image.name;
  if (req.body.showInSlider !== undefined) image.showInSlider = req.body.showInSlider === true || req.body.showInSlider === 'true';
  image.updatedAt = new Date().toISOString();
  saveSettings(settings);
  res.json({ success: true, image: image });
});

app.delete('/api/admin/images/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const settings = getSettings();
  const images = settings.websiteImages || [];
  const index = images.findIndex(function(img) { return img.id === req.params.id; });
  if (index === -1) return res.status(404).json({ error: 'ছবি পাওয়া যায়নি।' });
  const image = images[index];
  if (image.url && image.url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(image.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  images.splice(index, 1);
  settings.websiteImages = images;
  saveSettings(settings);
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'order.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

initDataFiles();

app.listen(PORT, () => {
  console.log('\n🥭 tazabazar.bd.com সার্ভার চালু হয়েছে: http://localhost:' + PORT);
  console.log('📱 মালিক ফোন: ' + (process.env.OWNER_PHONE || '01629518850'));
  console.log('📧 মালিক ইমেইল: ' + (process.env.OWNER_EMAIL || 'hafezyeasin93@gmail.com'));
  console.log('🔑 অ্যাডমিন প্যানেল: http://localhost:' + PORT + '/admin\n');
});
