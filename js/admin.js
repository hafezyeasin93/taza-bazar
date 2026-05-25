var STATE = {
  username: null,
  orders: [],
  products: {},
  productType: 'mango',
  images: [],
  logs: [],
  profile: null
};

var loginView = document.getElementById('loginView');
var dashboardView = document.getElementById('dashboardView');
var toast = document.getElementById('toast');

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
  });
}

function money(value) {
  return Number(value || 0).toLocaleString('bn-BD');
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

async function api(url, options) {
  options = options || {};
  options.credentials = 'include';
  options.headers = options.headers || jsonHeaders();
  var res = await fetch(url, options);
  if (res.status === 401 && !url.includes('/api/admin/login')) {
    logout(false);
    throw new Error('unauthorized');
  }
  return res;
}

async function checkExistingSession() {
  try {
    var res = await api('/api/admin/me', { headers: jsonHeaders() });
    if (res.ok) {
      STATE.profile = await res.json();
      STATE.username = STATE.profile.username;
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      await loadDashboard();
      return;
    }
  } catch (err) {}
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

var passInput = document.getElementById('passwordInput');
var userInput = document.getElementById('usernameInput');
if (passInput) passInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') login(); });
if (userInput) userInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') login(); });

var imageInput = document.getElementById('imageFileInput');
if (imageInput) imageInput.addEventListener('change', handleImageFiles);

async function login() {
  var username = document.getElementById('usernameInput').value.trim();
  var password = document.getElementById('passwordInput').value;
  if (!username || !password) {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginError').textContent = '❌ ইউজারনেম ও পাসওয়ার্ড লিখুন';
    return;
  }
  var loginBtn = document.getElementById('loginBtn');
  var loginText = document.getElementById('loginText');
  var loginSpinner = document.getElementById('loginSpinner');
  loginBtn.disabled = true;
  loginText.classList.add('hidden');
  loginSpinner.classList.remove('hidden');
  document.getElementById('loginError').style.display = 'none';
  try {
    var res = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: username, password: password })
    });
    var data = await res.json();
    if (res.ok && data.success) {
      STATE.username = data.username;
      document.getElementById('passwordInput').value = '';
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      await loadDashboard();
      showToast('স্বাগতম! নিরাপদ সেশন চালু হয়েছে।', 'success');
    } else {
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginError').textContent = data.error || '❌ ভুল ইউজারনেম বা পাসওয়ার্ড';
    }
  } catch(err) {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginError').textContent = '❌ সার্ভার সংযোগ ব্যর্থ হয়েছে';
  } finally {
    loginBtn.disabled = false;
    loginText.classList.remove('hidden');
    loginSpinner.classList.add('hidden');
  }
}

