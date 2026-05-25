/* ============ Westlake Coffee — custom dashboard ============
 * Auth: Netlify Identity (JWT)
 * Storage: Git Gateway → commits to GitHub → Netlify auto-deploys
 * ============================================================ */

const REPO_PATH = "content.json";
const BRANCH = "main";
const GATEWAY = "/.netlify/git/github";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// --- DOM refs ---
const $ = (id) => document.getElementById(id);
const authGate = $("auth-gate");
const loading = $("loading");
const app = $("app");
const headerUser = $("header-user");
const toastEl = $("toast");

// --- App state ---
let identity = window.netlifyIdentity;
let currentJwt = null;
let content = null;       // parsed content.json
let fileSha = null;       // SHA returned by Git Gateway for optimistic concurrency
let originalPrices = {};  // categoryName -> { itemName: originalPrice } for dirty highlight

// ====================== Auth ======================
function showLoading() { authGate.hidden = true; app.hidden = true; loading.style.display = ""; }
function showGate() { loading.style.display = "none"; app.hidden = true; authGate.hidden = false; }
function showApp() { loading.style.display = "none"; authGate.hidden = true; app.hidden = false; }

identity.on("init", async (user) => {
  if (user) {
    await onLogin(user);
  } else {
    showGate();
  }
});
identity.on("login", async (user) => {
  identity.close();
  showLoading();
  await onLogin(user);
});
identity.on("logout", () => {
  currentJwt = null;
  content = null;
  showGate();
});
identity.on("error", (err) => {
  console.error("Identity error", err);
  showToast("Sign-in failed. Try again.", "error");
  showGate();
});

$("auth-signin").addEventListener("click", () => identity.open("login"));
$("auth-signout").addEventListener("click", () => identity.logout());

async function onLogin(user) {
  try {
    currentJwt = await user.jwt();
    headerUser.textContent = user.email;
    await loadContent();
    showApp();
  } catch (err) {
    console.error(err);
    showToast("Couldn't load content. " + err.message, "error");
    showGate();
  }
}

// ====================== Git Gateway helpers ======================
async function gatewayGet() {
  const url = `${GATEWAY}/contents/${REPO_PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${currentJwt}` }
  });
  if (!res.ok) throw new Error(`GET ${REPO_PATH}: HTTP ${res.status}`);
  return res.json();   // { content (base64), sha, ... }
}

async function gatewayPut(newJsonText, message) {
  const url = `${GATEWAY}/contents/${REPO_PATH}`;
  // UTF-8 safe base64
  const utf8 = new TextEncoder().encode(newJsonText);
  let bin = "";
  for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i]);
  const b64 = btoa(bin);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${currentJwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content: b64,
      sha: fileSha,
      branch: BRANCH
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT ${REPO_PATH}: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  fileSha = json.content.sha;   // refresh sha for next save
  return json;
}

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function loadContent() {
  const file = await gatewayGet();
  fileSha = file.sha;
  content = JSON.parse(b64ToUtf8(file.content));
  renderAll();
}

// ====================== Rendering ======================
function renderAll() {
  renderSpecial();
  renderHours();
  renderCategoryPicker();
  renderPrices();
}

function renderSpecial() {
  $("field-special").value = content.todays_special || "";
}

function renderHours() {
  const grid = $("field-hours");
  grid.innerHTML = "";
  // Reorder so Mon comes first (more intuitive than Sun)
  const order = [1, 2, 3, 4, 5, 6, 0];
  order.forEach((dayIdx) => {
    const entry = content.hours_machine.find(h => h.day === dayIdx);
    if (!entry) return;
    const hasSecond = entry.open2 && entry.close2;
    const row = document.createElement("div");
    row.className = "hours-row";
    row.dataset.day = dayIdx;
    row.innerHTML = `
      <div class="day-label">${DAY_NAMES[dayIdx]}</div>
      <div class="hours-fields">
        <input type="time" class="hours-time" data-field="open" value="${entry.open}">
        <span class="hours-sep">to</span>
        <input type="time" class="hours-time" data-field="close" value="${entry.close}">
        ${hasSecond ? `
          <div class="hours-second">
            <input type="time" class="hours-time" data-field="open2" value="${entry.open2}">
            <span class="hours-sep">to</span>
            <input type="time" class="hours-time" data-field="close2" value="${entry.close2}">
            <button class="hours-remove-second" type="button" aria-label="Remove second window">×</button>
          </div>` : `
          <button class="hours-add-second" type="button">+ second window</button>
        `}
      </div>
    `;
    grid.appendChild(row);
  });

  grid.addEventListener("click", onHoursClick);
}

