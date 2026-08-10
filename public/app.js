// State management
let state = {
  products: {},
  cart: {},
  activeView: 'catalogue',
  stripe: null,
  checkoutSession: null,
  user: null,
  editingProductId: null,
  editingUserId: null,
  usersList: [],
  transactions: []
};

// DOM Elements
const views = {
  catalogue: document.getElementById('view-catalogue'),
  panier: document.getElementById('view-panier'),
  checkout: document.getElementById('view-checkout'),
  success: document.getElementById('view-success'),
  admin: document.getElementById('view-admin'),
  login: document.getElementById('view-login')
};

const navLinks = {
  catalogue: document.getElementById('btn-nav-catalogue'),
  panier: document.getElementById('btn-nav-panier'),
  admin: document.getElementById('btn-nav-admin')
};

const badge = document.getElementById('cart-badge');
const productGrid = document.getElementById('product-grid');
const modal = document.getElementById('product-modal');
const modalContent = document.getElementById('modal-product-details');

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAuth(); // Check if user session already exists
  await initStripe();
  await loadProducts();
  await refreshCart();
  
  // Handle success callback from Stripe
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  if (sessionId) {
    showSuccessView(sessionId);
  }
});

// Setup Action Listeners
function setupEventListeners() {
  // Navigation
  navLinks.catalogue.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('catalogue');
  });
  
  navLinks.panier.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('panier');
  });
  
  navLinks.admin.addEventListener('click', (e) => {
    e.preventDefault();
    if (state.user) {
      switchView('admin');
    } else {
      switchView('login');
    }
  });
  
  document.getElementById('btn-logo').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('catalogue');
  });
  
  document.getElementById('btn-back-to-store').addEventListener('click', () => {
    switchView('catalogue');
  });
  
  document.getElementById('btn-success-home').addEventListener('click', () => {
    // Clear query params and return home
    window.history.replaceState({}, document.title, window.location.pathname);
    switchView('catalogue');
  });

  // Modal close
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  
  // Back from checkout to cart
  document.getElementById('btn-back-to-cart').addEventListener('click', () => {
    if (state.checkoutSession) {
      state.checkoutSession.destroy();
      state.checkoutSession = null;
    }
    switchView('panier');
  });

  // Start checkout
  document.getElementById('btn-start-checkout').addEventListener('click', startCheckout);

  // Login form submit
  document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);

  // Logout button click
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Admin Panel Tab Events
  document.getElementById('tab-btn-transactions').addEventListener('click', () => switchAdminTab('transactions'));
  document.getElementById('tab-btn-products').addEventListener('click', () => switchAdminTab('products'));
  document.getElementById('tab-btn-users').addEventListener('click', () => switchAdminTab('users'));
  
  // Admin Form Cancel Edit
  document.getElementById('btn-cancel-edit-product').addEventListener('click', cancelEditProduct);
  document.getElementById('btn-cancel-edit-user').addEventListener('click', cancelEditUser);

  // Admin Form Submit
  document.getElementById('form-add-product').addEventListener('submit', handleAddProductSubmit);

  // Admin User Form Submit
  document.getElementById('form-add-user').addEventListener('submit', handleAddUserSubmit);

  // Transaction Modal Close
  document.getElementById('btn-close-tx-modal').addEventListener('click', closeTxModal);
  document.querySelector('#transaction-modal .modal-backdrop').addEventListener('click', closeTxModal);
}

// Fetch products from server
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderProducts();
  } catch (err) {
    console.error('Erreur lors du chargement du catalogue:', err);
    productGrid.innerHTML = `<p class="error">Impossible de charger le catalogue. Veuillez réessayer plus tard.</p>`;
  }
}

// Refresh cart state from server
async function refreshCart() {
  try {
    const res = await fetch('/api/cart');
    state.cart = await res.json();
    updateBadge();
    if (state.activeView === 'panier') {
      renderCart();
    }
  } catch (err) {
    console.error('Erreur lors du rafraîchissement du panier:', err);
  }
}

// Initialize Stripe Publishable Key
async function initStripe() {
  try {
    const res = await fetch('/api/config');
    const { publishableKey } = await res.json();
    if (publishableKey) {
      state.stripe = Stripe(publishableKey);
    } else {
      console.error('Stripe publishable key non configurée.');
    }
  } catch (err) {
    console.error('Erreur lors de la configuration de Stripe:', err);
  }
}

