// ============================================================
// MAJOR STYLE JUNCTION — FULL-STACK COMMERCE & STOREFRONT ENGINE
// ============================================================

const MSJ_CONFIG = {
  freeShippingThreshold: 100,
  flatShippingRate: 8.95,
  formspreeOrderEndpoint: "https://formspree.io/f/myeypbka",
  supportEmail: "MajorStyleJunction@MajorStyleJunction.com",
  techSupportEmail: "cloud@majorstylejunction.com",
  techSupportSite: "https://cloud.majorstylejunction.com",
  itemsPerPage: 6
};

const MSJ_PRODUCTS = [
  {
    id: "msj-001",
    name: "MSJ Signature Heavyweight Tee",
    category: "tees",
    price: 38,
    unit_cost: 11.50,
    status: "In Stock",
    badge: "Drop 01",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    size_stock: { S: 10, M: 10, L: 10, XL: 10, "2XL": 10 },
    fit: "Boxy streetwear fit — true to size with slightly dropped shoulders.",
    care: "100% combed ring-spun cotton (6.5 oz). Machine wash cold inside-out; hang dry to preserve DTF artwork.",
    description: "Heavyweight 100% combed cotton blank featuring high-definition direct-to-film chest artwork."
  },
  {
    id: "msj-002",
    name: "Junction Streetwear Pullover Hoodie",
    category: "hoodies",
    price: 68,
    unit_cost: 24.00,
    status: "Coming Soon",
    badge: "Limited Run",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    size_stock: { S: 10, M: 10, L: 10, XL: 10, "2XL": 10 },
    fit: "Relaxed heavyweight silhouette — size up for an oversized look.",
    care: "14oz preshrunk cotton fleece. Double-lined hood, no drawcords. Wash cold inside-out.",
    description: "14oz heavyweight fleece hoodie built for structured drape and everyday durability."
  },
  {
    id: "msj-003",
    name: "Bold Statement Graphic Tee",
    category: "tees",
    price: 38,
    unit_cost: 11.50,
    status: "Coming Soon",
    badge: "Drop 01",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    size_stock: { S: 10, M: 10, L: 10, XL: 10, "2XL": 10 },
    fit: "Standard streetwear cut — pre-shrunk for consistent sizing.",
    care: "100% ring-spun cotton. Soft-hand full-color DTF graphic print. Do not iron directly over graphic.",
    description: "Vibrant full-color DTF graphic print pressed in-house with soft-hand finish."
  }
];

let LIVE_PRODUCTS = [...MSJ_PRODUCTS];
const activeGridRenders = {};
let appliedPromo = null;

function getProductStockMap(item) {
  if (item && item.size_stock && typeof item.size_stock === "object") {
    return item.size_stock;
  }
  const fallbackQty = item && (item.status || "").toLowerCase() === "sold out" ? 0 : 10;
  return { S: fallbackQty, M: fallbackQty, L: fallbackQty, XL: fallbackQty, "2XL": fallbackQty };
}

function getSizeAvailableQty(item, size) {
  if (!item) return 0;
  if ((item.status || "").toLowerCase() === "sold out") return 0;
  const map = getProductStockMap(item);
  return Number(map[size] ?? 0);
}

function getProductTotalStock(item) {
  if (!item || (item.status || "").toLowerCase() === "sold out") return 0;
  const map = getProductStockMap(item);
  return Object.values(map).reduce((sum, n) => sum + Number(n || 0), 0);
}

async function syncProductsFromSupabase() {
  if (!window.msjSupabase) return;
  const { data, error } = await window.msjSupabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (!error && Array.isArray(data) && data.length > 0) {
    LIVE_PRODUCTS = data;
    Object.entries(activeGridRenders).forEach(([containerId, opts]) => {
      renderProducts(containerId, opts);
    });
  }
}

// ============================================================
// CUSTOMER ACCOUNT, SAVED SHIPPING & ORDER HISTORY STATE
// ============================================================

const ACCOUNTS_DB_KEY = "msj_customer_accounts_v1";
const SESSION_KEY = "msj_active_customer_email_v1";
const CART_STORAGE_KEY = "msj_shopping_bag_v1";

let msjCart = [];
let currentUser = null;
let activeStaffSession = null;
let activeQuickViewProduct = null;
let selectedQuickViewSize = "L";
let editingAccountOrderNum = null;

function getAccountsDB() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAccountsDB(db) {
  try {
    localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(db));
  } catch {}
}

function encodePass(str) {
  return btoa(unescape(encodeURIComponent(str.trim())));
}

function formatSavedAddress(userObj) {
  if (!userObj) return "";
  return [userObj.street, userObj.cityZip].filter(Boolean).join(", ");
}

async function loadCurrentUser() {
  if (window.msjSupabase) {
    try {
      const { data: { session } } = await window.msjSupabase.auth.getSession();
      activeStaffSession = session && session.user ? session.user : null;
    } catch {
      activeStaffSession = null;
    }
  }

  try {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) {
      currentUser = null;
    } else {
      const db = getAccountsDB();
      currentUser = db[email.toLowerCase()] || null;
    }
  } catch {
    currentUser = null;
  }
  updateAccountUI();
}

function updateAccountUI() {
  document.querySelectorAll(".js-account-btn").forEach((btn) => {
    if (activeStaffSession) {
      const role = activeStaffSession.user_metadata?.role === "staff" ? "Staff" : "Owner";
      btn.textContent = `${role} Portal`;
      btn.classList.add("signed-in");
      btn.onclick = () => {
        window.location.href = "admin.html";
      };
    } else if (currentUser) {
      const firstName = currentUser.name.split(" ")[0] || "Account";
      btn.textContent = `Account (${firstName})`;
      btn.classList.add("signed-in");
      btn.onclick = () => openAccountModal("login");
    } else {
      btn.textContent = "Sign In";
      btn.classList.remove("signed-in");
      btn.onclick = () => openAccountModal("login");
    }
  });

  const loggedOutView = document.getElementById("msj-auth-logged-out");
  const loggedInView = document.getElementById("msj-auth-logged-in");
  if (!loggedOutView || !loggedInView) return;

  if (currentUser) {
    loggedOutView.style.display = "none";
    loggedInView.style.display = "block";
    document.getElementById("acct-welcome-name").textContent = currentUser.name;
    document.getElementById("acct-welcome-email").textContent = currentUser.email;

    document.getElementById("prof-name").value = currentUser.name || "";
    document.getElementById("prof-phone").value = currentUser.phone || "";
    document.getElementById("prof-size").value = currentUser.preferredSize || "L";
    document.getElementById("prof-street").value = currentUser.street || "";
    document.getElementById("prof-city-zip").value = currentUser.cityZip || "";
    const notesEl = document.getElementById("prof-delivery-notes");
    if (notesEl) notesEl.value = currentUser.deliveryNotes || "";

    renderOrderHistory();
  } else {
    loggedOutView.style.display = "block";
    loggedInView.style.display = "none";
  }
}

function handleRegisterAccount(e) {
  e.preventDefault();
  const statusEl = document.getElementById("auth-status-msg");
  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const passInput = document.getElementById("reg-password");
  const sizeInput = document.getElementById("reg-size");

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value;
  const preferredSize = sizeInput.value;

  [nameInput, emailInput, passInput].forEach((el) => {
    if (el) el.style.borderColor = "";
  });

  if (!name) {
    nameInput.style.borderColor = "#ef4444";
    nameInput.focus();
    statusEl.style.color = "#ef4444";
    statusEl.textContent = "Full Name field error: please enter your name.";
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.style.borderColor = "#ef4444";
    emailInput.focus();
    statusEl.style.color = "#ef4444";
    statusEl.textContent = "Email field error: enter a valid email address.";
    return;
  }

  const db = getAccountsDB();
  if (db[email]) {
    emailInput.style.borderColor = "#ef4444";
    emailInput.focus();
    statusEl.style.color = "#ef4444";
    statusEl.textContent = `Email field error: an account with ${email} already exists. Switch to Sign In.`;
    return;
  }

  if (!password || password.length < 6) {
    passInput.style.borderColor = "#ef4444";
    passInput.focus();
    statusEl.style.color = "#ef4444";
    statusEl.textContent = "Password field error: must be at least 6 characters.";
    return;
  }

  db[email] = {
    name,
    email,
    passHash: encodePass(password),
    preferredSize,
    phone: "",
    street: "",
    cityZip: "",
    deliveryNotes: "",
    orders: []
  };

  saveAccountsDB(db);
  localStorage.setItem(SESSION_KEY, email);
  loadCurrentUser();
  syncCustomerOrdersFromSupabase();
  statusEl.textContent = "";
}

