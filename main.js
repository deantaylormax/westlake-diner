/* ============ Westlake Coffee — hydration & interactions ============ */

// SYNCHRONOUS: intercept Order Pickup clicks immediately so the tel: fallback
// never fires while we're waiting for content.json to load.
// The flag is flipped to false later if pickup_url is a real http URL.
let __pickupModalEnabled = true;
document.addEventListener("click", (e) => {
  if (!__pickupModalEnabled) return;
  const a = e.target.closest('a[data-bind-attr*="pickup_url"]');
  if (!a) return;
  e.preventDefault();
  const modal = document.getElementById("pickup-modal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  // Tell the async loader to finish rendering the modal contents (idempotent).
  if (typeof window.__renderPickupModal === "function") window.__renderPickupModal();
});

(async function () {
  const content = await fetch("content.json", { cache: "no-store" }).then(r => r.json());

  // ---- Generic data bindings: data-bind="dot.path" ----
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const path = el.getAttribute("data-bind");
    const value = path.split(".").reduce((o, k) => (o == null ? null : o[k]), content);
    if (value != null) el.textContent = value;
  });

  // ---- Attribute bindings: data-bind-attr="href:path;prefix:tel:" ----
  document.querySelectorAll("[data-bind-attr]").forEach((el) => {
    const spec = el.getAttribute("data-bind-attr");
    const parts = Object.fromEntries(spec.split(";").map(p => {
      const [k, ...v] = p.split(":");
      return [k.trim(), v.join(":").trim()];
    }));
    if (parts.href) {
      const value = parts.href.split(".").reduce((o, k) => (o == null ? null : o[k]), content);
      if (value != null) el.setAttribute("href", (parts.prefix || "") + value);
    }
  });

  // ---- Hero crossfade ----
  const heroPhoto = document.getElementById("hero-photo");
  if (heroPhoto && content.hero_photos?.length) {
    content.hero_photos.forEach((src, i) => {
      const f = document.createElement("div");
      f.className = "frame" + (i === 0 ? " active" : "");
      f.style.backgroundImage = `url("${src}")`;
      heroPhoto.prepend(f);
    });
    let idx = 0;
    setInterval(() => {
      const frames = heroPhoto.querySelectorAll(".frame");
      frames[idx].classList.remove("active");
      idx = (idx + 1) % frames.length;
      frames[idx].classList.add("active");
    }, 4500);
  }

  // ---- Open-now indicator ----
  const openEl = document.getElementById("open-now");
  if (openEl && content.hours_machine) {
    const now = new Date();
    const today = content.hours_machine.find(h => h.day === now.getDay());
    const cur = now.getHours() * 60 + now.getMinutes();
    const inWindow = (open, close) => {
      const [oH, oM] = open.split(":").map(Number);
      const [cH, cM] = close.split(":").map(Number);
      return cur >= oH * 60 + oM && cur < cH * 60 + cM;
    };
    let open = false, closesAt = null;
    if (today) {
      if (inWindow(today.open, today.close)) { open = true; closesAt = today.close; }
      else if (today.open2 && today.close2 && inWindow(today.open2, today.close2)) {
        open = true; closesAt = today.close2;
      }
    }
    const text = openEl.querySelector(".text");
    if (open) {
      const [h, m] = closesAt.split(":").map(Number);
      const t = (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h >= 12 ? " pm" : " am");
      text.textContent = `Open now · until ${t}`;
    } else {
      openEl.classList.add("closed");
      text.textContent = "Closed right now — come see us soon";
    }
  }

  // ---- What we serve cards ----
  const serveGrid = document.getElementById("serve-grid");
  if (serveGrid && content.what_we_serve) {
    serveGrid.innerHTML = content.what_we_serve.map(card => `
      <article class="serve-card reveal">
        <div class="card-photo" style="background-image:url('${card.image}')"></div>
        <div class="card-body">
          <span class="card-hours">${card.hours}</span>
          <h3>${card.title}</h3>
          <p>${card.blurb}</p>
        </div>
      </article>
    `).join("");
  }

  // ---- Family story photo ----
  const storyPhoto = document.getElementById("story-photo");
  if (storyPhoto && content.family_story?.image) {
    storyPhoto.style.backgroundImage = `url('${content.family_story.image}')`;
  }

  // ---- Menu tabs ----
  const tabsEl = document.getElementById("menu-tabs");
  const panelsEl = document.getElementById("menu-panels");
  if (tabsEl && panelsEl && content.menu?.categories) {
    content.menu.categories.forEach((cat, i) => {
      const tab = document.createElement("button");
      tab.className = "menu-tab" + (i === 0 ? " active" : "");
      tab.textContent = cat.name;
      tab.dataset.idx = i;
      tabsEl.appendChild(tab);

      const panel = document.createElement("div");
      panel.className = "menu-panel" + (i === 0 ? " active" : "");
      panel.dataset.idx = i;
      panel.innerHTML = `<div class="menu-grid">` + cat.items.map(it => `
        <div class="menu-item">
          <div>
            <h4>${it.name}</h4>
            <p class="desc">${it.desc}</p>
          </div>
          <div class="price">$${it.price}</div>
        </div>
      `).join("") + `</div>`;
      panelsEl.appendChild(panel);
    });

    tabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".menu-tab");
      if (!btn) return;
      tabsEl.querySelectorAll(".menu-tab").forEach(b => b.classList.toggle("active", b === btn));
      panelsEl.querySelectorAll(".menu-panel").forEach(p => p.classList.toggle("active", p.dataset.idx === btn.dataset.idx));
    });
  }

  // ---- Hours list ----
  const hoursList = document.getElementById("hours-list");
  if (hoursList && content.hours) {
    hoursList.innerHTML = content.hours.map(h => `
      <li><span>${h.days}</span><span>${h.times}</span></li>
    `).join("");
  }

  // ---- Delivery row ----
  const deliveryRow = document.getElementById("delivery-row");
  if (deliveryRow && content.delivery) {
    deliveryRow.innerHTML = content.delivery.map(d => `
      <a href="${d.url}" target="_blank" rel="noopener" class="delivery-pill">${d.name}</a>
    `).join("");
  }

  // ---- Map embed ----
  const mapEl = document.getElementById("visit-map");
  if (mapEl && content.business?.map_embed_url) {
    mapEl.src = content.business.map_embed_url;
  }

  // ---- Year ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Reveal-on-scroll ----
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

  // ---- Pickup demo modal ----
  // Curated "featured" subset of the menu for the demo cart UI
  const featuredItems = [
    { section: "Most ordered", name: "Westlake Special", desc: "Two poached eggs, bagel with cream cheese, avocado, fruit.", price: 17 },
    { section: "Most ordered", name: "Huevos Rancheros", desc: "Eggs, ranchero sauce, avocado, feta, beans, tortilla.", price: 16 },
    { section: "Most ordered", name: "Cheeseburger", desc: "Classic with your choice of cheese, fries included.", price: 14 },
    { section: "Most ordered", name: "Short Stack Pancakes", desc: "Three buttermilk pancakes, butter, syrup.", price: 14 },
    { section: "Breakfast", name: "Bacon and Eggs", desc: "Hash browns or home potatoes, choice of bread.", price: 17.55 },
    { section: "Breakfast", name: "Eggs Benedict", desc: "Poached eggs, Canadian bacon, hollandaise.", price: 18 },
    { section: "Breakfast", name: "Denver Omelette", desc: "Onion, bell peppers, ham.", price: 17 },
    { section: "Lunch", name: "Patty Melt", desc: "Hamburger patty, grilled onions, American cheese on rye.", price: 16 },
    { section: "Lunch", name: "Philly Cheesesteak", desc: "Onions, peppers, mushrooms, cheese on French roll.", price: 17 },
    { section: "Lunch", name: "Club Sandwich", desc: "Bacon, turkey, tomato, lettuce, mayo, honey mustard.", price: 16 },
    { section: "Drinks", name: "Latte", desc: "Hot or iced.", price: 5 },
    { section: "Drinks", name: "Fresh Squeezed O.J.", desc: "", price: 7.5 }
  ];

  const modal = document.getElementById("pickup-modal");
  const menuList = document.getElementById("pickup-menu-list");
  const cartList = document.getElementById("pickup-cart-list");
  const subEl = document.getElementById("pickup-subtotal");
  const taxEl = document.getElementById("pickup-tax");
  const totEl = document.getElementById("pickup-total");
  const checkoutBtn = document.getElementById("pickup-checkout");
  const cart = new Map(); // name -> {item, qty}

  function renderMenu() {
    let html = "";
    let lastSection = null;
    featuredItems.forEach((it, i) => {
      if (it.section !== lastSection) {
        html += `<div class="pickup-menu-section">${it.section}</div>`;
        lastSection = it.section;
      }
      html += `
        <div class="pickup-menu-item">
          <div class="pickup-menu-item-info">
            <p class="pickup-menu-item-name">${it.name}</p>
            ${it.desc ? `<p class="pickup-menu-item-desc">${it.desc}</p>` : ""}
          </div>
          <div class="pickup-menu-item-right">
            <span class="pickup-menu-item-price">$${it.price.toFixed(2)}</span>
            <button class="pickup-add-btn" data-idx="${i}" aria-label="Add ${it.name}">+</button>
          </div>
        </div>`;
    });
    menuList.innerHTML = html;
  }

  function renderCart() {
    if (cart.size === 0) {
      cartList.innerHTML = `<li class="pickup-cart-empty">Pick a few items to get started.</li>`;
      checkoutBtn.disabled = true;
    } else {
      cartList.innerHTML = "";
      cart.forEach((entry) => {
        const li = document.createElement("li");
        li.className = "pickup-cart-item";
        li.innerHTML = `
          <div class="pickup-cart-qty">
            <button data-act="dec" data-name="${entry.item.name}">−</button>
            <span>${entry.qty}</span>
            <button data-act="inc" data-name="${entry.item.name}">+</button>
          </div>
          <span class="pickup-cart-name">${entry.item.name}</span>
          <span class="pickup-cart-price">$${(entry.item.price * entry.qty).toFixed(2)}</span>
        `;
        cartList.appendChild(li);
      });
      checkoutBtn.disabled = false;
    }
    let subtotal = 0;
    cart.forEach((entry) => { subtotal += entry.item.price * entry.qty; });
    const tax = subtotal * 0.09875;
    subEl.textContent = `$${subtotal.toFixed(2)}`;
    taxEl.textContent = `$${tax.toFixed(2)}`;
    totEl.textContent = `$${(subtotal + tax).toFixed(2)}`;
  }

  function openModal() {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (!menuList.innerHTML) renderMenu();
    renderCart();
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    const confirm = modal.querySelector(".pickup-confirm");
    if (confirm) confirm.remove();
  }

  // Disable the synchronous modal intercept if pickup_url is a real http(s) URL —
  // in that case anchor's native navigation should run.
  const pickupUrl = (content.business && content.business.pickup_url) || "";
  __pickupModalEnabled = !/^https?:\/\//i.test(pickupUrl);

  // Expose modal rendering so the synchronous click handler at the top can call it.
  window.__renderPickupModal = () => {
    if (!menuList.innerHTML) renderMenu();
    renderCart();
  };

  // Modal interactions
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) closeModal();
      const addBtn = e.target.closest(".pickup-add-btn");
      if (addBtn) {
        const it = featuredItems[+addBtn.dataset.idx];
        const entry = cart.get(it.name) || { item: it, qty: 0 };
        entry.qty += 1;
        cart.set(it.name, entry);
        renderCart();
      }
      const qtyBtn = e.target.closest(".pickup-cart-qty button");
      if (qtyBtn) {
        const name = qtyBtn.dataset.name;
        const entry = cart.get(name);
        if (!entry) return;
        if (qtyBtn.dataset.act === "inc") entry.qty += 1;
        else entry.qty -= 1;
        if (entry.qty <= 0) cart.delete(name);
        else cart.set(name, entry);
        renderCart();
      }
      const pill = e.target.closest(".pickup-time-pill");
      if (pill) {
        modal.querySelectorAll(".pickup-time-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
      }
    });

    checkoutBtn.addEventListener("click", () => {
      let total = 0;
      cart.forEach((entry) => { total += entry.item.price * entry.qty; });
      total *= 1.09875;
      const itemCount = Array.from(cart.values()).reduce((a, b) => a + b.qty, 0);
      const confirm = document.createElement("div");
      confirm.className = "pickup-confirm show";
      confirm.innerHTML = `
        <div class="pickup-confirm-icon">✓</div>
        <h3>Demo complete</h3>
        <p>In the live Toast Online Ordering flow, the customer would now enter their phone number and pay by card, and the order would print on the kitchen ticket printer alongside the dine-in orders. <strong>${itemCount} ${itemCount === 1 ? "item" : "items"} · $${total.toFixed(2)}</strong></p>
        <button class="btn" data-close type="button">Close</button>
      `;
      modal.querySelector(".pickup-modal-panel").appendChild(confirm);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
  }

  // ---- Mobile nav ----
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open);
    });
    links.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.classList.remove("open");
      }
    });
  }
})();
