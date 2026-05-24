var STATE = {
  product: null,
  pricePerKg: 120,
  minOrder: 1,
  maxOrder: 50,
  stockAvailable: true
};

var orderForm = document.getElementById('orderForm');
var successView = document.getElementById('successView');
var toast = document.getElementById('toast');
var submitBtn = document.getElementById('submitBtn');
var submitText = document.getElementById('submitText');
var submitSpinner = document.getElementById('submitSpinner');
var quantityInput = document.getElementById('quantity');
var paymentMethodInput = document.getElementById('paymentMethod');
var bkashPaymentBox = document.getElementById('bkashPaymentBox');
var transactionInput = document.getElementById('transactionId');

async function loadProduct() {
  try {
    var res = await fetch('/api/site');
    if (res.ok) {
      var site = await res.json();
      var product = site.product || site;
      STATE.product = product;
      if (site.bKashNumber && document.getElementById('bkashNumber')) { document.getElementById('bkashNumber').textContent = site.bKashNumber; }
      STATE.pricePerKg = product.pricePerKg;
      STATE.minOrder = product.minOrderKg || 1;
      STATE.maxOrder = product.maxOrderKg || 50;
      STATE.stockAvailable = product.stockAvailable;
      document.getElementById('formProductName').textContent = product.name;
      document.getElementById('formPrice').textContent = product.pricePerKg;
      document.getElementById('summaryPrice').textContent = product.pricePerKg;
      quantityInput.min = STATE.minOrder;
      quantityInput.max = STATE.maxOrder;
      quantityInput.placeholder = STATE.minOrder + '-' + STATE.maxOrder + ' কেজি';
      var stockEl = document.getElementById('formStockStatus');
      if (product.stockAvailable) {
        stockEl.innerHTML = '✅ স্টকে আছে';
        stockEl.style.color = 'var(--green-mid)';
      } else {
        stockEl.innerHTML = '❌ স্টক শেষ';
        stockEl.style.color = 'var(--red-500)';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
      }
      updateSummary();
    }
  } catch(e) {
    console.log('Using default product data');
    document.getElementById('summaryPrice').textContent = STATE.pricePerKg;
  }
}

function updateSummary() {
  var qty = parseInt(quantityInput.value) || 0;
  document.getElementById('summaryQty').textContent = qty || '-';
  document.getElementById('summaryPrice').textContent = STATE.pricePerKg;
  if (qty > 0) {
    document.getElementById('summaryTotal').textContent = (qty * STATE.pricePerKg) + ' টাকা';
  } else {
    document.getElementById('summaryTotal').textContent = '- টাকা';
  }
}

quantityInput.addEventListener('input', updateSummary);

function togglePaymentBox() {
  if (!paymentMethodInput || !bkashPaymentBox) return;
  if (paymentMethodInput.value === 'bkash') {
    bkashPaymentBox.classList.remove('hidden');
  } else {
    bkashPaymentBox.classList.add('hidden');
    if (transactionInput) transactionInput.value = '';
  }
}

if (paymentMethodInput) {
  paymentMethodInput.addEventListener('change', togglePaymentBox);
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function() {
    toast.classList.remove('show');
  }, 3500);
}

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(function(el) { el.classList.remove('visible'); });
  document.querySelectorAll('.form-input.error, .form-textarea.error, .form-select.error').forEach(function(el) { el.classList.remove('error'); });
}

function showError(fieldId, errorId) {
  var field = document.getElementById(fieldId);
  var error = document.getElementById(errorId);
  if (field) field.classList.add('error');
  if (error) error.classList.add('visible');
}

function validateForm() {
  clearErrors();
  var isValid = true;
  var name = document.getElementById('customerName').value.trim();
  if (!name) { showError('customerName', 'nameError'); isValid = false; }
  var phone = document.getElementById('phone').value.trim();
  var phoneRegex = /^01[3-9]\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) { showError('phone', 'phoneError'); isValid = false; }
  var email = document.getElementById('email').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('email', 'emailError'); isValid = false; }
  var address = document.getElementById('address').value.trim();
  if (!address || address.length < 5) { showError('address', 'addressError'); isValid = false; }
  var qty = parseInt(quantityInput.value);
  if (isNaN(qty) || qty < STATE.minOrder || qty > STATE.maxOrder) { showError('quantity', 'quantityError'); isValid = false; }
  var paymentMethod = paymentMethodInput ? paymentMethodInput.value : 'cod';
  if (paymentMethod === 'bkash') {
    var transactionId = transactionInput ? transactionInput.value.trim() : '';
    if (!transactionId || transactionId.length < 6) { showError('transactionId', 'transactionError'); isValid = false; }
  }
  if (!STATE.stockAvailable) { showToast('দুঃখিত, বর্তমানে আমের স্টক শেষ।', 'error'); isValid = false; }
  return isValid;
}

orderForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!validateForm()) return;
  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitSpinner.classList.remove('hidden');
  var orderData = {
    customerName: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    quantity: parseInt(quantityInput.value),
    paymentMethod: document.getElementById('paymentMethod').value,
    transactionId: transactionInput ? transactionInput.value.trim() : '',
    note: document.getElementById('note').value.trim()
  };
  try {
    var res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    var data = await res.json();
    if (res.ok && data.success) {
      orderForm.classList.add('hidden');
      successView.classList.remove('hidden');
      document.getElementById('successOrderId').textContent = 'অর্ডার #' + data.order.id;
      showToast(data.message, 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast(data.error || 'অর্ডার ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', 'error');
    }
  } catch(err) {
    console.error('Order error:', err);
    showToast('নেটওয়ার্ক সমস্যা। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
  } finally {
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitSpinner.classList.add('hidden');
  }
});

function resetForm() {
  orderForm.reset();
  orderForm.classList.remove('hidden');
  successView.classList.add('hidden');
  clearErrors();
  updateSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('phone').addEventListener('input', function(e) {
  var val = e.target.value.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  e.target.value = val;
});

loadProduct();
togglePaymentBox();
updateSummary();