async function handleSignInAccount(e) {
  e.preventDefault();
  const statusEl = document.getElementById("auth-status-msg");
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing In...";
  }
  statusEl.textContent = "";

  if (window.msjSupabase) {
    try {
      const { data, error } = await window.msjSupabase.auth.signInWithPassword({ email, password });
      if (!error && data && data.session) {
        statusEl.style.color = "#10b981";
        statusEl.textContent = "Staff / Admin credentials verified. Opening portal...";
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 400);
        return;
      }
    } catch {}
  }

  const db = getAccountsDB();
  const record = db[email];

  if (!record || record.passHash !== encodePass(password)) {
    statusEl.style.color = "#ef4444";
    statusEl.textContent = "Invalid email or password. Please check your credentials.";
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
    return;
  }

  localStorage.setItem(SESSION_KEY, email);
  await loadCurrentUser();
  await syncCustomerOrdersFromSupabase();
  statusEl.textContent = "";
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";
  }
}

function handleSaveProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  const db = getAccountsDB();
  const record = db[currentUser.email];
  if (!record) return;

  record.name = document.getElementById("prof-name").value.trim();
  record.phone = document.getElementById("prof-phone").value.trim();
  record.preferredSize = document.getElementById("prof-size").value;
  record.street = document.getElementById("prof-street").value.trim();
  record.cityZip = document.getElementById("prof-city-zip").value.trim();
  const notesEl = document.getElementById("prof-delivery-notes");
  if (notesEl) record.deliveryNotes = notesEl.value.trim();

  saveAccountsDB(db);
  loadCurrentUser();

  const msg = document.getElementById("prof-save-msg");
  msg.style.color = "#10b981";
  msg.textContent = "Saved! Your shipping address, contact info, and size will auto-fill at checkout.";
  setTimeout(() => {
    msg.textContent = "";
  }, 3500);
}

function handleSignOut() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  editingAccountOrderNum = null;
  updateAccountUI();
}

function switchAuthTab(tabName) {
  const loginForm = document.getElementById("msj-login-form");
  const regForm = document.getElementById("msj-register-form");
  const tabLogin = document.getElementById("tab-btn-login");
  const tabReg = document.getElementById("tab-btn-register");
  document.getElementById("auth-status-msg").textContent = "";

  if (tabName === "register") {
    loginForm.style.display = "none";
    regForm.style.display = "flex";
    tabLogin.classList.remove("active");
    tabReg.classList.add("active");
  } else {
    loginForm.style.display = "flex";
    regForm.style.display = "none";
    tabLogin.classList.add("active");
    tabReg.classList.remove("active");
  }
}

function switchAccountPanel(panelName) {
  const ordersPanel = document.getElementById("acct-panel-orders");
  const profilePanel = document.getElementById("acct-panel-profile");
  const btnOrders = document.getElementById("acct-tab-orders");
  const btnProfile = document.getElementById("acct-tab-profile");

  if (panelName === "profile") {
    ordersPanel.style.display = "none";
    profilePanel.style.display = "block";
    btnOrders.classList.remove("active");
    btnProfile.classList.add("active");
  } else {
    ordersPanel.style.display = "block";
    profilePanel.style.display = "none";
    btnOrders.classList.add("active");
    btnProfile.classList.remove("active");
  }
}

async function syncCustomerOrdersFromSupabase() {
  if (!currentUser || !window.msjSupabase) return;
  try {
    const { data, error } = await window.msjSupabase
      .from("orders")
      .select("order_number, fulfillment_status, tracking_carrier, tracking_number, total, created_at, shipping_address, items")
      .ilike("customer_email", currentUser.email)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data) || data.length === 0) return;

    const db = getAccountsDB();
    const record = db[currentUser.email];
    if (!record) return;

    const localByNum = new Map((record.orders || []).map((o) => [o.orderNumber, o]));
    record.orders = data.map((row) => {
      const existing = localByNum.get(row.order_number);
      const itemsSummary =
        existing?.itemsSummary ||
        (row.items || [])
          .map((i) => `${i.qty}x ${i.name} [Size: ${i.size}] ($${(Number(i.price) * Number(i.qty)).toFixed(2)})`)
          .join(" | ");
      return {
        orderNumber: row.order_number,
        date:
          existing?.date ||
          new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          }),
        status: row.fulfillment_status || existing?.status || "Unfulfilled",
        carrier: row.tracking_carrier || "",
        tracking: row.tracking_number || "",
        itemsSummary,
        shippingAddress: row.shipping_address || existing?.shippingAddress || "",
        phone: existing?.phone || record.phone || "",
        subtotal: `$${Number(row.total || 0).toFixed(2)}`,
        rawItems:
          existing?.rawItems ||
          (row.items || []).map((i) => ({ id: i.id, size: i.size, qty: i.qty }))
      };
    });

    saveAccountsDB(db);
    currentUser = db[currentUser.email];
    renderOrderHistory();
  } catch {}
}

function startEditAccountOrderAddress(orderNumber) {
  editingAccountOrderNum = orderNumber;
  renderOrderHistory();
}

function cancelEditAccountOrderAddress() {
  editingAccountOrderNum = null;
  renderOrderHistory();
}

async function saveAccountOrderAddress(orderNumber) {
  if (!currentUser) return;
  const input = document.getElementById(`edit-ord-addr-${orderNumber}`);
  const nextAddress = input ? input.value.trim() : "";
  if (!nextAddress) return;

  const db = getAccountsDB();
  const record = db[currentUser.email];
  if (record && Array.isArray(record.orders)) {
    record.orders = record.orders.map((o) =>
      o.orderNumber === orderNumber ? { ...o, shippingAddress: nextAddress } : o
    );
    saveAccountsDB(db);
    currentUser = db[currentUser.email];
  }

  if (window.msjSupabase) {
    await window.msjSupabase
      .from("orders")
      .update({ shipping_address: nextAddress })
      .eq("order_number", orderNumber)
      .catch(() => {});
  }

  editingAccountOrderNum = null;
  renderOrderHistory();
}

async function cancelUnfulfilledAccountOrder(orderNumber) {
  if (!currentUser) return;
  const db = getAccountsDB();
  const record = db[currentUser.email];
  if (!record || !Array.isArray(record.orders)) return;

  const target = record.orders.find((o) => o.orderNumber === orderNumber);
  if (!target || (target.status || "Unfulfilled") !== "Unfulfilled") return;

  record.orders = record.orders.map((o) =>
    o.orderNumber === orderNumber ? { ...o, status: "Cancelled" } : o
  );
  saveAccountsDB(db);
  currentUser = db[currentUser.email];

  if (window.msjSupabase) {
    await window.msjSupabase
      .from("orders")
      .update({ fulfillment_status: "Cancelled" })
      .eq("order_number", orderNumber)
      .catch(() => {});
  }

  renderOrderHistory();
}

