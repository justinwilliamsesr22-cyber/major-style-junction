// ============================================================
// MAJOR STYLE JUNCTION — CENTRAL INVENTORY FILE
// To add a new item: copy one { ... } block, paste it at the
// top of MSJ_PRODUCTS, update the details, and push to GitHub.
// ============================================================

const MSJ_PRODUCTS = [
  {
    id: "msj-001",
    name: "MSJ Signature Heavyweight Tee",
    category: "tees", // Options: "tees", "hoodies", "accessories"
    price: 38,
    status: "In Stock", // Options: "In Stock", "Low Stock", "Coming Soon", "Sold Out"
    badge: "Drop 01",
    image: "img/logo2tran.png", // Replace with your product photo path, e.g. "img/tee-black.jpg"
    sizes: ["S", "M", "L", "XL", "2XL"],
    description: "Heavyweight 100% combed cotton blank featuring high-definition direct-to-film chest artwork."
  },
  {
    id: "msj-002",
    name: "Junction Streetwear Pullover Hoodie",
    category: "hoodies",
    price: 68,
    status: "Coming Soon",
    badge: "Limited Run",
    image: "img/7tran.png",
    sizes: ["S", "M", "L", "XL", "2XL"],
    description: "14oz heavyweight fleece hoodie built for structured drape and everyday durability."
  },
  {
    id: "msj-003",
    name: "Bold Statement Graphic Tee",
    category: "tees",
    price: 38,
    status: "Coming Soon",
    badge: "Drop 01",
    image: "img/logo2tran.png",
    sizes: ["S", "M", "L", "XL", "2XL"],
    description: "Vibrant full-color DTF graphic print pressed in-house with soft-hand finish."
  }
];

// ============================================================
// STOREFRONT RENDER ENGINE (No need to edit below this line)
// ============================================================

function renderProducts(containerId, filterCategory = "all", limit = null) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  let items = filterCategory === "all"
    ? MSJ_PRODUCTS
    : MSJ_PRODUCTS.filter((item) => item.category === filterCategory);

  if (limit) {
    items = items.slice(0, limit);
  }

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-state">No pieces currently listed in this category. Check back for the next drop.</p>`;
    return;
  }

  grid.innerHTML = items.map((item) => {
    const isSoldOut = item.status.toLowerCase() === "sold out";
    const statusClass = isSoldOut
      ? "status-soldout"
      : item.status.toLowerCase() === "in stock"
      ? "status-instock"
      : "status-soon";

    const btnLabel = isSoldOut
      ? "Sold Out"
      : item.status.toLowerCase() === "coming soon"
      ? "Reserve / Notify Me"
      : "Order / Select Size";

    return `
      <article class="product-card">
        <div class="product-media">
          <span class="product-badge">${item.badge}</span>
          <span class="product-status ${statusClass}">${item.status}</span>
          <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.src='img/logo2tran.png'">
        </div>
        <div class="product-info">
          <div class="product-header">
            <h3>${item.name}</h3>
            <span class="product-price">$${item.price}</span>
          </div>
          <p class="product-desc">${item.description}</p>
          <div class="size-pills">
            ${item.sizes.map((s) => `<span>${s}</span>`).join("")}
          </div>
          <button
            type="button"
            class="btn-card ${isSoldOut ? "btn-disabled" : ""}"
            ${isSoldOut ? "disabled" : `onclick="openOrderModal('${item.id}')"`}
          >
            ${btnLabel}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function openOrderModal(productId) {
  const item = MSJ_PRODUCTS.find((p) => p.id === productId);
  const modal = document.getElementById("order-modal");
  if (!item || !modal) return;

  document.getElementById("modal-item-name").textContent = item.name;
  document.getElementById("modal-item-price").textContent = `$${item.price} • ${item.status}`;
  document.getElementById("modal-hidden-product").value = `${item.name} ($${item.price} - ${item.status})`;

  const sizeSelect = document.getElementById("modal-size-select");
  sizeSelect.innerHTML = item.sizes.map((s) => `<option value="${s}">Size: ${s}</option>`).join("");

  document.getElementById("modal-form-status").textContent = "";
  modal.classList.add("active");
}

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) modal.classList.remove("active");
}

document.addEventListener("DOMContentLoaded", () => {
  const modalForm = document.getElementById("modal-order-form");
  if (modalForm) {
    modalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById("modal-form-status");
      const submitBtn = modalForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending Request...";

      try {
        const res = await fetch("https://formspree.io/f/myeypbka", {
          method: "POST",
          body: new FormData(modalForm),
          headers: { Accept: "application/json" }
        });
        if (res.ok) {
          statusEl.style.color = "#10b981";
          statusEl.textContent = "Request received! We will confirm your order and payment link shortly.";
          modalForm.reset();
        } else {
          statusEl.style.color = "#ef4444";
          statusEl.textContent = "Submission error. Please email MajorStyleJunction@MajorStyleJunction.com.";
        }
      } catch {
        statusEl.style.color = "#ef4444";
        statusEl.textContent = "Network error. Please try again.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Order Request";
      }
    });
  }
});