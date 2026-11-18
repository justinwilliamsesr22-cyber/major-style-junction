// ============================================================
// MAJOR STYLE JUNCTION — CENTRAL INVENTORY & STORE ENGINE
// To add or edit items: update MSJ_PRODUCTS below and push.
// Use image: "typographic" for the Space Grotesk MSJ logo card,
// or replace with a photo path like "img/hoodie-black.jpg".
// ============================================================

const MSJ_CONFIG = {
  freeShippingThreshold: 100,
  formspreeOrderEndpoint: "https://formspree.io/f/myeypbka",
  supportEmail: "MajorStyleJunction@MajorStyleJunction.com"
};

const MSJ_PRODUCTS = [
  {
    id: "msj-001",
    name: "MSJ Signature Heavyweight Tee",
    category: "tees", // Options: "tees", "hoodies", "accessories"
    price: 38,
    status: "In Stock", // Options: "In Stock", "Low Stock", "Coming Soon", "Sold Out"
    badge: "Drop 01",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    fit: "Boxy streetwear fit — true to size with slightly dropped shoulders.",
    care: "100% combed ring-spun cotton (6.5 oz). Machine wash cold inside-out; hang dry to preserve DTF artwork.",
    description: "Heavyweight 100% combed cotton blank featuring high-definition direct-to-film chest artwork."
  },
  {
    id: "msj-002",
    name: "Junction Streetwear Pullover Hoodie",
    category: "hoodies",
    price: 68,
    status: "Coming Soon",
    badge: "Limited Run",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    fit: "Relaxed heavyweight silhouette — size up for an oversized look.",
    care: "14oz preshrunk cotton fleece. Double-lined hood, no drawcords. Wash cold inside-out.",
    description: "14oz heavyweight fleece hoodie built for structured drape and everyday durability."
  },
  {
    id: "msj-003",
    name: "Bold Statement Graphic Tee",
    category: "tees",
    price: 38,
    status: "Coming Soon",
    badge: "Drop 01",
    image: "typographic",
    sizes: ["S", "M", "L", "XL", "2XL"],
    fit: "Standard streetwear cut — pre-shrunk for consistent sizing.",
    care: "100% ring-spun cotton. Soft-hand full-color DTF graphic print. Do not iron directly over graphic.",
    description: "Vibrant full-color DTF graphic print pressed in-house with soft-hand finish."
  }
];

// ============================================================
// SHOPPING BAG STATE (Persists in browser localStorage)
// ============================================================

const CART_STORAGE_KEY = "msj_shopping_bag_v1";
let msjCart = [];
let activeQuickViewProduct = null;
let selectedQuickViewSize = "L";

function renderTypographicGraphic(subLabel = "MAJOR STYLE JUNCTION") {
  return `
    <div class="emblem-lockup">
      <div class="emblem-box">MSJ</div>
      <span class="emblem-sub">${subLabel}</span>
    </div>
  `;
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
  } catch {
    // Ignore storage quota errors
  }
  updateCartUI();
}