function renderOrderHistory() {
  const listEl = document.getElementById("acct-order-history-list");
  if (!listEl || !currentUser) return;

  const orders = currentUser.orders || [];
  if (orders.length === 0) {
    listEl.innerHTML = `
      <div class="acct-empty">
        <p>No saved orders yet. When you place an order while signed in, it will appear here for tracking and one-click reordering.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = orders
    .map(
      (ord, index) => {
        const isEditing = editingAccountOrderNum === ord.orderNumber;
        const canModify = (ord.status || "Unfulfilled") === "Unfulfilled";
        const trackingLine = ord.tracking
          ? `<p class="order-ship-line"><strong>${ord.carrier || "Carrier"} Tracking:</strong> ${ord.tracking}</p>`
          : "";

        return `
          <div class="order-history-card">
            <div class="order-history-top">
              <div>
                <strong>Order #${ord.orderNumber}</strong>
                <span class="order-date">${ord.date}</span>
              </div>
              <span class="order-badge">${ord.status}</span>
            </div>
            <p class="order-items-line">${ord.itemsSummary}</p>
            ${
              isEditing
                ? `
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;">
                    <input type="text" id="edit-ord-addr-${ord.orderNumber}" value="${String(ord.shippingAddress || "").replace(/"/g, "&quot;")}" style="flex:1;min-width:200px;margin:0;padding:8px 10px;font-size:13px;">
                    <button type="button" class="filter-btn active" onclick="saveAccountOrderAddress('${ord.orderNumber}')">Save Address</button>
                    <button type="button" class="filter-btn" onclick="cancelEditAccountOrderAddress()">Cancel</button>
                  </div>
                `
                : `<p class="order-ship-line">Ship to: ${ord.shippingAddress}${ord.phone ? ` • ${ord.phone}` : ""}</p>`
            }
            ${trackingLine}
            <div class="order-history-bottom">
              <strong>Total: ${ord.subtotal}</strong>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${canModify && !isEditing ? `<button type="button" class="size-guide-link" onclick="startEditAccountOrderAddress('${ord.orderNumber}')">Edit Address</button>` : ""}
                ${canModify ? `<button type="button" class="size-guide-link" style="color:#ef4444;" onclick="cancelUnfulfilledAccountOrder('${ord.orderNumber}')">Cancel Order</button>` : ""}
                <button type="button" class="size-guide-link" onclick="closeAccountModal(); openTrackModal('${ord.orderNumber}', '${currentUser.email}')">Track Status</button>
                <button type="button" class="size-guide-link" onclick="reorderPastPurchase(${index})">Reorder</button>
              </div>
            </div>
          </div>
        `;
      }
    )
    .join("");
}

function reorderPastPurchase(orderIndex) {
  if (!currentUser || !currentUser.orders || !currentUser.orders[orderIndex]) return;
  const pastItems = currentUser.orders[orderIndex].rawItems || [];
  let addedAny = false;

  pastItems.forEach((item) => {
    const product = LIVE_PRODUCTS.find((p) => p.id === item.id);
    if (!product) return;
    const chosenSize = item.size || "L";
    const maxAvailable = getSizeAvailableQty(product, chosenSize);
    if (maxAvailable <= 0) return;

    const wantQty = Math.min(Number(item.qty || 1), maxAvailable);
    const existingIndex = msjCart.findIndex(
      (entry) => entry.id === product.id && entry.size === chosenSize
    );

    if (existingIndex > -1) {
      msjCart[existingIndex].qty = Math.min(
        maxAvailable,
        msjCart[existingIndex].qty + wantQty
      );
    } else {
      msjCart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        unit_cost: Number(product.unit_cost || 11.5),
        image: product.image,
        status: product.status,
        size: chosenSize,
        qty: wantQty
      });
    }
    addedAny = true;
  });

  if (addedAny) {
    saveCart();
    closeAccountModal();
    openCartDrawer();
  }
}

function openAccountModal(defaultTab = "login") {
  if (activeStaffSession) {
    window.location.href = "admin.html";
    return;
  }
  const modal = document.getElementById("msj-account-modal");
  if (!modal) return;
  document.body.style.overflow = "hidden";
  if (!currentUser) {
    switchAuthTab(defaultTab);
  }
  updateAccountUI();
  if (currentUser) {
    syncCustomerOrdersFromSupabase();
  }
  modal.classList.add("active");
}

function closeAccountModal() {
  const modal = document.getElementById("msj-account-modal");
  if (modal) modal.classList.remove("active");
  if (!document.getElementById("msj-cart-drawer")?.classList.contains("active")) {
    document.body.style.overflow = "";
  }
}

// ============================================================
// SHOPPING BAG, PROMO CODE, IMAGE LIGHTBOX & STOCK ENGINE
// ============================================================

function renderTypographicGraphic(subLabel = "MAJOR STYLE JUNCTION") {
  return `
    <div class="emblem-lockup">
      <div class="emblem-box">MSJ</div>
      <span class="emblem-sub">${subLabel}</span>
    </div>
  `;
}

function inspectBagImage(src, title) {
  if (!src || src === "typographic") return;
  const viewer = document.getElementById("msj-bag-img-lightbox");
  const imgEl = document.getElementById("msj-lightbox-img");
  const titleEl = document.getElementById("msj-lightbox-title");
  if (!viewer || !imgEl || !titleEl) return;

  titleEl.textContent = title || "Item Preview";
  imgEl.src = src;
  imgEl.alt = title || "Item Preview";
  viewer.classList.add("active");
}

function closeBagImageLightbox() {
  const viewer = document.getElementById("msj-bag-img-lightbox");
  if (viewer) viewer.classList.remove("active");
}

function loadCart() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    msjCart = saved ? JSON.parse(saved) : [];
  } catch {
    msjCart = [];
  }
  updateCartUI();
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(msjCart));
  } catch {}
  updateCartUI();
}

function addToBag(productId, size) {
  const product = LIVE_PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const chosenSize = size || "L";
  const maxAvailable = getSizeAvailableQty(product, chosenSize);
  const qvNotice = document.getElementById("qv-stock-indicator");

  if (maxAvailable <= 0) {
    if (qvNotice) {
      qvNotice.style.color = "#ef4444";
      qvNotice.textContent = `Size ${chosenSize} is currently sold out.`;
    }
    return;
  }

  const existingIndex = msjCart.findIndex(
    (entry) => entry.id === productId && entry.size === chosenSize
  );

  if (existingIndex > -1) {
    if (msjCart[existingIndex].qty >= maxAvailable) {
      if (qvNotice) {
        qvNotice.style.color = "#d97706";
        qvNotice.textContent = `You already have the max available (${maxAvailable}) of Size ${chosenSize} in your bag.`;
      }
      return;
    }
    msjCart[existingIndex].qty += 1;
  } else {
    msjCart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      unit_cost: Number(product.unit_cost || 11.5),
      image: product.image,
      status: product.status,
      size: chosenSize,
      qty: 1
    });
  }

  saveCart();
  closeQuickView();
  openCartDrawer();
}

function updateBagQty(index, delta) {
  const entry = msjCart[index];
  if (!entry) return;

  if (delta > 0) {
    const product = LIVE_PRODUCTS.find((p) => p.id === entry.id);
    const maxAvailable = product ? getSizeAvailableQty(product, entry.size) : 99;
    if (entry.qty + delta > maxAvailable) return;
  }

  entry.qty += delta;
  if (entry.qty <= 0) {
    msjCart.splice(index, 1);
  }
  saveCart();
}

function removeBagItem(index) {
  msjCart.splice(index, 1);
  saveCart();
}

function calculateBagTotals() {
  const subtotal = msjCart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
  const cogsTotal = msjCart.reduce((sum, item) => {
    const prod = LIVE_PRODUCTS.find((p) => p.id === item.id);
    const unitCost = Number(item.unit_cost) || Number(prod?.unit_cost || 11.5);
    return sum + unitCost * Number(item.qty);
  }, 0);

  let discount = 0;
  if (appliedPromo && subtotal > 0) {
    if (appliedPromo.discount_type === "percent") {
      discount = subtotal * (Number(appliedPromo.discount_value) / 100);
    } else {
      discount = Math.min(subtotal, Number(appliedPromo.discount_value));
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shipping = discountedSubtotal === 0 || discountedSubtotal >= MSJ_CONFIG.freeShippingThreshold
    ? 0
    : MSJ_CONFIG.flatShippingRate;
  const total = discountedSubtotal + shipping;

  return { subtotal, cogsTotal, discount, discountedSubtotal, shipping, total };
}

async function applyPromoCode() {
  const input = document.getElementById("bag-promo-input");
  const msg = document.getElementById("bag-promo-msg");
  if (!input || !msg) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    appliedPromo = null;
    msg.textContent = "";
    updateCartUI();
    return;
  }

  if (!window.msjSupabase) {
    msg.style.color = "#ef4444";
    msg.textContent = "Promo validation unavailable offline.";
    return;
  }

  const { data, error } = await window.msjSupabase
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    appliedPromo = null;
    msg.style.color = "#ef4444";
    msg.textContent = "Invalid or expired promo code.";
  } else {
    appliedPromo = data;
    msg.style.color = "#10b981";
    msg.textContent =
      data.discount_type === "percent"
        ? `Code ${data.code} applied (${data.discount_value}% off)!`
        : `Code ${data.code} applied ($${Number(data.discount_value).toFixed(2)} off)!`;
  }
  updateCartUI();
}

function updateCartUI() {
  const totalCount = msjCart.reduce((sum, item) => sum + item.qty, 0);
  const { subtotal, discount, discountedSubtotal, shipping, total } = calculateBagTotals();

  document.querySelectorAll(".js-bag-count").forEach((el) => {
    el.textContent = totalCount;
  });

  const itemsContainer = document.getElementById("msj-bag-items");
  const subtotalEl = document.getElementById("msj-bag-subtotal");
  const discountRow = document.getElementById("msj-bag-discount-row");
  const discountEl = document.getElementById("msj-bag-discount");
  const shippingCostEl = document.getElementById("msj-bag-shipping-cost");
  const totalEl = document.getElementById("msj-bag-total");
  const shippingTextEl = document.getElementById("msj-shipping-text");
  const shippingFillEl = document.getElementById("msj-shipping-fill");
  const checkoutSection = document.getElementById("msj-bag-checkout-area");

  if (!itemsContainer) return;

  const threshold = MSJ_CONFIG.freeShippingThreshold;
  const pct = Math.min(100, Math.round((discountedSubtotal / threshold) * 100));
  if (shippingFillEl) shippingFillEl.style.width = `${pct}%`;

  if (shippingTextEl) {
    if (discountedSubtotal === 0) {
      shippingTextEl.innerHTML = `Add <strong>$${threshold}</strong> to unlock <strong>FREE Standard Shipping</strong>.`;
    } else if (discountedSubtotal < threshold) {
      const remaining = threshold - discountedSubtotal;
      shippingTextEl.innerHTML = `You're <strong>$${remaining.toFixed(2)}</strong> away from <strong>FREE Shipping!</strong>`;
    } else {
      shippingTextEl.innerHTML = `Unlocked: <strong>FREE Standard Shipping</strong> applied to your order.`;
    }
  }

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (discountRow && discountEl) {
    discountRow.style.display = discount > 0 ? "flex" : "none";
    discountEl.textContent = `-$${discount.toFixed(2)}`;
  }
  if (shippingCostEl) {
    shippingCostEl.textContent = shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`;
  }
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  if (msjCart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="bag-empty">
        <p>Your shopping bag is currently empty.</p>
        <a href="shop.html" class="btn" style="background:#09090b;color:#fff;margin-top:14px;">Explore Drops</a>
      </div>
    `;
    if (checkoutSection) checkoutSection.style.display = "none";
    return;
  }

  if (checkoutSection) checkoutSection.style.display = "block";

  itemsContainer.innerHTML = msjCart
    .map((item, idx) => {
      const safeName = String(item.name || "").replace(/'/g, "\\'");
      const safeImg = String(item.image || "").replace(/'/g, "\\'");
      const thumbMarkup =
        !item.image || item.image === "typographic"
          ? `<div class="bag-typo-thumb">MSJ</div>`
          : `<img src="${item.image}" alt="${item.name}" title="Click to preview photo" onclick="inspectBagImage('${safeImg}', '${safeName}')">`;

      return `
        <div class="bag-item">
          ${thumbMarkup}
          <div class="bag-item-details">
            <div class="bag-item-top">
              <h4>${item.name}</h4>
              <button type="button" class="bag-remove" onclick="removeBagItem(${idx})" aria-label="Remove item">&times;</button>
            </div>
            <p class="bag-item-meta">Size: <strong>${item.size}</strong> • $${Number(item.price).toFixed(2)} each</p>
            <div class="bag-item-controls">
              <div class="qty-box">
                <button type="button" onclick="updateBagQty(${idx}, -1)" aria-label="Decrease quantity">-</button>
                <span>${item.qty}</span>
                <button type="button" onclick="updateBagQty(${idx}, 1)" aria-label="Increase quantity">+</button>
              </div>
              <span class="bag-item-total">$${(Number(item.price) * item.qty).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function openCartDrawer() {
  const drawer = document.getElementById("msj-cart-drawer");
  if (!drawer) return;
  document.body.style.overflow = "hidden";

  const noteEl = document.getElementById("msj-bag-account-note");
  const nameInput = document.getElementById("bag-cust-name");
  const emailInput = document.getElementById("bag-cust-email");
  const phoneInput = document.getElementById("bag-cust-phone");
  const addrInput = document.getElementById("bag-cust-address");
  const notesInput = document.getElementById("bag-cust-notes");
  const saveCheckbox = document.getElementById("bag-save-profile-check");

  if (currentUser && nameInput && emailInput && addrInput) {
    nameInput.value = currentUser.name || "";
    emailInput.value = currentUser.email || "";
    if (phoneInput) phoneInput.value = currentUser.phone || "";
    const fullSavedAddr = formatSavedAddress(currentUser);
    if (fullSavedAddr) addrInput.value = fullSavedAddr;
    if (notesInput) notesInput.value = currentUser.deliveryNotes || "";
    if (saveCheckbox) saveCheckbox.checked = true;

    if (noteEl) {
      noteEl.innerHTML = `Signed in as <strong>${currentUser.name}</strong> — <button type="button" class="size-guide-link" onclick="closeCartDrawer(); openAccountModal('login');">Edit Saved Profile</button>`;
    }
  } else if (noteEl) {
    noteEl.innerHTML = `<button type="button" class="size-guide-link" onclick="closeCartDrawer(); openAccountModal('login');">Sign in</button> to auto-fill shipping &amp; save order history.`;
  }

  drawer.classList.add("active");
}

function closeCartDrawer() {
  closeBagImageLightbox();
  const drawer = document.getElementById("msj-cart-drawer");
  if (drawer) drawer.classList.remove("active");
  document.body.style.overflow = "";
}

// ============================================================
// PRODUCT GRID, FILTER, SIZE FILTER, SORT & PAGINATION ENGINE
// ============================================================

function changeCatalogPage(containerId, targetPage) {
  const existing = activeGridRenders[containerId];
  if (!existing) return;
  renderProducts(containerId, { ...existing, page: targetPage });
  const grid = document.getElementById(containerId);
  if (grid) {
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderProducts(containerId, options = {}) {
  activeGridRenders[containerId] = options;
  const grid = document.getElementById(containerId);
  if (!grid) return;

  const {
    category = "all",
    sizeFilter = "all",
    search = "",
    sort = "featured",
    limit = null,
    page = 1,
    perPage = MSJ_CONFIG.itemsPerPage
  } = options;

  let items = [...LIVE_PRODUCTS];

  if (category !== "all") {
    items = items.filter((item) => item.category === category);
  }

  if (sizeFilter !== "all") {
    items = items.filter((item) => getSizeAvailableQty(item, sizeFilter) > 0);
  }

  if (search.trim() !== "") {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => {
      const availSizes = ["S", "M", "L", "XL", "2XL"]
        .filter((s) => getSizeAvailableQty(item, s) > 0)
        .join(" ")
        .toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.badge || "").toLowerCase().includes(q) ||
        availSizes.includes(q)
      );
    });
  }

  if (sort === "price-asc") {
    items.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === "price-desc") {
    items.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sort === "newest") {
    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else if (sort === "instock") {
    items = items.filter((item) => getProductTotalStock(item) > 0 && item.status.toLowerCase() !== "sold out");
  }

  const totalMatches = items.length;
  const countBadge = document.getElementById("catalog-results-count");
  if (countBadge && !limit) {
    countBadge.textContent = `${totalMatches} piece${totalMatches === 1 ? "" : "s"} found`;
  }

  let totalPages = 1;
  let safePage = 1;
  if (limit) {
    items = items.slice(0, limit);
  } else if (perPage && items.length > perPage) {
    totalPages = Math.ceil(items.length / perPage);
    safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * perPage;
    items = items.slice(startIdx, startIdx + perPage);
  }

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-state">No pieces match your current search or filter. Try clearing your search, size, or category.</p>`;
    const pagBar = document.getElementById(`${containerId}-pagination`);
    if (pagBar) pagBar.innerHTML = "";
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const totalStock = getProductTotalStock(item);
      const isSoldOut = item.status.toLowerCase() === "sold out" || totalStock === 0;
      const displayStatus = isSoldOut ? "Sold Out" : item.status;

      const statusClass = isSoldOut
        ? "status-soldout"
        : displayStatus.toLowerCase() === "in stock"
        ? "status-instock"
        : "status-soon";

      const btnLabel = isSoldOut
        ? "Sold Out"
        : displayStatus.toLowerCase() === "coming soon"
        ? "Quick View & Reserve"
        : "Select Size & Add to Bag";

      const mediaContent =
        !item.image || item.image === "typographic"
          ? renderTypographicGraphic(item.badge)
          : `<img src="${item.image}" alt="${item.name}" loading="lazy">`;

      const allSizes = ["S", "M", "L", "XL", "2XL"];
      const sizePillsHtml = allSizes
        .map((s) => {
          const qty = getSizeAvailableQty(item, s);
          const isHighlighted = sizeFilter === s && qty > 0;
          return qty > 0
            ? `<span style="${isHighlighted ? "background:#09090b;color:#fff;border-color:#09090b;" : ""}">${s}</span>`
            : `<span style="opacity:0.35;text-decoration:line-through;">${s}</span>`;
        })
        .join("");

      return `
        <article class="product-card">
          <div class="product-media" onclick="openQuickView('${item.id}')" style="cursor:pointer;">
            <span class="product-badge">${item.badge}</span>
            <span class="product-status ${statusClass}">${displayStatus}</span>
            ${mediaContent}
            <span class="quickview-hint">Quick View</span>
          </div>
          <div class="product-info">
            <div class="product-header">
              <h3 onclick="openQuickView('${item.id}')" style="cursor:pointer;">${item.name}</h3>
              <span class="product-price">$${item.price}</span>
            </div>
            <p class="product-desc">${item.description}</p>
            <div class="size-pills">${sizePillsHtml}</div>
            <button
              type="button"
              class="btn-card ${isSoldOut ? "btn-disabled" : ""}"
              ${isSoldOut ? "disabled" : `onclick="openQuickView('${item.id}')"`}
            >
              ${btnLabel}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  if (!limit) {
    let pagBar = document.getElementById(`${containerId}-pagination`);
    if (!pagBar) {
      pagBar = document.createElement("div");
      pagBar.id = `${containerId}-pagination`;
      pagBar.style.cssText = "display:flex;justify-content:center;align-items:center;gap:8px;margin-top:28px;flex-wrap:wrap;";
      grid.insertAdjacentElement("afterend", pagBar);
    }

    if (totalPages <= 1) {
      pagBar.innerHTML = "";
    } else {
      const pageButtons = Array.from({ length: totalPages }, (_, idx) => idx + 1)
        .map(
          (pNum) => `
          <button type="button" class="filter-btn ${pNum === safePage ? "active" : ""}" onclick="changeCatalogPage('${containerId}', ${pNum})">${pNum}</button>
        `
        )
        .join("");

      pagBar.innerHTML = `
        <button type="button" class="filter-btn" ${safePage <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : `onclick="changeCatalogPage('${containerId}', ${safePage - 1})"`}>&larr; Prev</button>
        ${pageButtons}
        <button type="button" class="filter-btn" ${safePage >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : `onclick="changeCatalogPage('${containerId}', ${safePage + 1})"`}>Next &rarr;</button>
      `;
    }
  }
}

// ============================================================
// QUICK-VIEW & SIZE GUIDE MODALS
// ============================================================

function openQuickView(productId) {
  const item = LIVE_PRODUCTS.find((p) => p.id === productId);
  const modal = document.getElementById("msj-quickview-modal");
  if (!item || !modal) return;

  activeQuickViewProduct = item;
  const allSizes = ["S", "M", "L", "XL", "2XL"];
  const inStockSizes = allSizes.filter((sz) => getSizeAvailableQty(item, sz) > 0);
  const preferred = currentUser && currentUser.preferredSize;

  selectedQuickViewSize =
    preferred && inStockSizes.includes(preferred)
      ? preferred
      : inStockSizes.includes("L")
      ? "L"
      : inStockSizes[0] || "L";

  const qvMedia = document.getElementById("qv-media-box");
  if (qvMedia) {
    qvMedia.innerHTML =
      !item.image || item.image === "typographic"
        ? renderTypographicGraphic(item.badge)
        : `<img src="${item.image}" alt="${item.name}">`;
  }

  const totalStock = getProductTotalStock(item);
  const isSoldOut = item.status.toLowerCase() === "sold out" || totalStock === 0;
  const isComingSoon = !isSoldOut && item.status.toLowerCase() === "coming soon";

  document.getElementById("qv-badge").textContent = `${item.badge} • ${isSoldOut ? "Sold Out" : item.status}`;
  document.getElementById("qv-title").textContent = item.name;
  document.getElementById("qv-price").textContent = `$${Number(item.price).toFixed(2)}`;
  document.getElementById("qv-desc").textContent = isComingSoon
    ? `${item.description} (Coming Soon — reserving locks your size for priority dispatch once pressed.)`
    : item.description;
  document.getElementById("qv-fit").textContent = item.fit || "True to streetwear sizing.";
  document.getElementById("qv-care").textContent = item.care || "Machine wash cold inside-out.";

  renderQuickViewSizes();

  const addBtn = document.getElementById("qv-add-btn");
  addBtn.disabled = isSoldOut;
  addBtn.textContent = isSoldOut
    ? "Sold Out"
    : isComingSoon
    ? `Add Drop Reservation to Bag — $${item.price}`
    : `Add to Bag — $${item.price}`;

  modal.classList.add("active");
}

function renderQuickViewSizes() {
  const container = document.getElementById("qv-size-buttons");
  const stockNote = document.getElementById("qv-stock-indicator");
  if (!container || !activeQuickViewProduct) return;

  const allSizes = ["S", "M", "L", "XL", "2XL"];
  container.innerHTML = allSizes
    .map((sz) => {
      const qty = getSizeAvailableQty(activeQuickViewProduct, sz);
      const disabled = qty <= 0;
      return `
      <button
        type="button"
        class="qv-size-btn ${sz === selectedQuickViewSize && !disabled ? "selected" : ""}"
        ${disabled ? 'disabled style="opacity:0.35;text-decoration:line-through;cursor:not-allowed;"' : `onclick="selectQuickViewSize('${sz}')"`}
      >
        ${sz}
      </button>
    `;
    })
    .join("");

  if (stockNote) {
    const selectedQty = getSizeAvailableQty(activeQuickViewProduct, selectedQuickViewSize);
    if (selectedQty <= 0) {
      stockNote.style.color = "#ef4444";
      stockNote.textContent = `Size ${selectedQuickViewSize}: Sold Out`;
    } else if (selectedQty <= 3) {
      stockNote.style.color = "#d97706";
      stockNote.textContent = `Low stock — only ${selectedQty} left in Size ${selectedQuickViewSize}!`;
    } else {
      stockNote.style.color = "#10b981";
      stockNote.textContent = `${selectedQty} available in Size ${selectedQuickViewSize}`;
    }
  }
}

function selectQuickViewSize(sz) {
  selectedQuickViewSize = sz;
  renderQuickViewSizes();
}

function closeQuickView() {
  const modal = document.getElementById("msj-quickview-modal");
  if (modal) modal.classList.remove("active");
}

function openSizeGuide() {
  const modal = document.getElementById("msj-sizeguide-modal");
  if (modal) modal.classList.add("active");
}

function closeSizeGuide() {
  const modal = document.getElementById("msj-sizeguide-modal");
  if (modal) modal.classList.remove("active");
}

// ============================================================
// SELF-SERVICE CUSTOMER ORDER TRACKER MODAL
// ============================================================

function openTrackModal(prefillOrder = "", prefillEmail = "") {
  const modal = document.getElementById("msj-track-modal");
  if (!modal) return;
  if (prefillOrder) document.getElementById("track-order-num").value = prefillOrder;
  if (prefillEmail) document.getElementById("track-order-email").value = prefillEmail;
  modal.classList.add("active");
  if (prefillOrder && prefillEmail) {
    handleLookupOrder();
  }
}

function closeTrackModal() {
  const modal = document.getElementById("msj-track-modal");
  if (modal) modal.classList.remove("active");
}

async function handleLookupOrder(e) {
  if (e) e.preventDefault();
  const orderNum = document.getElementById("track-order-num").value.trim().replace(/^#/, "");
  const email = document.getElementById("track-order-email").value.trim();
  const resultEl = document.getElementById("track-order-result");

  resultEl.innerHTML = `<p style="font-size:13px;color:var(--text-muted);">Searching order records...</p>`;

  if (!window.msjSupabase) {
    resultEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">Tracking service unavailable offline.</p>`;
    return;
  }

  const { data, error } = await window.msjSupabase.rpc("lookup_customer_order", {
    p_order_number: orderNum,
    p_email: email
  });

  if (error || !data || data.length === 0) {
    resultEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">No matching order found. Check your Order Number (e.g., MSJ-482910) and email address.</p>`;
    return;
  }

  const ord = data[0];
  const itemsList = (ord.items || [])
    .map((i) => `<li>${i.qty}x ${i.name} (Size: <strong>${i.size}</strong>)</li>`)
    .join("");

  resultEl.innerHTML = `
    <div style="background:#f4f4f5;padding:16px;border-radius:12px;margin-top:12px;font-size:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong>Order #${ord.order_number}</strong>
        <span class="order-badge">${ord.fulfillment_status}</span>
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Payment: <strong>${ord.payment_status}</strong> • Total: <strong>$${Number(ord.total).toFixed(2)}</strong></p>
      ${
        ord.tracking_number
          ? `<p style="background:#fff;padding:10px;border-radius:8px;margin-bottom:10px;"><strong>${ord.tracking_carrier || "Carrier"} Tracking:</strong> ${ord.tracking_number}</p>`
          : `<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Tracking number will appear here as soon as your package is scanned for dispatch.</p>`
      }
      <ul style="padding-left:18px;font-size:13px;">${itemsList}</ul>
    </div>
  `;
}

// ============================================================
// CHECKOUT HANDLERS (STRIPE CHECKOUT + DIRECT DATABASE ORDER)
// ============================================================

function generateOrderNumber() {
  return `MSJ-${Math.floor(100000 + Math.random() * 900000)}`;
}

function copyOrderNumber(orderNum) {
  navigator.clipboard?.writeText(orderNum).catch(() => {});
}

async function processStripeCheckout() {
  const statusEl = document.getElementById("msj-bag-status");
  const stripeBtn = document.getElementById("msj-stripe-btn");
  const { total } = calculateBagTotals();
  const typedEmail = document.getElementById("bag-cust-email")?.value.trim() || "";
  const checkoutEmail = currentUser?.email || typedEmail;

  if (stripeBtn) {
    stripeBtn.disabled = true;
    stripeBtn.textContent = "Connecting to Secure Checkout...";
  }
  if (statusEl) statusEl.textContent = "";

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: msjCart,
        promoCode: appliedPromo ? appliedPromo.code : "",
        customerEmail: checkoutEmail
      })
    });

    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }

    if (statusEl) {
      statusEl.style.color = "#d97706";
      statusEl.textContent = data.error || `Card checkout is being activated ($${total.toFixed(2)}). Use "Complete Order Request" below to reserve your items now.`;
    }
  } catch {
    if (statusEl) {
      statusEl.style.color = "#d97706";
      statusEl.textContent = `Card checkout is being activated. Use "Complete Order Request" below to reserve your items now.`;
    }
  } finally {
    if (stripeBtn) {
      stripeBtn.disabled = false;
      stripeBtn.textContent = "Pay Now with Card / Apple Pay";
    }
  }
}

