const CACHE_MINUTES = 10;
const CACHE_KEY = "smart_news_cache_v3_netlify";

const CATEGORIES = [
  { key: "tunisia", label: "أخبار تونس", desc: "آخر الأخبار الخاصة بتونس فقط." },
  { key: "worldCup2026", label: "كأس العالم 2026", desc: "المباريات والمنتخبات والتصريحات وكل ما يخص كأس العالم 2026." },
  { key: "sports", label: "أخبار الرياضة", desc: "أخبار رياضية عامة دون تكرار أخبار كأس العالم." },
  { key: "world", label: "الأخبار العالمية", desc: "أحداث دولية عامة من خارج تونس." },
  { key: "politics", label: "الأخبار السياسية", desc: "أخبار سياسية محلية ودولية حسب الأهمية." },
  { key: "arts", label: "أخبار الفن", desc: "السينما والموسيقى والتلفزيون والمهرجانات والمشاهير." },
];

let activeCategory = "tunisia";
let newsData = null;
let isLoading = false;

const el = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("ar-TN", { dateStyle: "short", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function placeholderImage(category) {
  const labels = {
    tunisia: "أخبار تونس",
    worldCup2026: "كأس العالم 2026",
    sports: "أخبار الرياضة",
    world: "العالمية",
    politics: "السياسة",
    arts: "الفن",
  };
  const label = labels[category] || "الأخبار";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#061a40"/><stop offset=".6" stop-color="#0f62fe"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1030" cy="120" r="140" fill="rgba(255,255,255,.12)"/><circle cx="120" cy="610" r="190" fill="rgba(255,255,255,.10)"/><text x="600" y="335" text-anchor="middle" fill="white" font-size="64" font-family="Arial" font-weight="700">${label}</text><text x="600" y="400" text-anchor="middle" fill="rgba(255,255,255,.78)" font-size="32" font-family="Arial">بوابة الأخبار الذكية</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function safeImageUrl(url, category) {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  return placeholderImage(category);
}

function setupTabs() {
  const initial = decodeURIComponent(location.hash.replace("#", ""));
  if (CATEGORIES.some((cat) => cat.key === initial)) activeCategory = initial;
  el("tabs").innerHTML = CATEGORIES.map((cat) => `<button class="tab ${cat.key === activeCategory ? "active" : ""}" data-key="${cat.key}" type="button">${cat.label}</button>`).join("");
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.key;
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderHome();
      history.replaceState(null, "", `#${activeCategory}`);
    });
  });
}

function showMessage(message) {
  el("warning").textContent = message;
  el("warning").classList.add("show");
  setTimeout(() => el("warning").classList.remove("show"), 7000);
}

function setStatus(message) {
  el("status").textContent = message;
}

function renderLoading() {
  el("content").innerHTML = `<div class="loader"><div class="spin"></div><strong>جاري جلب الأخبار...</strong><div style="margin-top:6px">الموقع ينادي Backend مخفي على Netlify ثم يعرض النتيجة.</div></div>`;
}

function renderHome() {
  el("homeView").style.display = "block";
  el("articleView").style.display = "none";
  const category = CATEGORIES.find((cat) => cat.key === activeCategory) || CATEGORIES[0];
  el("sectionTitle").textContent = category.label;
  el("sectionDesc").textContent = category.desc;

  if (!newsData) {
    renderLoading();
    return;
  }

  const items = Array.isArray(newsData[activeCategory]) ? newsData[activeCategory] : [];
  if (!items.length) {
    el("content").innerHTML = `<div class="empty">لا توجد أخبار في هذا التبويب حاليًا.</div>`;
    return;
  }

  el("content").innerHTML = `<div class="grid">${items.map((item) => renderCard(item, category)).join("")}</div>`;
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openArticle(button.dataset.open));
  });

  if (newsData.updatedAt) setStatus(`آخر تحديث: ${formatDate(new Date(newsData.updatedAt))}`);
  else setStatus("أخبار جاهزة");
}

