var STATE = {
  password: null,
  orders: [],
  product: null
};

var loginView = document.getElementById('loginView');
var dashboardView = document.getElementById('dashboardView');
var toast = document.getElementById('toast');

var savedPassword = sessionStorage.getItem('taza_admin_password');
if (savedPassword) {
  STATE.password = savedPassword;
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  loadDashboard();
}

document.getElementById('passwordInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') login();
});

function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
}

async function login() {
  var password = document.getElementById('passwordInput').value.trim();
  if (!password) {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginError').textContent = '❌ পাসওয়ার্ড লিখুন';
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
    var res = await fetch('/api/admin/orders?password=' + encodeURIComponent(password));
    if (res.ok) {
      STATE.password = password;
      sessionStorage.setItem('taza_admin_password', password);
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      loadDashboard();
      showToast('স্বাগতম! লগইন সফল হয়েছে।', 'success');
    } else {
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginError').textContent = '❌ ভুল পাসওয়ার্ড';
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
  sessionStorage.removeItem('taza_admin_password');
  STATE.password = null;
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

async function loadDashboard() {
  await Promise.all([loadOrders(), loadProductSettings()]);
}

async function loadOrders() {
  try {
    var res = await fetch('/api/admin/orders?password=' + encodeURIComponent(STATE.password));
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
    return '<div class="order-item"><div class="order-item-header"><div><span class="order-id">#' + order.id + '</span><span class="order-time">' + date + '</span></div><span class="status-badge ' + statusClass + '">' + (statusMap[order.status] || order.status) + '</span></div><div class="order-details"><div class="order-detail"><strong>ক্রেতা</strong>' + order.customerName + '</div><div class="order-detail"><strong>ফোন</strong><a href="tel:' + order.phone + '">' + order.phone + '</a></div><div class="order-detail"><strong>পরিমাণ</strong>' + order.quantity + ' কেজি</div><div class="order-detail"><strong>মোট মূল্য</strong>' + order.totalPrice + ' টাকা</div><div class="order-detail"><strong>ঠিকানা</strong>' + order.address + '</div><div class="order-detail"><strong>পেমেন্ট</strong>' + (order.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : order.paymentMethod) + '</div>' + (order.email ? '<div class="order-detail"><strong>ইমেইল</strong>' + order.email + '</div>' : '') + (order.note ? '<div class="order-detail"><strong>নোট</strong>' + order.note + '</div>' : '') + '</div><div class="order-actions">' + actionsHTML + '</div></div>';
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  if (!confirm('অর্ডার স্ট্যাটাস পরিবর্তন করতে চান?')) return;
  try {
    var res = await fetch('/api/admin/orders/' + orderId + '?password=' + encodeURIComponent(STATE.password), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    var res = await fetch('/api/admin/product?password=' + encodeURIComponent(STATE.password), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('প্রোডাক্ট সেটিংস সেভ হয়েছে!', 'success');
      loadProductSettings();
    } else if (res.status === 401) { logout(); }
    else { var errData = await res.json(); showToast(errData.error || 'সেভ ব্যর্থ', 'error'); }
  } catch(err) { showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

async function changePassword() {
  var newPassword = document.getElementById('newPassword').value.trim();
  if (!newPassword || newPassword.length < 4) {
    showToast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error');
    return;
  }
  try {
    var res = await fetch('/api/admin/password?password=' + encodeURIComponent(STATE.password), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword })
    });
    if (res.ok) {
      STATE.password = newPassword;
      sessionStorage.setItem('taza_admin_password', newPassword);
      document.getElementById('newPassword').value = '';
      showToast('পাসওয়ার্ড পরিবর্তন হয়েছে!', 'success');
    } else if (res.status === 401) { logout(); }
    else { var errData = await res.json(); showToast(errData.error || 'পরিবর্তন ব্যর্থ', 'error'); }
  } catch(err) { showToast('নেটওয়ার্ক সমস্যা', 'error'); }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(tab) { tab.classList.remove('active'); });
  if (tabName === 'orders') {
    document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('tabOrders').classList.add('active');
  } else {
    document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('tabSettings').classList.add('active');
  }
}

setInterval(function() {
  if (STATE.password) loadOrders();
}, 30000);