async function logout(callServer) {
  if (callServer !== false) {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch(err) {}
  }
  STATE.username = null;
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

async function loadDashboard() {
  await Promise.all([loadProfile(), loadOrders(), loadProductSettings(), loadImages(), loadLogs()]);
}

async function loadProfile() {
  try {
    var res = await api('/api/admin/me');
    if (res.ok) {
      STATE.profile = await res.json();
      STATE.username = STATE.profile.username;
      var storageEl = document.getElementById('storageStatus');
      if (storageEl) {
        storageEl.textContent = 'Storage: ' + (STATE.profile.storage.persistent ? 'Persistent disk' : 'Local workspace') + ' • ' + STATE.profile.storage.dataDir + ' • Session ' + STATE.profile.sessionDays + ' days';
      }
      var usernameInput = document.getElementById('newUsername');
      if (usernameInput) usernameInput.value = STATE.username || 'admin';
    }
  } catch(err) {}
}

async function loadOrders() {
  try {
    var res = await api('/api/admin/orders');
    if (res.ok) {
      STATE.orders = await res.json();
      renderOrders();
      updateStats();
      renderAnalytics();
      document.getElementById('lastRefresh').textContent = 'শেষ আপডেট: ' + new Date().toLocaleTimeString('bn-BD');
    }
  } catch(err) { console.error('Load orders error:', err); }
}

async function loadProductSettings() {
  try {
    var res = await api('/api/admin/products');
    if (res.ok) {
      STATE.products = await res.json();
      fillProductForm();
    }
  } catch(err) { console.error('Load settings error:', err); }
}

function currentProduct() {
  return STATE.products[STATE.productType] || STATE.products.mango || {};
}

function fillProductForm() {
  var product = currentProduct();
  if (!document.getElementById('setName')) return;
  document.getElementById('setProductType').value = STATE.productType;
  document.getElementById('setName').value = product.name || '';
  document.getElementById('setPrice').value = product.pricePerKg || 0;
  document.getElementById('setMinOrder').value = product.minOrderKg || 1;
  document.getElementById('setMaxOrder').value = product.maxOrderKg || 50;
  document.getElementById('setDesc').value = product.description || '';
  document.getElementById('setStock').checked = !!product.stockAvailable;
  document.getElementById('mangoManagementBtn').classList.toggle('active', STATE.productType === 'mango');
  document.getElementById('litchiManagementBtn').classList.toggle('active', STATE.productType === 'litchi');
}

function switchProductManagement(type) {
  STATE.productType = type === 'litchi' ? 'litchi' : 'mango';
  fillProductForm();
}

function updateStats() {
  var orders = STATE.orders;
  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statNew').textContent = orders.filter(function(o) { return o.status === 'new'; }).length;
  document.getElementById('statConfirmed').textContent = orders.filter(function(o) { return o.status === 'confirmed' || o.status === 'delivered'; }).length;
  var revenue = orders.filter(function(o) { return o.status !== 'cancelled'; }).reduce(function(sum, o) { return sum + (o.totalPrice || 0); }, 0);
  document.getElementById('statRevenue').textContent = money(revenue);
  document.getElementById('heroRevenue').textContent = '৳' + money(revenue);
  var bkash = orders.filter(function(o) { return o.paymentMethod === 'bkash'; }).length;
  var nagad = orders.filter(function(o) { return o.paymentMethod === 'nagad'; }).length;
  document.getElementById('heroPaymentMix').textContent = 'bKash ' + bkash + ' • Nagad ' + nagad;
}

function renderAnalytics() {
  var analyticsBars = document.getElementById('analyticsBars');
  var paymentRings = document.getElementById('paymentRings');
  if (!analyticsBars || !paymentRings) return;
  var total = STATE.orders.length || 1;
  var newCount = STATE.orders.filter(function(o) { return o.status === 'new'; }).length;
  var confirmed = STATE.orders.filter(function(o) { return o.status === 'confirmed'; }).length;
  var delivered = STATE.orders.filter(function(o) { return o.status === 'delivered'; }).length;
  var cancelled = STATE.orders.filter(function(o) { return o.status === 'cancelled'; }).length;
  var bars = [
    ['New', newCount, '#3b82f6'], ['Confirmed', confirmed, '#f59e0b'], ['Delivered', delivered, '#16a34a'], ['Cancelled', cancelled, '#ef4444']
  ];
  analyticsBars.innerHTML = bars.map(function(row) {
    var percent = Math.max(4, Math.round((row[1] / total) * 100));
    return '<div class="analytics-row"><span>' + row[0] + '</span><div><i style="width:' + percent + '%;background:' + row[2] + '"></i></div><strong>' + row[1] + '</strong></div>';
  }).join('');
  var bkash = STATE.orders.filter(function(o) { return o.paymentMethod === 'bkash'; }).length;
  var nagad = STATE.orders.filter(function(o) { return o.paymentMethod === 'nagad'; }).length;
  paymentRings.innerHTML = '<div class="payment-chip bkash">bKash <strong>' + bkash + '</strong></div><div class="payment-chip nagad">Nagad <strong>' + nagad + '</strong></div><div class="payment-chip txn">Txnid Checked <strong>' + STATE.orders.filter(function(o) { return !!o.transactionId; }).length + '</strong></div>';
}

function paymentLabel(order) {
  var methodName = order.paymentMethod === 'nagad' ? 'Nagad Manual' : 'bKash Manual';
  var fallbackNumber = order.paymentMethod === 'nagad' ? '01629518850' : '01891548610';
  var number = order.paymentNumber || order.bKashNumber || order.nagadNumber || fallbackNumber;
  return methodName + '<br><small>Number: ' + escapeHTML(number) + '<br>Txnid: ' + escapeHTML(order.transactionId || '-') + '</small>';
}

function renderOrders() {
  var list = document.getElementById('orderList');
  if (STATE.orders.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>কোনো অর্ডার নেই</h3><p style="font-size:13px;">নতুন অর্ডার এলে এখানে দেখাবে</p></div>';
    return;
  }
  var statusMap = { 'new': 'নতুন', 'confirmed': 'কনফার্ম', 'delivered': 'ডেলিভার', 'cancelled': 'বাতিল' };
  list.innerHTML = STATE.orders.map(function(order) {
    var statusClass = 'status-' + order.status;
    var date = new Date(order.createdAt).toLocaleString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    var actionsHTML = '';
    if (order.status === 'new') {
      actionsHTML = '<button class="btn btn-sm btn-green" onclick="updateOrderStatus(\'' + order.id + '\',\'confirmed\')">✅ কনফার্ম</button> <button class="btn btn-sm btn-danger" onclick="updateOrderStatus(\'' + order.id + '\',\'cancelled\')">❌ বাতিল</button>';
    } else if (order.status === 'confirmed') {
      actionsHTML = '<button class="btn btn-sm btn-green" onclick="updateOrderStatus(\'' + order.id + '\',\'delivered\')">📦 ডেলিভারি</button> <button class="btn btn-sm btn-danger" onclick="updateOrderStatus(\'' + order.id + '\',\'cancelled\')">❌ বাতিল</button>';
    } else if (order.status === 'cancelled') {
      actionsHTML = '<button class="btn btn-sm btn-outline" onclick="updateOrderStatus(\'' + order.id + '\',\'new\')">🔄 পুনরায় নতুন</button>';
    } else if (order.status === 'delivered') {
      actionsHTML = '<span style="font-size:12px; color: var(--green-mid);">✅ সম্পন্ন</span>';
    }
    return '<div class="order-item premium-order-item"><div class="order-item-header"><div><span class="order-id">#' + escapeHTML(order.id) + '</span><span class="order-time">' + date + '</span></div><span class="status-badge ' + statusClass + '">' + (statusMap[order.status] || order.status) + '</span></div><div class="order-details"><div class="order-detail"><strong>ক্রেতা</strong>' + escapeHTML(order.customerName) + '</div><div class="order-detail"><strong>ফোন</strong><a href="tel:' + escapeHTML(order.phone) + '">' + escapeHTML(order.phone) + '</a></div><div class="order-detail"><strong>পরিমাণ</strong>' + escapeHTML(order.quantity) + ' কেজি</div><div class="order-detail"><strong>মোট মূল্য</strong>' + escapeHTML(order.totalPrice) + ' টাকা</div><div class="order-detail"><strong>ঠিকানা</strong>' + escapeHTML(order.address) + '</div><div class="order-detail"><strong>পেমেন্ট</strong>' + paymentLabel(order) + '</div>' + (order.email ? '<div class="order-detail"><strong>ইমেইল</strong>' + escapeHTML(order.email) + '</div>' : '') + (order.note ? '<div class="order-detail"><strong>নোট</strong>' + escapeHTML(order.note) + '</div>' : '') + '</div><div class="order-actions">' + actionsHTML + '</div></div>';
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  if (!confirm('অর্ডার স্ট্যাটাস পরিবর্তন করতে চান?')) return;
  try {
    var res = await api('/api/admin/orders/' + orderId, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (res.ok) {
      showToast('অর্ডার স্ট্যাটাস আপডেট হয়েছে!', 'success');
      await Promise.all([loadOrders(), loadLogs()]);
    } else { var data = await res.json(); showToast(data.error || 'আপডেট ব্যর্থ', 'error'); }
  } catch(err) { if (err.message !== 'unauthorized') showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

async function saveProductSettings() {
  try {
    var data = {
      productType: STATE.productType,
      name: document.getElementById('setName').value,
      pricePerKg: parseFloat(document.getElementById('setPrice').value),
      minOrderKg: parseInt(document.getElementById('setMinOrder').value),
      maxOrderKg: parseInt(document.getElementById('setMaxOrder').value),
      description: document.getElementById('setDesc').value,
      stockAvailable: document.getElementById('setStock').checked
    };
    var res = await api('/api/admin/product', { method: 'PUT', body: JSON.stringify(data) });
    if (res.ok) {
      var result = await res.json();
      STATE.products = result.products;
      showToast('প্রোডাক্ট সেটিংস স্থায়ীভাবে সেভ হয়েছে!', 'success');
      fillProductForm();
      loadLogs();
    } else { var errData = await res.json(); showToast(errData.error || 'সেভ ব্যর্থ', 'error'); }
  } catch(err) { if (err.message !== 'unauthorized') showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

async function changeAccount() {
  var newUsername = document.getElementById('newUsername').value.trim();
  var newPassword = document.getElementById('newPassword').value.trim();
  if (!newUsername || newUsername.length < 3) return showToast('ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে', 'error');
  if (!newPassword || newPassword.length < 10) return showToast('পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে', 'error');
  try {
    var res = await api('/api/admin/account', { method: 'PUT', body: JSON.stringify({ newUsername: newUsername, newPassword: newPassword }) });
    if (res.ok) {
      STATE.username = newUsername;
      document.getElementById('newPassword').value = '';
      showToast('এনক্রিপ্টেড অ্যাডমিন অ্যাকাউন্ট আপডেট হয়েছে!', 'success');
      loadProfile(); loadLogs();
    } else { var errData = await res.json(); showToast(errData.error || 'পরিবর্তন ব্যর্থ', 'error'); }
  } catch(err) { if (err.message !== 'unauthorized') showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

function fileToDataURL(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleImageFiles(e) {
  var files = Array.prototype.slice.call(e.target.files || []);
  if (files.length === 0) return;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) { showToast(file.name + ' সাপোর্টেড ছবি নয়', 'error'); continue; }
    if (file.size > 8 * 1024 * 1024) { showToast(file.name + ' ৮MB এর বেশি', 'error'); continue; }
    try {
      var dataUrl = await fileToDataURL(file);
      var res = await api('/api/admin/images', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl: dataUrl, showInSlider: true }) });
      if (!res.ok) { var data = await res.json(); showToast(data.error || 'ছবি আপলোড ব্যর্থ', 'error'); }
    } catch(err) { if (err.message !== 'unauthorized') showToast('ছবি আপলোড ব্যর্থ', 'error'); }
  }
  e.target.value = '';
  await Promise.all([loadImages(), loadLogs()]);
  showToast('ছবি persistent storage-এ আপলোড হয়েছে', 'success');
}

async function loadImages() {
  try {
    var res = await api('/api/admin/images');
    if (res.ok) { STATE.images = await res.json(); renderImages(); }
  } catch(err) { console.error('Load images error:', err); }
}

function renderImages() {
  var grid = document.getElementById('imageGridAdmin');
  if (!grid) return;
  if (!STATE.images || STATE.images.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🖼️</div><h3>কোনো ছবি নেই</h3><p style="font-size:13px;">ছবি আপলোড করলে এখানে দেখাবে</p></div>';
    return;
  }
  grid.innerHTML = STATE.images.map(function(img) {
    return '<div class="admin-image-card">' +
      '<img src="' + escapeHTML(img.url) + '" alt="' + escapeHTML(img.name) + '">' +
      '<div class="admin-image-info"><strong>' + escapeHTML(img.name) + '</strong><small>' + new Date(img.createdAt).toLocaleDateString('bn-BD') + '</small></div>' +
      '<label class="admin-slider-toggle"><input type="checkbox" ' + (img.showInSlider ? 'checked' : '') + ' onchange="toggleSliderImage(\'' + img.id + '\', this.checked)"> <span>Top slider-এ দেখান</span></label>' +
      '<button class="btn btn-sm btn-danger" onclick="deleteImage(\'' + img.id + '\')">ডিলিট</button>' +
    '</div>';
  }).join('');
}

async function toggleSliderImage(id, checked) {
  try {
    var res = await api('/api/admin/images/' + id, { method: 'PATCH', body: JSON.stringify({ showInSlider: checked }) });
    if (res.ok) { showToast('স্লাইডার সেটিং আপডেট হয়েছে', 'success'); loadImages(); loadLogs(); }
  } catch(err) { if (err.message !== 'unauthorized') showToast('আপডেট ব্যর্থ', 'error'); }
}

async function deleteImage(id) {
  if (!confirm('এই ছবি ডিলিট করতে চান?')) return;
  try {
    var res = await api('/api/admin/images/' + id, { method: 'DELETE' });
    if (res.ok) { showToast('ছবি ডিলিট হয়েছে', 'success'); loadImages(); loadLogs(); }
    else { var data = await res.json(); showToast(data.error || 'ডিলিট ব্যর্থ', 'error'); }
  } catch(err) { if (err.message !== 'unauthorized') showToast('ডিলিট ব্যর্থ', 'error'); }
}

async function loadLogs() {
  try {
    var res = await api('/api/admin/logs?limit=120');
    if (res.ok) { STATE.logs = await res.json(); renderLogs(); }
  } catch(err) { console.error('Load logs error:', err); }
}

function renderLogs() {
  var viewer = document.getElementById('logViewer');
  if (!viewer) return;
  if (!STATE.logs || STATE.logs.length === 0) {
    viewer.innerHTML = '<div class="empty-state"><div class="icon">🧾</div><h3>No activity logs yet</h3></div>';
    return;
  }
  viewer.innerHTML = STATE.logs.map(function(log) {
    var meta = log.meta || {};
    var txn = meta.transactionId ? '<span>Txnid: ' + escapeHTML(meta.transactionId) + '</span>' : '';
    var amount = meta.totalPrice ? '<span>৳' + money(meta.totalPrice) + '</span>' : '';
    return '<div class="log-row log-' + escapeHTML(log.type) + '"><div><strong>' + escapeHTML(log.message) + '</strong><small>' + new Date(log.createdAt).toLocaleString('bn-BD') + '</small></div><div class="log-meta"><span>' + escapeHTML(log.type) + '</span>' + txn + amount + '</div></div>';
  }).join('');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(tab) { tab.classList.remove('active'); });
  var tabOrder = ['orders', 'products', 'images', 'logs', 'settings'];
  var index = tabOrder.indexOf(tabName);
  if (index < 0) index = 0;
  document.querySelector('.tab-btn:nth-child(' + (index + 1) + ')').classList.add('active');
  document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
  if (tabName === 'orders') loadOrders();
  if (tabName === 'products') loadProductSettings();
  if (tabName === 'images') loadImages();
  if (tabName === 'logs') loadLogs();
}

setInterval(function() {
  if (!dashboardView.classList.contains('hidden')) Promise.all([loadOrders(), loadLogs()]);
}, 30000);

checkExistingSession();