// Router/View Switcher
function switchView(viewName) {
  // If navigating to Admin but not logged in, redirect to login
  if (viewName === 'admin' && !state.user) {
    viewName = 'login';
  }
  
  state.activeView = viewName;
  
  // Update view classes
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.remove('hidden');
    } else {
      views[key].classList.add('hidden');
    }
  });

  // Update nav active state
  Object.keys(navLinks).forEach(key => {
    if (key === viewName) {
      navLinks[key].classList.add('active');
    } else {
      navLinks[key].classList.remove('active');
    }
  });

  // Load specific view details
  if (viewName === 'panier') {
    renderCart();
  } else if (viewName === 'admin') {
    adjustAdminTabs();
    switchAdminTab('transactions');
  } else if (viewName === 'login') {
    document.getElementById('form-login').reset();
    document.getElementById('login-error').classList.add('hidden');
  }
}

// Update header cart count badge
function updateBadge() {
  const totalItems = Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);
  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// Render Products Grid
function renderProducts() {
  productGrid.innerHTML = '';
  Object.values(state.products).forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.id = `card-${product.id}`;
    
    // Fallback emoji if no image path
    const hasImage = product.image && !product.image.match(/[\uD800-\uDFFF]./);
    const imgHtml = hasImage 
      ? `<img src="${product.image}" alt="${product.nom}" class="product-image">`
      : `<span style="font-size: 5rem;">${product.image}</span>`;
      
    card.innerHTML = `
      <div class="product-image-wrapper">
        ${imgHtml}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.nom}</h3>
        <p class="product-desc">${product.desc}</p>
        <div class="product-footer">
          <span class="product-price">${product.prix.toFixed(2)} $</span>
          <button class="btn btn-primary btn-view" data-id="${product.id}">
            Consulter <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;
    productGrid.appendChild(card);
  });

  // Event delegation for "Consulter" buttons
  productGrid.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prodId = btn.getAttribute('data-id');
      openModal(prodId);
    });
  });
}

// Render Cart Details Page
function renderCart() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartEmpty = document.getElementById('cart-empty');
  const cartSummary = document.getElementById('cart-summary');
  
  cartItemsContainer.innerHTML = '';
  
  const cartEntries = Object.entries(state.cart);
  
  if (cartEntries.length === 0) {
    cartEmpty.classList.remove('hidden');
    cartSummary.classList.add('hidden');
    return;
  }
  
  cartEmpty.classList.add('hidden');
  cartSummary.classList.remove('hidden');
  
  let subtotal = 0;
  
  cartEntries.forEach(([prodId, qty]) => {
    const prod = state.products[prodId];
    if (!prod) return;
    
    const itemSubtotal = prod.prix * qty;
    subtotal += itemSubtotal;
    
    const hasImage = prod.image && !prod.image.match(/[\uD800-\uDFFF]./);
    const imgHtml = hasImage 
      ? `<img src="${prod.image}" alt="${prod.nom}" class="cart-item-img">`
      : `<div class="cart-item-img" style="font-size: 2.5rem; display: flex; align-items: center; justify-content: center;">${prod.image}</div>`;

    const itemRow = document.createElement('div');
    itemRow.className = 'cart-item';
    itemRow.innerHTML = `
      <div class="cart-item-img-wrapper">
        ${imgHtml}
      </div>
      <div class="cart-item-info">
        <h4 class="cart-item-title">${prod.nom}</h4>
        <div class="cart-item-price">${prod.prix.toFixed(2)} $</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control" style="margin-bottom: 0;">
          <button class="qty-btn btn-qty-dec" data-id="${prodId}"><i class="fa-solid fa-minus"></i></button>
          <input type="number" class="qty-input inp-qty" data-id="${prodId}" value="${qty}" min="1">
          <button class="qty-btn btn-qty-inc" data-id="${prodId}"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="cart-item-subtotal">${itemSubtotal.toFixed(2)} $</div>
        <button class="btn-accent-icon btn-remove" data-id="${prodId}" title="Retirer l'article">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    cartItemsContainer.appendChild(itemRow);
  });
  
  // Update summaries
  document.getElementById('summary-subtotal').textContent = `${subtotal.toFixed(2)} $`;
  document.getElementById('summary-total').textContent = `${subtotal.toFixed(2)} $`;

  // Setup Cart Controls
  setupCartControls();
}