async function submitDirectOrderToDatabase(e) {
  e.preventDefault();
  const statusEl = document.getElementById("msj-bag-status");
  const btn = document.getElementById("msj-direct-order-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Locking In Order...";
  }

  const customerName = document.getElementById("bag-cust-name").value.trim();
  const customerEmail = document.getElementById("bag-cust-email").value.trim();
  const customerPhone = document.getElementById("bag-cust-phone")?.value.trim() || "";
  const rawAddress = document.getElementById("bag-cust-address").value.trim();
  const deliveryNotes = document.getElementById("bag-cust-notes")?.value.trim() || "";
  const saveToProfile = Boolean(document.getElementById("bag-save-profile-check")?.checked);

  const shippingAddress = deliveryNotes
    ? `${rawAddress} (Note: ${deliveryNotes})`
    : rawAddress;

  const { subtotal, cogsTotal, discount, shipping, total } = calculateBagTotals();
  const orderNumber = generateOrderNumber();

  const orderSummary = msjCart
    .map((i) => `${i.qty}x ${i.name} [Size: ${i.size}] ($${(i.price * i.qty).toFixed(2)})`)
    .join(" | ");

  try {
    if (window.msjSupabase) {
      const { error: orderErr } = await window.msjSupabase.from("orders").insert([{
        order_number: orderNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        shipping_address: shippingAddress,
        items: msjCart,
        subtotal,
        cogs_total: cogsTotal,
        discount_amount: discount,
        promo_code: appliedPromo ? appliedPromo.code : "",
        shipping_cost: shipping,
        total,
        payment_status: "Pending Invoice",
        fulfillment_status: "Unfulfilled"
      }]);

      if (orderErr) throw orderErr;

      for (const item of msjCart) {
        if (item.id && !item.id.startsWith("msj-")) {
          await window.msjSupabase.rpc("decrement_product_stock", {
            p_product_id: item.id,
            p_size: item.size,
            p_qty: item.qty
          });
        }
      }

      if (appliedPromo) {
        await window.msjSupabase.rpc("increment_promo_use", { p_code: appliedPromo.code });
      }
    }

    const payload = new FormData();
    payload.append("order_number", orderNumber);
    payload.append("customer_name", customerName);
    payload.append("customer_email", customerEmail);
    payload.append("customer_phone", customerPhone);
    payload.append("shipping_address", shippingAddress);
    payload.append("order_items", orderSummary);
    payload.append("order_total", `$${total.toFixed(2)}`);
    await fetch(MSJ_CONFIG.formspreeOrderEndpoint, {
      method: "POST",
      body: payload,
      headers: { Accept: "application/json" }
    }).catch(() => {});

    if (currentUser) {
      const db = getAccountsDB();
      const record = db[currentUser.email];
      if (record) {
        if (saveToProfile) {
          record.name = customerName || record.name;
          if (customerPhone) record.phone = customerPhone;
          if (rawAddress) {
            record.street = rawAddress;
            record.cityZip = "";
          }
          if (deliveryNotes) record.deliveryNotes = deliveryNotes;
        }
        record.orders = record.orders || [];
        record.orders.unshift({
          orderNumber,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: "Unfulfilled",
          itemsSummary: orderSummary,
          shippingAddress,
          phone: customerPhone,
          subtotal: `$${total.toFixed(2)}`,
          rawItems: msjCart.map((i) => ({ id: i.id, size: i.size, qty: i.qty }))
        });
        saveAccountsDB(db);
        await loadCurrentUser();
      }
    }

    if (statusEl) {
      statusEl.style.color = "#10b981";
      statusEl.innerHTML = `Order <strong>#${orderNumber}</strong> reserved! <button type="button" class="size-guide-link" onclick="copyOrderNumber('${orderNumber}')">Copy #</button> • <button type="button" class="size-guide-link" onclick="closeCartDrawer(); openTrackModal('${orderNumber}', '${customerEmail}');">Track Status</button>`;
    }

    msjCart = [];
    appliedPromo = null;
    saveCart();
    syncProductsFromSupabase();
    document.getElementById("msj-bag-checkout-form")?.reset();
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = "#ef4444";
      statusEl.textContent = "Could not submit order: " + err.message;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Complete Order Request (Reserve Stock)";
    }
  }
}