function renderCard(item, category) {
  const imageUrl = safeImageUrl(item.imageUrl, item.category || activeCategory);
  return `<article class="card"><div class="thumb"><img src="${escapeHtml(imageUrl)}" alt=""><span class="badge">${escapeHtml(category.label)}</span></div><div class="card-body"><h3>${escapeHtml(item.title || "خبر بدون عنوان")}</h3><p class="summary">${escapeHtml(item.summary || "")}</p><div class="meta">${escapeHtml(item.publishedAt || "تاريخ غير متوفر")}</div><button class="read" data-open="${escapeHtml(item.id)}" type="button">اقرأ الخبر</button></div></article>`;
}

function findArticle(id) {
  for (const category of CATEGORIES) {
    const found = (newsData?.[category.key] || []).find((item) => String(item.id) === String(id));
    if (found) return found;
  }
  return null;
}

function openArticle(id) {
  const item = findArticle(id);
  if (!item) return;
  const category = CATEGORIES.find((cat) => cat.key === (item.category || activeCategory));
  el("homeView").style.display = "none";
  el("articleView").style.display = "block";
  el("articleHero").innerHTML = `<img src="${escapeHtml(safeImageUrl(item.imageUrl, item.category || activeCategory))}" alt="">`;
  el("articleTitle").textContent = item.title || "خبر بدون عنوان";
  el("articleMeta").innerHTML = `<span>${escapeHtml(category?.label || "أخبار")}</span><span>•</span><span>${escapeHtml(item.publishedAt || "تاريخ غير متوفر")}</span>`;
  const paragraphs = Array.isArray(item.body) ? item.body : [item.body || item.summary || ""];
  el("articleBody").innerHTML = paragraphs.filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  el("internalSource").textContent = `sourceName=${item.sourceName || ""}\nsourceUrl=${item.sourceUrl || ""}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  history.pushState({ article: id }, "", `#article-${encodeURIComponent(id)}`);
}

function closeArticle() {
  el("articleView").style.display = "none";
  el("homeView").style.display = "block";
  history.replaceState(null, "", `#${activeCategory}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function setCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAtMs: Date.now(), data }));
}

function isFresh(cache) {
  return cache?.updatedAtMs && Date.now() - Number(cache.updatedAtMs) < CACHE_MINUTES * 60 * 1000;
}

async function loadNews({ force = false } = {}) {
  if (isLoading) return;
  isLoading = true;
  el("refreshBtn").disabled = true;
  try {
    if (!force) {
      const cache = getCache();
      if (cache?.data && isFresh(cache)) {
        newsData = cache.data;
        renderHome();
        setStatus("من الكاش المحلي");
        return;
      }
    }
    renderLoading();
    const response = await fetch(force ? "/api/news?force=1" : "/api/news", { headers: { accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    newsData = payload;
    setCache(payload);
    renderHome();
    showMessage("تم تحديث الأخبار عبر Netlify Backend.");
  } catch (error) {
    showMessage(`فشل جلب الأخبار: ${error.message}`);
    const cache = getCache();
    if (cache?.data) {
      newsData = cache.data;
      renderHome();
    } else {
      el("content").innerHTML = `<div class="empty">تعذر جلب الأخبار ولا يوجد كاش محفوظ.</div>`;
    }
  } finally {
    isLoading = false;
    el("refreshBtn").disabled = false;
  }
}

el("refreshBtn").addEventListener("click", () => loadNews({ force: true }));
el("clearBtn").addEventListener("click", () => {
  localStorage.removeItem(CACHE_KEY);
  showMessage("تم مسح الكاش المحلي.");
  loadNews({ force: true });
});
el("backBtn").addEventListener("click", closeArticle);
window.addEventListener("popstate", () => {
  if (!location.hash.startsWith("#article-")) closeArticle();
});

setupTabs();
loadNews();