function setupCartControls() {
  const cartContainer = document.getElementById('cart-items');
  
  // Decrease qty
  cartContainer.querySelectorAll('.btn-qty-dec').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const currentQty = state.cart[id] || 1;
      if (currentQty > 1) {
        await updateCartQty(id, currentQty - 1);
      } else {
        await removeCartItem(id);
      }
    });
  });
  
  // Increase qty
  cartContainer.querySelectorAll('.btn-qty-inc').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const currentQty = state.cart[id] || 1;
      await updateCartQty(id, currentQty + 1);
    });
  });
  
  // Manual qty input change
  cartContainer.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-id');
      let val = parseInt(input.value);
      if (isNaN(val) || val < 1) {
        val = 1;
      }
      await updateCartQty(id, val);
    });
  });
  
  // Remove item
  cartContainer.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await removeCartItem(id);
    });
  });
}

// Add Item from Catalog View
async function addToCart(productId, quantity) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    
    if (res.ok) {
      await refreshCart();
      closeModal();
      switchView('panier');
    }
  } catch (err) {
    console.error('Erreur ajout panier:', err);
  }
}

// Update Cart Quantity in Backend
async function updateCartQty(productId, quantity) {
  try {
    const res = await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    if (res.ok) {
      await refreshCart();
    }
  } catch (err) {
    console.error('Erreur mise à jour quantité panier:', err);
  }
}

// Remove Cart Item in Backend
async function removeCartItem(productId) {
  try {
    const res = await fetch(`/api/cart/${productId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await refreshCart();
    }
  } catch (err) {
    console.error('Erreur suppression panier:', err);
  }
}

// Product Details Modal
function openModal(prodId) {
  const prod = state.products[prodId];
  if (!prod) return;

  const hasImage = prod.image && !prod.image.match(/[\uD800-\uDFFF]./);
  const imgHtml = hasImage 
    ? `<img src="${prod.image}" alt="${prod.nom}" class="modal-img">`
    : `<div class="modal-img" style="font-size: 6rem; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.2); height: 100%;">${prod.image}</div>`;

  modalContent.innerHTML = `
    <div class="modal-product-layout">
      <div class="modal-img-wrapper">
        ${imgHtml}
      </div>
      <div class="modal-details">
        <h2>${prod.nom}</h2>
        <div class="price">${prod.prix.toFixed(2)} $</div>
        <p class="desc">${prod.desc}</p>
        
        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">QUANTITÉ</label>
          <div class="qty-control" style="align-self: flex-start;">
            <button class="qty-btn" id="modal-qty-dec"><i class="fa-solid fa-minus"></i></button>
            <input type="number" id="modal-qty" class="qty-input" value="1" min="1">
            <button class="qty-btn" id="modal-qty-inc"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        
        <button class="btn btn-primary" id="btn-modal-add" style="margin-top: 10px; width: 100%;">
          <i class="fa-solid fa-cart-plus"></i> Ajouter au panier
        </button>
      </div>
    </div>
  `;

  // Modal Qty Logic
  const qtyInput = document.getElementById('modal-qty');
  document.getElementById('modal-qty-dec').addEventListener('click', () => {
    const val = parseInt(qtyInput.value) || 1;
    if (val > 1) qtyInput.value = val - 1;
  });
  document.getElementById('modal-qty-inc').addEventListener('click', () => {
    const val = parseInt(qtyInput.value) || 1;
    qtyInput.value = val + 1;
  });
  
  // Add to cart listener
  document.getElementById('btn-modal-add').addEventListener('click', () => {
    const qty = parseInt(qtyInput.value) || 1;
    addToCart(prod.id, qty);
  });

  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

// Stripe Embedded Checkout Implementation
async function startCheckout() {
  if (!state.stripe) {
    alert("Stripe n'est pas configuré. Veuillez vérifier vos clés Stripe.");
    return;
  }
  
  switchView('checkout');
  
  // Calculate total amount to show to the user
  let total = 0;
  Object.entries(state.cart).forEach(([id, qty]) => {
    const prod = state.products[id];
    if (prod) total += prod.prix * qty;
  });
  document.querySelector('#checkout-amount-display span').textContent = `${total.toFixed(2)} $`;

  // Initialize embedded checkout container layout loader
  const checkoutContainer = document.getElementById('checkout');
  checkoutContainer.innerHTML = `
    <div class="stripe-loader">
      <div class="spinner"></div>
      <p>Initialisation de la passerelle de paiement sécurisée...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST'
    });
    
    if (!res.ok) {
      throw new Error("Impossible d'initier la session Stripe.");
    }
    
    const { clientSecret } = await res.json();
    
    // Mount Stripe Embedded Checkout
    state.checkoutSession = await state.stripe.initEmbeddedCheckout({
      clientSecret
    });
    
    // Clear loader and mount
    checkoutContainer.innerHTML = '';
    state.checkoutSession.mount('#checkout');

  } catch (err) {
    console.error('Stripe Embedded Checkout error:', err);
    checkoutContainer.innerHTML = `
      <div class="stripe-loader" style="color: var(--accent);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; margin-bottom: 16px;"></i>
        <p>Une erreur est survenue lors de l'ouverture du checkout.</p>
        <button class="btn btn-secondary" id="btn-retry-checkout" style="margin-top: 15px;">Réessayer</button>
      </div>
    `;
    
    document.getElementById('btn-retry-checkout').addEventListener('click', startCheckout);
  }
}