function addToBag(productId, size) {
  const product = MSJ_PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const chosenSize = size || product.sizes[0] || "OS";
  const existingIndex = msjCart.findIndex(
    (entry) => entry.id === productId && entry.size === chosenSize
  );

  if (existingIndex > -1) {
    msjCart[existingIndex].qty += 1;
  } else {
    msjCart.push({
      id: product.id,
      name: product.name,
      price: product.price,
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
  if (!msjCart[index]) return;
  msjCart[index].qty += delta;
  if (msjCart[index].qty <= 0) {
    msjCart.splice(index, 1);
  }
  saveCart();
}

function removeBagItem(index) {
  msjCart.splice(index, 1);
  saveCart();
}

function updateCartUI() {
  const totalCount = msjCart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = msjCart.reduce((sum, item) => sum + item.price * item.qty, 0);

  document.querySelectorAll(".js-bag-count").forEach((el) => {
    el.textContent = totalCount;
  });

  const itemsContainer = document.getElementById("msj-bag-items");
  const subtotalEl = document.getElementById("msj-bag-subtotal");
  const shippingTextEl = document.getElementById("msj-shipping-text");
  const shippingFillEl = document.getElementById("msj-shipping-fill");
  const checkoutSection = document.getElementById("msj-bag-checkout-area");

  if (!itemsContainer) return;

  const threshold = MSJ_CONFIG.freeShippingThreshold;
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  if (shippingFillEl) shippingFillEl.style.width = `${pct}%`;

  if (shippingTextEl) {
    if (subtotal === 0) {
      shippingTextEl.innerHTML = `Add <strong>$${threshold}</strong> to unlock <strong>FREE Standard Shipping</strong>.`;
    } else if (subtotal < threshold) {
      const remaining = threshold - subtotal;
      shippingTextEl.innerHTML = `You're <strong>$${remaining.toFixed(2)}</strong> away from <strong>FREE Shipping!</strong>`;
    } else {
      shippingTextEl.innerHTML = `Unlocked: <strong>FREE Standard Shipping</strong> applied to your order.`;
    }
  }

  if (subtotalEl) {
    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  }

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
      const thumbMarkup =
        !item.image || item.image === "typographic"
          ? `<div class="bag-typo-thumb">MSJ</div>`
          : `<img src="${item.image}" alt="${item.name}">`;

      return `
        <div class="bag-item">
          ${thumbMarkup}
          <div class="bag-item-details">
            <div class="bag-item-top">
              <h4>${item.name}</h4>
              <button type="button" class="bag-remove" onclick="removeBagItem(${idx})" aria-label="Remove item">&times;</button>
            </div>
            <p class="bag-item-meta">Size: <strong>${item.size}</strong> • $${item.price} each</p>
            <div class="bag-item-controls">
              <div class="qty-box">
                <button type="button" onclick="updateBagQty(${idx}, -1)" aria-label="Decrease quantity">-</button>
                <span>${item.qty}</span>
                <button type="button" onclick="updateBagQty(${idx}, 1)" aria-label="Increase quantity">+</button>
              </div>
              <span class="bag-item-total">$${(item.price * item.qty).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function openCartDrawer() {
  const drawer = document.getElementById("msj-cart-drawer");
  if (drawer) drawer.classList.add("active");
}

function closeCartDrawer() {
  const drawer = document.getElementById("msj-cart-drawer");
  if (drawer) drawer.classList.remove("active");
}

// ============================================================
// PRODUCT GRID, FILTER & SORT ENGINE
// ============================================================

function renderProducts(containerId, options = {}) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  const {
    category = "all",
    search = "",
    sort = "featured",
    limit = null
  } = options;

  let items = [...MSJ_PRODUCTS];

  if (category !== "all") {
    items = items.filter((item) => item.category === category);
  }

  if (search.trim() !== "") {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }

  if (sort === "price-asc") {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === "price-desc") {
    items.sort((a, b) => b.price - a.price);
  } else if (sort === "instock") {
    items = items.filter((item) => item.status.toLowerCase() === "in stock");
  }

  if (limit) {
    items = items.slice(0, limit);
  }

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-state">No pieces match your current filter. Try clearing your search or checking all categories.</p>`;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const isSoldOut = item.status.toLowerCase() === "sold out";
      const statusClass = isSoldOut
        ? "status-soldout"
        : item.status.toLowerCase() === "in stock"
        ? "status-instock"
        : "status-soon";

      const btnLabel = isSoldOut
        ? "Sold Out"
        : item.status.toLowerCase() === "coming soon"
        ? "Quick View & Reserve"
        : "Select Size & Add to Bag";

      const mediaContent =
        !item.image || item.image === "typographic"
          ? renderTypographicGraphic(item.badge)
          : `<img src="${item.image}" alt="${item.name}" loading="lazy">`;

      return `
        <article class="product-card">
          <div class="product-media" onclick="openQuickView('${item.id}')" style="cursor:pointer;">
            <span class="product-badge">${item.badge}</span>
            <span class="product-status ${statusClass}">${item.status}</span>
            ${mediaContent}
            <span class="quickview-hint">Quick View</span>
          </div>
          <div class="product-info">
            <div class="product-header">
              <h3 onclick="openQuickView('${item.id}')" style="cursor:pointer;">${item.name}</h3>
              <span class="product-price">$${item.price}</span>
            </div>
            <p class="product-desc">${item.description}</p>
            <div class="size-pills">
              ${item.sizes.map((s) => `<span>${s}</span>`).join("")}
            </div>
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
}

// ============================================================
// QUICK-VIEW & SIZE GUIDE MODALS
// ============================================================

function openQuickView(productId) {
  const item = MSJ_PRODUCTS.find((p) => p.id === productId);
  const modal = document.getElementById("msj-quickview-modal");
  if (!item || !modal) return;

  activeQuickViewProduct = item;
  selectedQuickViewSize = item.sizes.includes("L") ? "L" : item.sizes[0];

  const qvMedia = document.getElementById("qv-media-box");
  if (qvMedia) {
    qvMedia.innerHTML =
      !item.image || item.image === "typographic"
        ? renderTypographicGraphic(item.badge)
        : `<img src="${item.image}" alt="${item.name}">`;
  }

  document.getElementById("qv-badge").textContent = `${item.badge} • ${item.status}`;
  document.getElementById("qv-title").textContent = item.name;
  document.getElementById("qv-price").textContent = `$${item.price}.00`;
  document.getElementById("qv-desc").textContent = item.description;
  document.getElementById("qv-fit").textContent = item.fit || "True to streetwear sizing.";
  document.getElementById("qv-care").textContent = item.care || "Machine wash cold inside-out.";

  renderQuickViewSizes();

  const addBtn = document.getElementById("qv-add-btn");
  const isSoldOut = item.status.toLowerCase() === "sold out";
  addBtn.disabled = isSoldOut;
  addBtn.textContent = isSoldOut
    ? "Sold Out"
    : item.status.toLowerCase() === "coming soon"
    ? `Add Drop Reservation to Bag — $${item.price}`
    : `Add to Bag — $${item.price}`;

  modal.classList.add("active");
}

function renderQuickViewSizes() {
  const container = document.getElementById("qv-size-buttons");
  if (!container || !activeQuickViewProduct) return;

  container.innerHTML = activeQuickViewProduct.sizes
    .map(
      (sz) => `
      <button
        type="button"
        class="qv-size-btn ${sz === selectedQuickViewSize ? "selected" : ""}"
        onclick="selectQuickViewSize('${sz}')"
      >
        ${sz}
      </button>
    `
    )
    .join("");
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
// AUTO-INJECT STOREFRONT MODALS & SLIDE-OUT BAG ON EVERY PAGE
// ============================================================

function injectStorefrontOverlays() {
  if (document.getElementById("msj-cart-drawer")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
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

            <button
              type="button"
              id="qv-add-btn"
              class="btn-card"
              style="margin-top:18px;padding:14px;"
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
          <div class="bag-subtotal-row">
            <span>Estimated Subtotal</span>
            <strong id="msj-bag-subtotal">$0.00</strong>
          </div>
          <form id="msj-bag-checkout-form">
            <input type="text" name="customer_name" placeholder="Full Name" required>
            <input type="email" name="customer_email" placeholder="Email Address (for invoice & tracking)" required>
            <input type="text" name="shipping_address" placeholder="Shipping City, State & Zip Code" required>
            <button type="submit" class="btn-card">Complete Order Request</button>
            <p id="msj-bag-status" class="modal-status"></p>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  const checkoutForm = document.getElementById("msj-bag-checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById("msj-bag-status");
      const btn = checkoutForm.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.textContent = "Submitting Order...";

      const subtotal = msjCart.reduce((sum, item) => sum + item.price * item.qty, 0);
      const orderSummary = msjCart
        .map((i) => `${i.qty}x ${i.name} [Size: ${i.size}] ($${i.price * i.qty})`)
        .join(" | ");

      const payload = new FormData(checkoutForm);
      payload.append("order_items", orderSummary);
      payload.append("order_subtotal", `$${subtotal.toFixed(2)}`);
      payload.append(
        "shipping_tier",
        subtotal >= MSJ_CONFIG.freeShippingThreshold ? "FREE Shipping Unlocked ($100+)" : "Standard Shipping"
      );

      try {
        const res = await fetch(MSJ_CONFIG.formspreeOrderEndpoint, {
          method: "POST",
          body: payload,
          headers: { Accept: "application/json" }
        });

        if (res.ok) {
          statusEl.style.color = "#10b981";
          statusEl.textContent = "Order request received! Check your email for confirmation and payment link.";
          msjCart = [];
          saveCart();
          checkoutForm.reset();
        } else {
          statusEl.style.color = "#ef4444";
          statusEl.textContent = `Could not submit automatically. Email ${MSJ_CONFIG.supportEmail}.`;
        }
      } catch {
        statusEl.style.color = "#ef4444";
        statusEl.textContent = "Network error. Please try again.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Complete Order Request";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  injectStorefrontOverlays();
  loadCart();
});