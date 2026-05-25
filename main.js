/* ============ Westlake Coffee — hydration & interactions ============ */

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