// Handle Stripe callback and display Success page
async function showSuccessView(sessionId) {
  switchView('success');
  
  const statusIdSpan = document.getElementById('success-session-id');
  statusIdSpan.textContent = sessionId;
  
  try {
    // Check Stripe session status
    const res = await fetch(`/api/session-status?session_id=${sessionId}`);
    const details = await res.json();
    
    if (details.status === 'complete' && details.payment_status === 'paid') {
      // Clear local cart visual count
      await refreshCart();
    } else {
      console.warn("Statut Stripe incomplet:", details);
    }
  } catch (err) {
    console.error("Erreur lors de la récupération du statut Stripe:", err);
  }
}

// ==========================================
// ADMIN DASHBOARD CLIENT LOGIC
// ==========================================

// Switch between Admin Sub-Tabs
function switchAdminTab(tabName) {
  const btnTx = document.getElementById('tab-btn-transactions');
  const btnAdd = document.getElementById('tab-btn-add-product');
  const secTx = document.getElementById('admin-sec-transactions');
  const secAdd = document.getElementById('admin-sec-add-product');

  if (tabName === 'transactions') {
    btnTx.classList.add('active');
    btnAdd.classList.remove('active');
    secTx.classList.remove('hidden');
    secAdd.classList.add('hidden');
    loadTransactions();
  } else {
    btnTx.classList.remove('active');
    btnAdd.classList.add('active');
    secTx.classList.add('hidden');
    secAdd.classList.remove('hidden');
  }
}

