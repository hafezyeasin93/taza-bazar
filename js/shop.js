var SITE = null;
var CART_KEY = 'tazabazar_cart_v2';
var cart = loadCart();

function money(n) { return '৳' + Number(n || 0).toLocaleString('bn-BD'); }
function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return []; } }
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount(); }
function productImage(product) { return product.images && product.images.length ? product.images[0].url : ''; }
function productById(id) { return SITE && SITE.products ? SITE.products[id] : null; }

async function loadSite() {
  var res = await fetch('/api/site');
  SITE = await res.json();
  renderProducts(); renderCart(); initCheckout(); updateCartCount();
}

function updateCartCount() {
  var el = document.getElementById('cartCount');
  if (el) el.textContent = cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
}

function renderProducts() {
  var grid = document.getElementById('productGrid');
  if (!grid || !SITE) return;
  grid.innerHTML = Object.keys(SITE.products).map(function(id) {
    var p = SITE.products[id];
    var image = productImage(p);
    return '<article class="luxury-product-card">' +
      '<div class="product-visual">' + (image ? '<img src="' + image + '" alt="' + p.name + '">' : '<span>' + (p.emoji || '🍃') + '</span>') + '</div>' +
      '<div class="product-info"><div class="product-badges"><b class="stock-badge ' + (p.stock ? 'in' : 'out') + '">' + (p.stock ? 'In Stock' : 'Out of Stock') + '</b><b>' + (p.badge || 'Limited Hill Tracts Harvest') + '</b></div>' +
      '<h3>' + p.name + '</h3><small>' + p.englishName + '</small><p>' + p.description + '</p>' +
      '<div class="price-row"><strong>' + money(p.price) + '</strong><span>/ ' + p.unit + '</span></div>' +
      '<div class="qty-row"><button onclick="addToCart(\'' + p.id + '\')" ' + (!p.stock ? 'disabled' : '') + '>Add to Cart</button><button class="quick" onclick="buyNow(\'' + p.id + '\')" ' + (!p.stock ? 'disabled' : '') + '>Buy Now</button></div></div>' +
    '</article>';
  }).join('');
}

function addToCart(id) {
  var p = productById(id); if (!p || !p.stock) return;
  var existing = cart.find(function(item) { return item.productId === id; });
  if (existing) existing.qty = Math.min(existing.qty + 1, p.maxQty || 50);
  else cart.push({ productId: id, qty: p.minQty || 1 });
  saveCart(); renderCart(); openCart();
}

function buyNow(id) { addToCart(id); window.location.href = '/order'; }
function removeFromCart(id) { cart = cart.filter(function(i) { return i.productId !== id; }); saveCart(); renderCart(); initCheckout(); }
function changeQty(id, delta) {
  var item = cart.find(function(i) { return i.productId === id; }); var p = productById(id);
  if (!item || !p) return;
  item.qty = Math.max(p.minQty || 1, Math.min((p.maxQty || 50), item.qty + delta));
  saveCart(); renderCart(); initCheckout();
}

function cartTotal() { return cart.reduce(function(sum, item) { var p = productById(item.productId); return sum + (p ? p.price * item.qty : 0); }, 0); }

function renderCart() {
  var itemsEl = document.getElementById('cartItems');
  var totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = money(cartTotal());
  if (!itemsEl || !SITE) return;
  if (!cart.length) { itemsEl.innerHTML = '<div class="empty-cart">Your cart is empty</div>'; return; }
  itemsEl.innerHTML = cart.map(function(item) {
    var p = productById(item.productId); if (!p) return '';
    return '<div class="cart-line"><div><strong>' + p.name + '</strong><small>' + money(p.price) + ' × ' + item.qty + '</small></div><div class="cart-line-actions"><button onclick="changeQty(\'' + item.productId + '\',-1)">−</button><b>' + item.qty + '</b><button onclick="changeQty(\'' + item.productId + '\',1)">+</button><button onclick="removeFromCart(\'' + item.productId + '\')">×</button></div></div>';
  }).join('');
}

function openCart() { var d = document.getElementById('cartDrawer'); if (d) d.classList.add('open'); }
function closeCart() { var d = document.getElementById('cartDrawer'); if (d) d.classList.remove('open'); }

function initCheckout() {
  var list = document.getElementById('checkoutItems');
  if (!list || !SITE) return;
  if (!cart.length) list.innerHTML = '<div class="empty-cart">কার্ট খালি। <a href="/">প্রোডাক্ট নির্বাচন করুন</a></div>';
  else list.innerHTML = cart.map(function(item) { var p = productById(item.productId); return '<div class="checkout-line"><span>' + p.name + ' × ' + item.qty + ' ' + p.unit + '</span><strong>' + money(p.price * item.qty) + '</strong></div>'; }).join('');
  document.getElementById('checkoutTotal').textContent = money(cartTotal());
  setupCheckoutValidation();
}

function setupCheckoutValidation() {
  var form = document.getElementById('checkoutForm'); if (!form || form._ready) return; form._ready = true;
  var paymentMethod = document.getElementById('paymentMethod');
  var transactionId = document.getElementById('transactionId');
  var btn = document.getElementById('placeOrderBtn');
  function validate() {
    var method = paymentMethod.value;
    var txn = transactionId.value.trim();
    var ok = cart.length > 0 && ['bkash','nagad'].includes(method) && txn.length >= 6 && document.getElementById('customerName').value.trim() && /^01[3-9]\d{8}$/.test(document.getElementById('phone').value.replace(/\D/g,'')) && document.getElementById('address').value.trim().length >= 6;
    btn.disabled = !ok;
    var box = document.getElementById('paymentBox');
    if (method) { box.classList.remove('hidden'); document.getElementById('paymentLabel').textContent = method === 'bkash' ? 'bKash Personal Number' : 'Nagad Personal Number'; document.getElementById('paymentNumber').textContent = SITE.payments[method]; }
    else box.classList.add('hidden');
  }
  ['input','change'].forEach(function(evt) { form.addEventListener(evt, validate); });
  form.addEventListener('submit', submitOrder);
  validate();
}

async function submitOrder(e) {
  e.preventDefault();
  var msg = document.getElementById('checkoutMessage');
  var payload = {
    customerName: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('phone').value.replace(/\D/g,''),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    paymentMethod: document.getElementById('paymentMethod').value,
    transactionId: document.getElementById('transactionId').value.trim(),
    note: document.getElementById('note').value.trim(),
    items: cart
  };
  try {
    var res = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order failed');
    cart = []; saveCart(); renderCart();
    msg.className = 'checkout-message success';
    msg.textContent = 'অর্ডার সফল হয়েছে। Order ID: ' + data.order.id;
    e.target.reset(); document.getElementById('placeOrderBtn').disabled = true; initCheckout();
  } catch(err) {
    msg.className = 'checkout-message error'; msg.textContent = err.message;
  }
}

loadSite().catch(function(err) { console.error(err); });