// ============================================================
// HEADER CUSTOMER SEARCH MODAL + NAV & FOOTER INJECTION
// ============================================================

function openHeaderSearchModal(prefill = "") {
  const modal = document.getElementById("msj-header-search-modal");
  const input = document.getElementById("msj-header-search-input");
  if (!modal || !input) return;
  if (prefill) input.value = prefill;
  modal.classList.add("active");
  renderHeaderSearchResults();
  setTimeout(() => input.focus(), 50);
}

function closeHeaderSearchModal() {
  const modal = document.getElementById("msj-header-search-modal");
  if (modal) modal.classList.remove("active");
}

function renderHeaderSearchResults() {
  const input = document.getElementById("msj-header-search-input");
  const box = document.getElementById("msj-header-search-results");
  if (!input || !box) return;

  const q = input.value.trim().toLowerCase();
  const matches = q
    ? LIVE_PRODUCTS.filter((item) =>
        `${item.name} ${item.category} ${item.badge || ""} ${item.description || ""}`
          .toLowerCase()
          .includes(q)
      )
    : LIVE_PRODUCTS.slice(0, 5);

  if (matches.length === 0) {
    box.innerHTML = `<p style="padding:18px;text-align:center;font-size:13px;color:var(--text-muted);">No apparel matched "${input.value}". Try searching "tee", "hoodie", or "drop".</p>`;
    return;
  }

  box.innerHTML = matches
    .map((item) => {
      const stock = getProductTotalStock(item);
      const thumb =
        !item.image || item.image === "typographic"
          ? `<div class="bag-typo-thumb" style="width:56px;height:56px;min-width:56px;font-size:13px;">MSJ</div>`
          : `<img src="${item.image}" alt="${item.name}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">`;
      return `
        <div onclick="closeHeaderSearchModal(); openQuickView('${item.id}');" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border,#e4e4e7);border-radius:10px;background:#fff;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${thumb}
            <div>
              <strong style="font-size:14px;display:block;">${item.name}</strong>
              <span style="font-size:12px;color:var(--text-muted);">${item.badge} • ${stock > 0 ? `${stock} in stock` : "Sold Out"}</span>
            </div>
          </div>
          <strong style="font-size:15px;">$${Number(item.price).toFixed(2)}</strong>
        </div>
      `;
    })
    .join("");
}

