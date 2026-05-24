var STATE = {
  username: null,
  password: null,
  orders: [],
  product: null,
  images: []
};

var loginView = document.getElementById('loginView');
var dashboardView = document.getElementById('dashboardView');
var toast = document.getElementById('toast');

var savedUsername = sessionStorage.getItem('taza_admin_username');
var savedPassword = sessionStorage.getItem('taza_admin_password');
if (savedUsername && savedPassword) {
  STATE.username = savedUsername;
  STATE.password = savedPassword;
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  loadDashboard();
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Username': STATE.username || '',
    'X-Admin-Password': STATE.password || ''
  };
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
  });
}

document.getElementById('passwordInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') login();
});
document.getElementById('usernameInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') login();
});

var imageInput = document.getElementById('imageFileInput');
if (imageInput) {
  imageInput.addEventListener('change', handleImageFiles);
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function() {
    toast.classList.remove('show');
  }, 3500);
}

async function login() {
  var username = document.getElementById('usernameInput').value.trim();
  var password = document.getElementById('passwordInput').value.trim();
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
    STATE.username = username;
    STATE.password = password;
    var res = await fetch('/api/admin/orders', { headers: authHeaders() });
    if (res.ok) {
      sessionStorage.setItem('taza_admin_username', username);
      sessionStorage.setItem('taza_admin_password', password);
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      loadDashboard();
      showToast('স্বাগতম! লগইন সফল হয়েছে।', 'success');
    } else {
      STATE.username = null;
      STATE.password = null;
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginError').textContent = '❌ ভুল ইউজারনেম বা পাসওয়ার্ড';
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

function logout() {
  sessionStorage.removeItem('taza_admin_username');
  sessionStorage.removeItem('taza_admin_password');
  STATE.username = null;
  STATE.password = null;
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

async function loadDashboard() {
  await Promise.all([loadOrders(), loadProductSettings(), loadImages()]);
  var usernameInput = document.getElementById('newUsername');
  if (usernameInput) usernameInput.value = STATE.username || 'admin';
}

async function loadOrders() {
  try {
    var res = await fetch('/api/admin/orders', { headers: authHeaders() });
    if (res.ok) {
      STATE.orders = await res.json();
      renderOrders();
      updateStats();
      document.getElementById('lastRefresh').textContent = 'শেষ আপডেট: ' + new Date().toLocaleTimeString('bn-BD');
    } else if (res.status === 401) { logout(); }
  } catch(err) { console.error('Load orders error:', err); }
}

async function loadProductSettings() {
  try {
    var res = await fetch('/api/product');
    if (res.ok) {
      STATE.product = await res.json();
      document.getElementById('setPrice').value = STATE.product.pricePerKg;
      document.getElementById('setMinOrder').value = STATE.product.minOrderKg || 1;
      document.getElementById('setMaxOrder').value = STATE.product.maxOrderKg || 50;
      document.getElementById('setDesc').value = STATE.product.description || '';
      document.getElementById('setStock').checked = STATE.product.stockAvailable;
    }
  } catch(err) { console.error('Load settings error:', err); }
}

function updateStats() {
  var orders = STATE.orders;
  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statNew').textContent = orders.filter(function(o) { return o.status === 'new'; }).length;
  document.getElementById('statConfirmed').textContent = orders.filter(function(o) { return o.status === 'confirmed' || o.status === 'delivered'; }).length;
  var revenue = orders.filter(function(o) { return o.status !== 'cancelled'; }).reduce(function(sum, o) { return sum + (o.totalPrice || 0); }, 0);
  document.getElementById('statRevenue').textContent = revenue.toLocaleString('bn-BD');
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
    return '<div class="order-item"><div class="order-item-header"><div><span class="order-id">#' + escapeHTML(order.id) + '</span><span class="order-time">' + date + '</span></div><span class="status-badge ' + statusClass + '">' + (statusMap[order.status] || order.status) + '</span></div><div class="order-details"><div class="order-detail"><strong>ক্রেতা</strong>' + escapeHTML(order.customerName) + '</div><div class="order-detail"><strong>ফোন</strong><a href="tel:' + escapeHTML(order.phone) + '">' + escapeHTML(order.phone) + '</a></div><div class="order-detail"><strong>পরিমাণ</strong>' + escapeHTML(order.quantity) + ' কেজি</div><div class="order-detail"><strong>মোট মূল্য</strong>' + escapeHTML(order.totalPrice) + ' টাকা</div><div class="order-detail"><strong>ঠিকানা</strong>' + escapeHTML(order.address) + '</div><div class="order-detail"><strong>পেমেন্ট</strong>' + paymentLabel(order) + '</div>' + (order.email ? '<div class="order-detail"><strong>ইমেইল</strong>' + escapeHTML(order.email) + '</div>' : '') + (order.note ? '<div class="order-detail"><strong>নোট</strong>' + escapeHTML(order.note) + '</div>' : '') + '</div><div class="order-actions">' + actionsHTML + '</div></div>';
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  if (!confirm('অর্ডার স্ট্যাটাস পরিবর্তন করতে চান?')) return;
  try {
    var res = await fetch('/api/admin/orders/' + orderId, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showToast('অর্ডার স্ট্যাটাস আপডেট হয়েছে!', 'success');
      loadOrders();
    } else if (res.status === 401) { logout(); }
    else { var data = await res.json(); showToast(data.error || 'আপডেট ব্যর্থ', 'error'); }
  } catch(err) { showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

async function saveProductSettings() {
  try {
    var data = {
      pricePerKg: parseFloat(document.getElementById('setPrice').value),
      minOrderKg: parseInt(document.getElementById('setMinOrder').value),
      maxOrderKg: parseInt(document.getElementById('setMaxOrder').value),
      description: document.getElementById('setDesc').value,
      stockAvailable: document.getElementById('setStock').checked
    };
    var res = await fetch('/api/admin/product', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('প্রোডাক্ট সেটিংস সেভ হয়েছে!', 'success');
      loadProductSettings();
    } else if (res.status === 401) { logout(); }
    else { var errData = await res.json(); showToast(errData.error || 'সেভ ব্যর্থ', 'error'); }
  } catch(err) { showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

async function changeAccount() {
  var newUsername = document.getElementById('newUsername').value.trim();
  var newPassword = document.getElementById('newPassword').value.trim();
  if (!newUsername || newUsername.length < 3) {
    showToast('ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে', 'error');
    return;
  }
  if (!newPassword || newPassword.length < 10) {
    showToast('পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে', 'error');
    return;
  }
  try {
    var res = await fetch('/api/admin/account', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ newUsername: newUsername, newPassword: newPassword })
    });
    if (res.ok) {
      STATE.username = newUsername;
      STATE.password = newPassword;
      sessionStorage.setItem('taza_admin_username', newUsername);
      sessionStorage.setItem('taza_admin_password', newPassword);
      document.getElementById('newPassword').value = '';
      showToast('অ্যাডমিন অ্যাকাউন্ট আপডেট হয়েছে!', 'success');
    } else if (res.status === 401) { logout(); }
    else { var errData = await res.json(); showToast(errData.error || 'পরিবর্তন ব্যর্থ', 'error'); }
  } catch(err) { showToast('নেটওয়ার্ক সমস্যা', 'error'); }
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
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      showToast(file.name + ' সাপোর্টেড ছবি নয়', 'error');
      continue;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast(file.name + ' ৮MB এর বেশি', 'error');
      continue;
    }
    try {
      var dataUrl = await fileToDataURL(file);
      var res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: file.name, dataUrl: dataUrl, showInSlider: true })
      });
      if (!res.ok) {
        var data = await res.json();
        showToast(data.error || 'ছবি আপলোড ব্যর্থ', 'error');
      }
    } catch(err) {
      showToast('ছবি আপলোড ব্যর্থ', 'error');
    }
  }
  e.target.value = '';
  await loadImages();
  showToast('ছবি আপলোড সম্পন্ন হয়েছে', 'success');
}