// Fetch all transactions from SQLite backend
async function loadTransactions() {
  const listContainer = document.getElementById('admin-transactions-list');
  const emptyState = document.getElementById('admin-transactions-empty');
  
  listContainer.innerHTML = '<tr><td colspan="6" style="text-align: center;"><div class="spinner" style="margin: 0 auto; width: 24px; height: 24px;"></div></td></tr>';
  emptyState.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/transactions');
    if (!res.ok) throw new Error("Impossible de charger les transactions.");
    
    const transactions = await res.json();
    state.transactions = transactions; // Cache list
    listContainer.innerHTML = '';
    
    if (transactions.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    transactions.forEach(tx => {
      const row = document.createElement('tr');
      
      // Format Date
      const dateStr = new Date(tx.created_at).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      
      // Parse items
      let itemsListHtml = '<div class="admin-item-list">';
      try {
        const items = JSON.parse(tx.items);
        items.forEach(item => {
          itemsListHtml += `<span class="admin-item-tag">${item.nom} x${item.quantity}</span>`;
        });
      } catch (e) {
        itemsListHtml += `<span class="admin-item-tag">Données invalides</span>`;
      }
      itemsListHtml += '</div>';

      // Status Badge
      const isPaid = tx.status === 'paid';
      const statusBadge = `<span class="badge ${isPaid ? 'badge-success' : 'badge-pending'}">${isPaid ? 'Payé' : 'En attente'}</span>`;

      row.innerHTML = `
        <td><strong>${dateStr}</strong></td>
        <td>
          <div style="font-size: 0.75rem; font-family: monospace; color: var(--text-muted); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${tx.id}">${tx.id}</div>
          <div style="font-weight: 600; color: #fff; margin-top: 4px;">${tx.email || 'Non renseigné'}</div>
          ${tx.shipping_name ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;"><i class="fa-solid fa-user" style="font-size: 0.75rem;"></i> ${tx.shipping_name}</div>` : ''}
        </td>
        <td>${itemsListHtml}</td>
        <td><strong style="color: var(--primary); font-size: 1.05rem;">${tx.amount.toFixed(2)} $</strong></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-secondary btn-view-tx" data-id="${tx.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Détails de la transaction">
            <i class="fa-solid fa-eye"></i> Voir
          </button>
        </td>
      `;
      listContainer.appendChild(row);
    });

    // Wire up view buttons
    listContainer.querySelectorAll('.btn-view-tx').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        showTransactionDetails(id);
      });
    });

  } catch (err) {
    console.error("Erreur transactions admin:", err);
    listContainer.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--accent);">Erreur lors de la récupération des transactions.</td></tr>';
  }
}
// Add or update product via admin form submit (handles FormData and optional file upload)
async function handleAddProductSubmit(e) {
  e.preventDefault();
  
  const idInput = document.getElementById('prod-id');
  const nameInput = document.getElementById('prod-name');
  const priceInput = document.getElementById('prod-price');
  const descInput = document.getElementById('prod-desc');
  const imgFileInput = document.getElementById('prod-image-file');

  const isEdit = state.editingProductId !== null;

  if (!isEdit && (!imgFileInput.files || imgFileInput.files.length === 0)) {
    alert("Veuillez sélectionner une image pour le produit.");
    return;
  }

  const formData = new FormData();
  formData.append('nom', nameInput.value.trim());
  formData.append('prix', parseFloat(priceInput.value));
  formData.append('desc', descInput.value.trim());
  
  if (!isEdit) {
    formData.append('id', idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''));
  }
  
  if (imgFileInput.files && imgFileInput.files.length > 0) {
    formData.append('image', imgFileInput.files[0]);
  }

  const url = isEdit ? `/api/admin/products/${state.editingProductId}` : '/api/admin/products';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });

    const data = await res.json();
    
    if (res.ok) {
      alert(isEdit ? "Produit mis à jour avec succès dans SQLite !" : "Produit créé avec succès dans SQLite !");
      cancelEditProduct();
      
      // Reload products catalog
      await loadProducts();
      // Refresh admin products list
      await loadAdminProducts();
    } else {
      alert(`Erreur: ${data.error}`);
    }
  } catch (err) {
    console.error("Erreur enregistrement produit:", err);
    alert("Une erreur de réseau est survenue lors de l'enregistrement.");
  }
}
// AUTHENTICATION CLIENT LOGIC
// ==========================================

// Check session status on page load
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.loggedIn) {
      state.user = data.user;
    } else {
      state.user = null;
    }
  } catch (err) {
    console.error("Erreur lors de la vérification de session auth:", err);
  }
}

// Handle Login submit
async function handleLoginSubmit(e) {
  e.preventDefault();
  
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errContainer = document.getElementById('login-error');

  errContainer.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();

    if (res.ok) {
      state.user = data.user;
      switchView('admin');
    } else {
      errContainer.textContent = data.error || "Nom d'utilisateur ou mot de passe incorrect.";
      errContainer.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Erreur de connexion:", err);
    errContainer.textContent = "Erreur réseau. Impossible de contacter le serveur.";
    errContainer.classList.remove('hidden');
  }
}

// Handle Logout
async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      state.user = null;
      switchView('catalogue');
    }
  } catch (err) {
    console.error("Erreur de deconnexion:", err);
  }
}

// ==========================================
// USER MANAGEMENT LOGIC
// ==========================================

// Adjust admin tabs visibility based on user role
function adjustAdminTabs() {
  const btnProducts = document.getElementById('tab-btn-products');
  const btnUsers = document.getElementById('tab-btn-users');
  
  if (state.user && state.user.role === 'admin') {
    btnProducts.style.display = 'flex';
    btnUsers.style.display = 'flex';
  } else {
    btnProducts.style.display = 'none';
    btnUsers.style.display = 'none';
  }
}

// Switch admin views tab
function switchAdminTab(tabName) {
  const btnTx = document.getElementById('tab-btn-transactions');
  const btnProducts = document.getElementById('tab-btn-products');
  const btnUsers = document.getElementById('tab-btn-users');
  
  const secTx = document.getElementById('admin-sec-transactions');
  const secProducts = document.getElementById('admin-sec-products');
  const secUsers = document.getElementById('admin-sec-users');

  btnTx.classList.remove('active');
  btnProducts.classList.remove('active');
  btnUsers.classList.remove('active');
  secTx.classList.add('hidden');
  secProducts.classList.add('hidden');
  secUsers.classList.add('hidden');

  if (tabName === 'transactions') {
    btnTx.classList.add('active');
    secTx.classList.remove('hidden');
    loadTransactions();
  } else if (tabName === 'products') {
    btnProducts.classList.add('active');
    secProducts.classList.remove('hidden');
    loadAdminProducts();
    cancelEditProduct(); // Make sure form is reset to creation mode
  } else if (tabName === 'users') {
    btnUsers.classList.add('active');
    secUsers.classList.remove('hidden');
    loadUsers();
  }
}

// Fetch and render users list
async function loadUsers() {
  const listContainer = document.getElementById('admin-users-list');
  listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;"><div class="spinner" style="margin: 0 auto; width: 24px; height: 24px;"></div></td></tr>';

  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error("Impossible de charger les utilisateurs.");

    const users = await res.json();
    listContainer.innerHTML = '';

    // Cache users list for edit retrieval
    state.usersList = users;

    users.forEach(user => {
      const row = document.createElement('tr');
      const roleName = user.role === 'admin' ? 'Administrateur' : 'Lecture seule';
      
      const isSelf = state.user && user.username === state.user.username;
      
      // Status Badge
      const isBlocked = user.status === 'blocked';
      const statusBadge = `<span class="badge ${isBlocked ? 'badge-pending' : 'badge-success'}">${isBlocked ? 'Bloqué' : 'Actif'}</span>`;

      let actionHtml = '';
      if (isSelf) {
        actionHtml = `
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-secondary btn-edit-user" data-id="${user.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Modifier mon profil">
              <i class="fa-solid fa-user-pen"></i>
            </button>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">(Vous)</span>
          </div>
        `;
      } else {
        actionHtml = `
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary btn-edit-user" data-id="${user.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Modifier l'utilisateur">
              <i class="fa-solid fa-user-pen"></i>
            </button>
            <button class="btn-accent-icon btn-delete-user" data-id="${user.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Supprimer le compte">
              <i class="fa-solid fa-user-minus"></i>
            </button>
          </div>
        `;
      }

      row.innerHTML = `
        <td><strong>${user.username}</strong></td>
        <td><span class="badge ${user.role === 'admin' ? 'badge-success' : 'badge-pending'}">${roleName}</span></td>
        <td>${statusBadge}</td>
        <td>${actionHtml}</td>
      `;
      listContainer.appendChild(row);
    });

    // Wire up edit buttons
    listContainer.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        editUser(id);
      });
    });

    // Wire up delete buttons
    listContainer.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) {
          deleteUser(id);
        }
      });
    });

  } catch (err) {
    console.error("Erreur users admin:", err);
    listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--accent);">Erreur lors de la récupération des utilisateurs.</td></tr>';
  }
}

// Create or update user submit handler
async function handleAddUserSubmit(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('user-username');
  const passwordInput = document.getElementById('user-password');
  const roleSelect = document.getElementById('user-role');
  const statusSelect = document.getElementById('user-status');

  const isEdit = state.editingUserId !== null;

  const payload = {
    username: usernameInput.value.trim().toLowerCase(),
    role: roleSelect.value
  };

  if (passwordInput.value && passwordInput.value !== '') {
    payload.password = passwordInput.value;
  } else if (!isEdit) {
    alert("Le mot de passe est obligatoire pour créer un compte.");
    return;
  }

  if (isEdit) {
    payload.status = statusSelect.value;
  }

  const url = isEdit ? `/api/admin/users/${state.editingUserId}` : '/api/admin/users';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert(isEdit ? "Compte utilisateur mis à jour !" : "Utilisateur créé avec succès !");
      cancelEditUser();
      await loadUsers();
    } else {
      alert(`Erreur: ${data.error}`);
    }
  } catch (err) {
    console.error("Erreur enregistrement utilisateur:", err);
    alert("Une erreur réseau est survenue lors de l'enregistrement.");
  }
}

// Delete user in database
async function deleteUser(id) {
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      await loadUsers();
    } else {
      alert(`Erreur: ${data.error}`);
    }
  } catch (err) {
    console.error("Erreur suppression utilisateur:", err);
  }
}

// ==========================================
// PRODUCTS MANAGEMENT LOGIC
// ==========================================

// Load and list products in the Admin panel table
async function loadAdminProducts() {
  const listContainer = document.getElementById('admin-products-list');
  listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;"><div class="spinner" style="margin: 0 auto; width: 24px; height: 24px;"></div></td></tr>';

  try {
    // Re-fetch products catalogue
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error("Impossible de charger le catalogue.");
    
    state.products = await res.json();
    listContainer.innerHTML = '';
    
    const productEntries = Object.values(state.products);
    
    if (productEntries.length === 0) {
      listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Aucun produit en boutique.</td></tr>';
      return;
    }

    productEntries.forEach(prod => {
      const row = document.createElement('tr');
      
      const hasImage = prod.image && !prod.image.match(/[\uD800-\uDFFF]./);
      const imgHtml = hasImage 
        ? `<img src="${prod.image}" alt="${prod.nom}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);">`
        : `<div style="font-size: 1.5rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 4px;">${prod.image}</div>`;

      row.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${imgHtml}
            <span style="font-weight: 600; color: #fff;">${prod.nom}</span>
          </div>
        </td>
        <td><code style="color: var(--primary);">${prod.id}</code></td>
        <td><strong>${prod.prix.toFixed(2)} $</strong></td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary btn-edit-prod" data-id="${prod.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Modifier le produit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-accent-icon btn-delete-prod" data-id="${prod.id}" style="padding: 6px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" title="Supprimer de la boutique">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;
      listContainer.appendChild(row);
    });

    // Wire up edit buttons
    listContainer.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        editProduct(id);
      });
    });

    // Wire up delete buttons
    listContainer.querySelectorAll('.btn-delete-prod').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Voulez-vous vraiment supprimer "${state.products[id].nom}" de la boutique ?`)) {
          deleteProductFromStore(id);
        }
      });
    });

  } catch (err) {
    console.error("Erreur chargement produits admin:", err);
    listContainer.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--accent);">Erreur de chargement.</td></tr>';
  }
}