function injectNavAndFooterLinks() {
  const nav = document.querySelector("header nav");
  const bagTrigger = nav && nav.querySelector(".bag-trigger");
  if (nav && bagTrigger && !nav.querySelector(".js-account-btn")) {
    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "account-trigger";
    searchBtn.textContent = "Search";
    searchBtn.title = "Search Catalog (Ctrl+K)";
    searchBtn.onclick = () => openHeaderSearchModal();
    nav.insertBefore(searchBtn, bagTrigger);

    const trackBtn = document.createElement("button");
    trackBtn.type = "button";
    trackBtn.className = "account-trigger";
    trackBtn.textContent = "Track Order";
    trackBtn.onclick = () => openTrackModal();
    nav.insertBefore(trackBtn, bagTrigger);

    const acctBtn = document.createElement("button");
    acctBtn.type = "button";
    acctBtn.className = "account-trigger js-account-btn";
    acctBtn.textContent = "Sign In";
    acctBtn.onclick = () => openAccountModal("login");
    nav.insertBefore(acctBtn, bagTrigger);
  }

  const footer = document.querySelector("footer");
  if (footer && !footer.querySelector(".footer-tech-bar")) {
    const techBar = document.createElement("div");
    techBar.className = "footer-tech-bar";
    techBar.innerHTML = `
      <span>Website &amp; Technical Support by <a href="${MSJ_CONFIG.techSupportSite}" rel="noreferrer"><strong>MSJ Cloud</strong></a> — Need site or tech help? Email <a href="mailto:${MSJ_CONFIG.techSupportEmail}">${MSJ_CONFIG.techSupportEmail}</a> • <a href="#" onclick="event.preventDefault(); openHeaderSearchModal();">Search</a> • <a href="#" onclick="event.preventDefault(); openTrackModal();">Track Order</a> • <a href="admin.html">Admin</a></span>
    `;
    footer.appendChild(techBar);
  }
}

