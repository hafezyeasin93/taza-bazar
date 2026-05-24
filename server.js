require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

function initDataFiles() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
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
      adminPassword: 'taza2024'
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
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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
      from: '"তাজা বাজার" <' + process.env.EMAIL_USER + '>',
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

  const smsMessage = 'তাজা বাজার - নতুন অর্ডার!\n' +
    order.customerName + ' (' + order.phone + ')\n' +
    order.quantity + 'kg রুপালি আম\n' +
    'মোট: ' + order.totalPrice + ' টাকা\n' +
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
          <tr style="background:#fff7ed;"><td style="padding:8px 0;font-weight:bold;color:#555;">💳 পেমেন্ট</td><td>${order.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : order.paymentMethod}</td></tr>
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
  res.json({ status: 'ok', name: 'তাজা বাজার API', version: '1.0.0' });
});

app.get('/api/product', (req, res) => {
  const settings = getSettings();
  res.json(settings.product);
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, phone, email, address, quantity, paymentMethod, note } = req.body;
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
      paymentMethod: paymentMethod || 'cod',
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
  const password = req.headers['x-admin-password'] || req.query.password;
  const settings = getSettings();
  if (password !== settings.adminPassword) {
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
  }
  res.json(getOrders());
});

app.patch('/api/admin/orders/:id', (req, res) => {
  const password = req.headers['x-admin-password'] || req.query.password;
  const settings = getSettings();
  if (password !== settings.adminPassword) {
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
  }
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
  const password = req.headers['x-admin-password'] || req.query.password;
  const settings = getSettings();
  if (password !== settings.adminPassword) {
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
  }
  const { pricePerKg, stockAvailable, minOrderKg, maxOrderKg, description } = req.body;
  if (pricePerKg !== undefined) settings.product.pricePerKg = parseFloat(pricePerKg);
  if (stockAvailable !== undefined) settings.product.stockAvailable = stockAvailable === true || stockAvailable === 'true';
  if (minOrderKg !== undefined) settings.product.minOrderKg = parseInt(minOrderKg);
  if (maxOrderKg !== undefined) settings.product.maxOrderKg = parseInt(maxOrderKg);
  if (description !== undefined) settings.product.description = description;
  saveSettings(settings);
  res.json({ success: true, product: settings.product });
});

app.put('/api/admin/password', (req, res) => {
  const password = req.headers['x-admin-password'] || req.query.password;
  const settings = getSettings();
  if (password !== settings.adminPassword) {
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' });
  }
  settings.adminPassword = newPassword;
  saveSettings(settings);
  res.json({ success: true, message: 'পাসওয়ার্ড আপডেট হয়েছে।' });
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
  console.log('\n🥭 তাজা বাজার সার্ভার চালু হয়েছে: http://localhost:' + PORT);
  console.log('📱 মালিক ফোন: ' + (process.env.OWNER_PHONE || '01629518850'));
  console.log('📧 মালিক ইমেইল: ' + (process.env.OWNER_EMAIL || 'hafezyeasin93@gmail.com'));
  console.log('🔑 অ্যাডমিন প্যানেল: http://localhost:' + PORT + '/admin\n');
});