function onHoursClick(e) {
  const addBtn = e.target.closest(".hours-add-second");
  const rmBtn = e.target.closest(".hours-remove-second");
  if (addBtn) {
    const fields = addBtn.parentElement;
    addBtn.remove();
    const div = document.createElement("div");
    div.className = "hours-second";
    div.innerHTML = `
      <input type="time" class="hours-time" data-field="open2" value="16:00">
      <span class="hours-sep">to</span>
      <input type="time" class="hours-time" data-field="close2" value="20:00">
      <button class="hours-remove-second" type="button" aria-label="Remove second window">×</button>
    `;
    fields.appendChild(div);
  }
  if (rmBtn) {
    const secondDiv = rmBtn.parentElement;
    const fields = secondDiv.parentElement;
    secondDiv.remove();
    const add = document.createElement("button");
    add.className = "hours-add-second";
    add.type = "button";
    add.textContent = "+ second window";
    fields.appendChild(add);
  }
}

function renderCategoryPicker() {
  const sel = $("field-category");
  sel.innerHTML = content.menu.categories.map(
    (c, i) => `<option value="${i}">${c.name} (${c.items.length} items)</option>`
  ).join("");
  sel.addEventListener("change", renderPrices);
}

function renderPrices() {
  const sel = $("field-category");
  const cat = content.menu.categories[+sel.value];
  const table = $("field-prices");
  originalPrices[cat.name] = {};
  table.innerHTML = cat.items.map((it, i) => {
    originalPrices[cat.name][it.name] = it.price;
    return `
      <div class="price-row">
        <div class="price-item-name">${escapeHtml(it.name)}</div>
        <div class="price-input-wrap">
          <input class="price-input" data-idx="${i}" type="text" inputmode="decimal" value="${escapeHtml(it.price)}">
        </div>
      </div>
    `;
  }).join("");

  // Mark dirty inputs as user edits
  table.addEventListener("input", (e) => {
    const inp = e.target.closest(".price-input");
    if (!inp) return;
    const idx = +inp.dataset.idx;
    const item = cat.items[idx];
    if (inp.value.trim() !== originalPrices[cat.name][item.name]) {
      inp.classList.add("dirty");
    } else {
      inp.classList.remove("dirty");
    }
  });
}

// ====================== Saving ======================
document.querySelectorAll("[data-save]").forEach((btn) => {
  btn.addEventListener("click", () => save(btn.dataset.save, btn));
});

async function save(card, btn) {
  setStatus(card, "saving", "Saving…");
  btn.disabled = true;
  try {
    let message = "";
    if (card === "special") {
      content.todays_special = $("field-special").value.trim();
      message = "Update today's special";
    } else if (card === "hours") {
      content.hours_machine = collectHours();
      message = "Update hours";
    } else if (card === "prices") {
      const sel = $("field-category");
      const cat = content.menu.categories[+sel.value];
      cat.items.forEach((it, i) => {
        const inp = document.querySelector(`.price-input[data-idx="${i}"]`);
        if (inp) it.price = inp.value.trim();
      });
      message = `Update ${cat.name} prices`;
    }

    const newJson = JSON.stringify(content, null, 2) + "\n";
    await gatewayPut(newJson, message);
    setStatus(card, "saved", "Saved · live in ~30s");
    showToast("Saved! Site updates in about 30 seconds.", "success");

    // Reset dirty highlights after a successful save
    if (card === "prices") {
      document.querySelectorAll(".price-input.dirty").forEach(el => el.classList.remove("dirty"));
      const cat = content.menu.categories[+$("field-category").value];
      cat.items.forEach((it) => { originalPrices[cat.name][it.name] = it.price; });
    }
  } catch (err) {
    console.error(err);
    setStatus(card, "error", "Couldn't save");
    showToast("Save failed: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function collectHours() {
  const out = [];
  document.querySelectorAll(".hours-row").forEach(row => {
    const day = +row.dataset.day;
    const fields = row.querySelectorAll(".hours-time");
    const entry = { day };
    fields.forEach(f => { entry[f.dataset.field] = f.value; });
    out.push(entry);
  });
  return out;
}

function setStatus(card, kind, text) {
  const el = document.querySelector(`.card-status[data-card="${card}"]`);
  if (!el) return;
  el.className = `card-status ${kind}`;
  el.textContent = text;
  if (kind === "saved") setTimeout(() => { if (el.classList.contains("saved")) el.textContent = ""; el.className = "card-status"; }, 6000);
}

let toastTimer;
function showToast(text, kind = "") {
  toastEl.hidden = false;
  toastEl.className = `toast ${kind}`;
  toastEl.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4000);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