async function loadImages() {
  try {
    var res = await fetch('/api/admin/images', { headers: authHeaders() });
    if (res.ok) {
      STATE.images = await res.json();
      renderImages();
    } else if (res.status === 401) { logout(); }
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
    var res = await fetch('/api/admin/images/' + id, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ showInSlider: checked })
    });
    if (res.ok) {
      showToast('স্লাইডার সেটিং আপডেট হয়েছে', 'success');
      loadImages();
    } else if (res.status === 401) { logout(); }
  } catch(err) { showToast('আপডেট ব্যর্থ', 'error'); }
}

async function deleteImage(id) {
  if (!confirm('এই ছবি ডিলিট করতে চান?')) return;
  try {
    var res = await fetch('/api/admin/images/' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      showToast('ছবি ডিলিট হয়েছে', 'success');
      loadImages();
    } else if (res.status === 401) { logout(); }
    else { var data = await res.json(); showToast(data.error || 'ডিলিট ব্যর্থ', 'error'); }
  } catch(err) { showToast('ডিলিট ব্যর্থ', 'error'); }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(tab) { tab.classList.remove('active'); });
  if (tabName === 'orders') {
    document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('tabOrders').classList.add('active');
  } else if (tabName === 'images') {
    document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('tabImages').classList.add('active');
    loadImages();
  } else {
    document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
    document.getElementById('tabSettings').classList.add('active');
  }
}

setInterval(function() {
  if (STATE.password) loadOrders();
}, 30000);