// Load product metadata into the form for editing
function editProduct(prodId) {
  const prod = state.products[prodId];
  if (!prod) return;

  // Set edit state
  state.editingProductId = prodId;

  // Fill form inputs
  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-id').readOnly = true;
  document.getElementById('prod-name').value = prod.nom;
  document.getElementById('prod-price').value = prod.prix;
  document.getElementById('prod-desc').value = prod.desc;

  // Modify form title & button labels
  document.getElementById('admin-product-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Modifier le produit`;
  document.getElementById('btn-submit-product').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Mettre à jour`;
  
  // Image is no longer required when modifying
  document.getElementById('prod-image-file').required = false;
  document.getElementById('prod-image-hint').textContent = "Formats : JPG, PNG, WEBP. Laissez vide pour conserver l'image actuelle.";

  // Show Cancel Edit button
  document.getElementById('btn-cancel-edit-product').classList.remove('hidden');

  // Scroll to form on mobile view
  document.getElementById('admin-product-form-title').scrollIntoView({ behavior: 'smooth' });
}

// Reset Product Editor Form back to creation mode
function cancelEditProduct() {
  state.editingProductId = null;
  document.getElementById('form-add-product').reset();

  document.getElementById('prod-id').readOnly = false;
  document.getElementById('admin-product-form-title').innerHTML = `<i class="fa-solid fa-plus"></i> Ajouter un Produit`;
  document.getElementById('btn-submit-product').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Enregistrer`;
  
  document.getElementById('prod-image-file').required = true;
  document.getElementById('prod-image-hint').textContent = "Formats : JPG, PNG, WEBP. L'image est requise lors de la création d'un produit.";

  document.getElementById('btn-cancel-edit-product').classList.add('hidden');
}

// Call backend DELETE API for product
async function deleteProductFromStore(prodId) {
  try {
    const res = await fetch(`/api/admin/products/${prodId}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      alert("Produit supprimé de la base SQLite !");
      await loadProducts();
      await loadAdminProducts();
    } else {
      const data = await res.json();
      alert(`Erreur: ${data.error}`);
    }
  } catch (err) {
    console.error("Erreur suppression produit:", err);
  }
}

// Load user metadata into form for editing
function editUser(userId) {
  const user = state.usersList.find(u => u.id === userId);
  if (!user) return;

  state.editingUserId = userId;

  // Fill form
  document.getElementById('user-username').value = user.username;
  document.getElementById('user-role').value = user.role;
  
  // Password is not required when editing
  document.getElementById('user-password').required = false;
  document.getElementById('user-password').placeholder = "••••••••";
  document.getElementById('user-password-label').textContent = "Modifier le mot de passe (facultatif)";
  document.getElementById('user-password-hint').classList.remove('hidden');

  // Show status select
  document.getElementById('group-user-status').classList.remove('hidden');
  document.getElementById('user-status').value = user.status;

  // Disable status and role changes if editing self
  const isSelf = state.user && user.username === state.user.username;
  document.getElementById('user-role').disabled = isSelf;
  document.getElementById('user-status').disabled = isSelf;

  // Modify form title & button labels
  document.getElementById('admin-user-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Modifier l'Utilisateur`;
  document.getElementById('btn-submit-user').textContent = "Mettre à jour";
  
  // Show Cancel Edit button
  document.getElementById('btn-cancel-edit-user').classList.remove('hidden');
}

// Reset User Editor Form
function cancelEditUser() {
  state.editingUserId = null;
  document.getElementById('form-add-user').reset();

  document.getElementById('user-password').required = true;
  document.getElementById('user-password').placeholder = "Mot de passe sécurisé";
  document.getElementById('user-password-label').textContent = "Mot de passe";
  document.getElementById('user-password-hint').classList.add('hidden');

  document.getElementById('group-user-status').classList.add('hidden');
  document.getElementById('user-role').disabled = false;
  document.getElementById('user-status').disabled = false;

  document.getElementById('admin-user-form-title').innerHTML = `<i class="fa-solid fa-user-plus"></i> Créer un Utilisateur`;
  document.getElementById('btn-submit-user').textContent = "Créer le compte";

  document.getElementById('btn-cancel-edit-user').classList.add('hidden');
}

// Show transaction receipt modal with line items
function showTransactionDetails(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  document.getElementById('tx-detail-id').textContent = tx.id;
  
  const dateStr = new Date(tx.created_at).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  document.getElementById('tx-detail-date').textContent = dateStr;
  document.getElementById('tx-detail-email').textContent = tx.email || 'Non renseigné';
  document.getElementById('tx-detail-shipping-name').textContent = tx.shipping_name || 'Non renseigné';
  document.getElementById('tx-detail-shipping-address').textContent = tx.shipping_address || 'Non renseigné';
  document.getElementById('tx-detail-phone').textContent = tx.phone || 'Non renseigné';
  
  // Status Badge
  const statusEl = document.getElementById('tx-detail-status');
  const isPaid = tx.status === 'paid';
  statusEl.className = `badge ${isPaid ? 'badge-success' : 'badge-pending'}`;
  statusEl.textContent = isPaid ? 'Payé' : 'En attente';

  // Amount
  document.getElementById('tx-detail-amount').textContent = `${tx.amount.toFixed(2)} $`;

  // Render items list
  const itemsContainer = document.getElementById('tx-detail-items');
  itemsContainer.innerHTML = '';

  try {
    const items = JSON.parse(tx.items);
    items.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.style.display = 'flex';
      itemRow.style.justifyContent = 'space-between';
      itemRow.style.alignItems = 'center';
      itemRow.style.padding = '8px 12px';
      itemRow.style.background = 'rgba(255,255,255,0.05)';
      itemRow.style.borderRadius = 'var(--radius-sm)';
      itemRow.style.border = '1px solid var(--border-color)';
      
      const subtotal = (item.prix * item.quantity).toFixed(2);

      itemRow.innerHTML = `
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 600; color: #fff;">${item.nom}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${item.prix.toFixed(2)} $ x ${item.quantity}</span>
        </div>
        <strong style="color: var(--text-secondary);">${subtotal} $</strong>
      `;
      itemsContainer.appendChild(itemRow);
    });
  } catch (e) {
    itemsContainer.innerHTML = '<p style="color: var(--accent); font-size: 0.9rem;">Impossible de charger le détail des articles.</p>';
  }

  // Open modal
  document.getElementById('transaction-modal').classList.remove('hidden');
}

// Close transaction modal
function closeTxModal() {
  document.getElementById('transaction-modal').classList.add('hidden');
}