function injectStorefrontOverlays() {
  if (document.getElementById("msj-cart-drawer")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <!-- Bag Photo Zoom Lightbox -->
    <div id="msj-bag-img-lightbox" class="modal-overlay" style="z-index: 400;" onclick="if(event.target===this) closeBagImageLightbox()">
      <div class="modal-box" style="max-width: 520px; text-align: center;">
        <button type="button" class="modal-close" onclick="closeBagImageLightbox()" aria-label="Close Preview">&times;</button>
        <span class="section-kicker">Bag Item Preview</span>
        <h3 id="msj-lightbox-title" style="font-size: 18px; margin-bottom: 14px;">Item Preview</h3>
        <img id="msj-lightbox-img" src="" alt="" style="width: 100%; max-height: 65vh; object-fit: contain; border-radius: 12px; background: #f4f4f5; padding: 12px;">
      </div>
    </div>

    <!-- Instant Catalog Search Modal (Ctrl+K) -->
    <div id="msj-header-search-modal" class="modal-overlay" onclick="if(event.target===this) closeHeaderSearchModal()">
      <div class="modal-box" style="max-width: 540px;">
        <button type="button" class="modal-close" onclick="closeHeaderSearchModal()" aria-label="Close">&times;</button>
        <span class="section-kicker">Instant Catalog Search</span>
        <h3 style="font-size:22px;margin-bottom:10px;">Search Major Style Junction</h3>
        <input type="text" id="msj-header-search-input" placeholder="Search hoodies, tees, drops, sizes..." oninput="renderHeaderSearchResults()" style="margin-bottom:12px;">
        <div id="msj-header-search-results" style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;"></div>
        <div style="margin-top:14px;text-align:right;">
          <a href="shop.html" class="size-guide-link">Open Full Filter &amp; Size Catalog &rarr;</a>
        </div>
      </div>
    </div>

    <!-- Track Order Modal -->
    <div id="msj-track-modal" class="modal-overlay" onclick="if(event.target===this) closeTrackModal()">
      <div class="modal-box" style="max-width: 480px;">
        <button type="button" class="modal-close" onclick="closeTrackModal()" aria-label="Close">&times;</button>
        <span class="section-kicker">Live Fulfillment Status</span>
        <h3 style="font-size:22px;margin-bottom:6px;">Track Your Order</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Enter your Order Number and checkout email to view packing status and carrier tracking.</p>
        <form onsubmit="handleLookupOrder(event)" style="display:flex;flex-direction:column;gap:10px;">
          <input type="text" id="track-order-num" placeholder="Order Number (e.g., MSJ-482910)" required>
          <input type="email" id="track-order-email" placeholder="Checkout Email Address" required>
          <button type="submit" class="btn-card">Check Order Status</button>
        </form>
        <div id="track-order-result"></div>
      </div>
    </div>

    <!-- Member & Staff Sign-In Modal -->
    <div id="msj-account-modal" class="modal-overlay" onclick="if(event.target===this) closeAccountModal()">
      <div class="modal-box" style="max-width: 540px;">
        <button type="button" class="modal-close" onclick="closeAccountModal()" aria-label="Close">&times;</button>

        <div id="msj-auth-logged-out">
          <span class="section-kicker">Member &amp; Staff Portal</span>
          <h3 style="font-size:24px;margin-bottom:6px;">Sign In</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:18px;">Customers can sign in or create an account below. Staff members can sign in here using their work login to clock in and manage orders.</p>

          <div class="auth-tabs">
            <button type="button" id="tab-btn-login" class="filter-btn active" onclick="switchAuthTab('login')">Sign In</button>
            <button type="button" id="tab-btn-register" class="filter-btn" onclick="switchAuthTab('register')">Create Customer Account</button>
          </div>

          <form id="msj-login-form" onsubmit="handleSignInAccount(event)" style="display:flex;flex-direction:column;gap:12px;">
            <input type="email" id="login-email" placeholder="Email Address" required>
            <input type="password" id="login-password" placeholder="Password" required>
            <button type="submit" class="btn-card">Sign In</button>
          </form>

          <form id="msj-register-form" onsubmit="handleRegisterAccount(event)" style="display:none;flex-direction:column;gap:12px;">
            <input type="text" id="reg-name" placeholder="Full Name" required>
            <input type="email" id="reg-email" placeholder="Email Address" required>
            <input type="password" id="reg-password" placeholder="Create Password (min 6 characters)" minlength="6" required>
            <select id="reg-size">
              <option value="S">Preferred Size: Small (S)</option>
              <option value="M">Preferred Size: Medium (M)</option>
              <option value="L" selected>Preferred Size: Large (L)</option>
              <option value="XL">Preferred Size: XL</option>
              <option value="2XL">Preferred Size: 2XL</option>
            </select>
            <button type="submit" class="btn-card">Create Customer Account</button>
          </form>

          <p id="auth-status-msg" class="modal-status" style="margin-top:10px;"></p>
        </div>

        <div id="msj-auth-logged-in" style="display:none;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-right:32px;margin-bottom:16px;">
            <div>
              <span class="section-kicker">Member Account</span>
              <h3 id="acct-welcome-name" style="font-size:22px;">Customer Name</h3>
              <p id="acct-welcome-email" style="font-size:13px;color:var(--text-muted);">email@example.com</p>
            </div>
            <button type="button" class="filter-btn" onclick="handleSignOut()">Sign Out</button>
          </div>

          <div class="auth-tabs">
            <button type="button" id="acct-tab-orders" class="filter-btn active" onclick="switchAccountPanel('orders')">Order History</button>
            <button type="button" id="acct-tab-profile" class="filter-btn" onclick="switchAccountPanel('profile')">Saved Shipping &amp; Size</button>
          </div>

          <div id="acct-panel-orders">
            <div id="acct-order-history-list" class="order-history-list"></div>
          </div>

          <div id="acct-panel-profile" style="display:none;">
            <form onsubmit="handleSaveProfile(event)" style="display:flex;flex-direction:column;gap:12px;">
              <input type="text" id="prof-name" placeholder="Full Name" required>
              <input type="text" id="prof-phone" placeholder="Phone Number (for delivery updates)">
              <input type="text" id="prof-street" placeholder="Default Street Address, Apt / Suite #">
              <input type="text" id="prof-city-zip" placeholder="City, State &amp; Zip Code">
              <input type="text" id="prof-delivery-notes" placeholder="Delivery Instructions (optional — porch, gate, etc.)">
              <select id="prof-size">
                <option value="S">Preferred Size: Small (S)</option>
                <option value="M">Preferred Size: Medium (M)</option>
                <option value="L">Preferred Size: Large (L)</option>
                <option value="XL">Preferred Size: XL</option>
                <option value="2XL">Preferred Size: 2XL</option>
              </select>
              <button type="submit" class="btn-card">Save Shipping &amp; Size</button>
              <p id="prof-save-msg" class="modal-status"></p>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Quick-View Modal -->
    <div id="msj-quickview-modal" class="modal-overlay" onclick="if(event.target===this) closeQuickView()">
      <div class="modal-box modal-box-wide">
        <button type="button" class="modal-close" onclick="closeQuickView()" aria-label="Close">&times;</button>
        <div class="qv-grid">
          <div id="qv-media-box" class="qv-media"></div>
          <div class="qv-details">
            <span id="qv-badge" class="section-kicker">Drop 01</span>
            <h3 id="qv-title" style="font-size:24px;margin-bottom:4px;">Product Name</h3>
            <p id="qv-price" style="font-size:20px;font-weight:700;margin-bottom:14px;">$0.00</p>
            <p id="qv-desc" style="font-size:14px;color:var(--text-muted);margin-bottom:18px;"></p>

            <div class="qv-size-header">
              <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Select Size</span>
              <button type="button" class="size-guide-link" onclick="openSizeGuide()">Size &amp; Fit Guide</button>
            </div>
            <div id="qv-size-buttons" class="qv-size-grid"></div>
            <p id="qv-stock-indicator" style="font-size:12px;font-weight:600;margin-top:8px;"></p>

            <button
              type="button"
              id="qv-add-btn"
              class="btn-card"
              style="margin-top:14px;padding:14px;"
              onclick="if(activeQuickViewProduct) addToBag(activeQuickViewProduct.id, selectedQuickViewSize)"
            >
              Add to Bag
            </button>

            <div class="qv-specs">
              <p><strong>Fit:</strong> <span id="qv-fit"></span></p>
              <p><strong>Fabric &amp; Care:</strong> <span id="qv-care"></span></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Streetwear Size & Fit Guide Modal -->
    <div id="msj-sizeguide-modal" class="modal-overlay" style="z-index:260;" onclick="if(event.target===this) closeSizeGuide()">
      <div class="modal-box">
        <button type="button" class="modal-close" onclick="closeSizeGuide()" aria-label="Close">&times;</button>
        <span class="section-kicker">Sizing Reference</span>
        <h3 style="font-size:22px;margin-bottom:8px;">Streetwear Size Chart (Inches)</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Measurements are taken flat across the garment. Size up one size if you prefer an oversized drape.</p>
        <table class="size-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Chest Width</th>
              <th>Body Length</th>
              <th>Sleeve Length</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>S</strong></td><td>19.5"</td><td>27.5"</td><td>8.5"</td></tr>
            <tr><td><strong>M</strong></td><td>21.0"</td><td>28.5"</td><td>9.0"</td></tr>
            <tr><td><strong>L</strong></td><td>22.5"</td><td>29.5"</td><td>9.5"</td></tr>
            <tr><td><strong>XL</strong></td><td>24.0"</td><td>30.5"</td><td>10.0"</td></tr>
            <tr><td><strong>2XL</strong></td><td>25.5"</td><td>31.5"</td><td>10.5"</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Slide-Out Shopping Bag Drawer -->
    <div id="msj-cart-drawer" class="drawer-overlay" onclick="if(event.target===this) closeCartDrawer()">
      <div class="drawer-panel">
        <div class="drawer-header">
          <div>
            <h3>Your Bag (<span class="js-bag-count">0</span>)</h3>
          </div>
          <button type="button" class="modal-close" style="position:static;" onclick="closeCartDrawer()" aria-label="Close Bag">&times;</button>
        </div>

        <div class="shipping-meter">
          <p id="msj-shipping-text">Add <strong>$100</strong> to unlock <strong>FREE Standard Shipping</strong>.</p>
          <div class="shipping-track">
            <div id="msj-shipping-fill" class="shipping-fill" style="width:0%;"></div>
          </div>
        </div>

        <div id="msj-bag-items" class="drawer-body"></div>

        <div id="msj-bag-checkout-area" class="drawer-footer">
          <p id="msj-bag-account-note" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;"></p>

          <!-- Promo Code Bar -->
          <div style="display:flex;gap:8px;margin-bottom:6px;">
            <input type="text" id="bag-promo-input" placeholder="Promo Code (e.g., MSJ10)" style="margin:0;padding:8px 10px;font-size:13px;text-transform:uppercase;">
            <button type="button" class="filter-btn" onclick="applyPromoCode()" style="white-space:nowrap;">Apply</button>
          </div>
          <p id="bag-promo-msg" style="font-size:12px;margin-bottom:8px;"></p>

          <div class="bag-subtotal-row" style="margin-bottom:4px;font-size:13px;">
            <span>Subtotal</span>
            <span id="msj-bag-subtotal">$0.00</span>
          </div>
          <div id="msj-bag-discount-row" class="bag-subtotal-row" style="display:none;margin-bottom:4px;font-size:13px;color:#10b981;">
            <span>Promo Discount</span>
            <span id="msj-bag-discount">-$0.00</span>
          </div>
          <div class="bag-subtotal-row" style="margin-bottom:6px;font-size:13px;">
            <span>Shipping</span>
            <span id="msj-bag-shipping-cost">$0.00</span>
          </div>
          <div class="bag-subtotal-row" style="border-top:1px solid var(--border,#e4e4e7);padding-top:8px;">
            <span>Total</span>
            <strong id="msj-bag-total">$0.00</strong>
          </div>

          <button type="button" id="msj-stripe-btn" class="btn-card" style="background:#635bff;margin-bottom:8px;" onclick="processStripeCheckout()">
            Pay Now with Card / Apple Pay
          </button>

          <form id="msj-bag-checkout-form" onsubmit="submitDirectOrderToDatabase(event)">
            <input type="text" id="bag-cust-name" name="customer_name" placeholder="Full Name" required>
            <input type="email" id="bag-cust-email" name="customer_email" placeholder="Email Address (for order tracking &amp; receipt)" required>
            <input type="text" id="bag-cust-phone" name="customer_phone" placeholder="Phone Number (optional — for delivery updates)">
            <input type="text" id="bag-cust-address" name="shipping_address" placeholder="Street Address, Apt/Suite, City, State &amp; Zip" required>
            <input type="text" id="bag-cust-notes" name="delivery_notes" placeholder="Delivery Instructions (optional — porch, gate, etc.)">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="bag-save-profile-check" style="width:auto;">
              <span>Save this contact &amp; shipping info to my account for future orders</span>
            </label>
            <button type="submit" id="msj-direct-order-btn" class="filter-btn" style="width:100%;padding:11px;">Complete Order Request (Reserve Stock)</button>
            <p id="msj-bag-status" class="modal-status"></p>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);
}

function checkPostCheckoutBanner() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "success") {
    msjCart = [];
    appliedPromo = null;
    saveCart();
    const orderNum = params.get("order") || "";
    const banner = document.createElement("div");
    banner.style.cssText = "background:#10b981;color:#fff;text-align:center;padding:12px 16px;font-size:14px;font-weight:600;";
    banner.innerHTML = `Payment received! Your order ${orderNum ? `(#${orderNum})` : ""} is confirmed and queued for packing.`;
    document.body.prepend(banner);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openHeaderSearchModal();
  }
});

window.addEventListener("pageshow", () => {
  loadCurrentUser();
  loadCart();
});

document.addEventListener("DOMContentLoaded", () => {
  injectNavAndFooterLinks();
  injectStorefrontOverlays();
  loadCurrentUser();
  loadCart();
  checkPostCheckoutBanner();
  syncProductsFromSupabase();
});