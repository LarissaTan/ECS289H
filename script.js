// ---------------- data loading ----------------

const LEVELS = ["L1", "L2", "L3", "L4"];

// visData: { "009": { file_name, levels: {L1:{gpt,gemini}, ... } } }
const visData = {};
// entailmentData: { "009": { entailment_status: {...}, human_annotation: {...} } }
const entailmentData = {};

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

async function loadAllData() {
  // 对应 JSON 里的字段名
  const levelField = {
    L1: "L1_construction",
    L2: "L2_key_relations",
    L3: "L3_trend_pattern",
    L4: "L4_real_world_implication",
  };

  const [L1, L2, L3, L4, result] = await Promise.all([
    loadJson("json/L1.json"),
    loadJson("json/L2.json"),
    loadJson("json/L3.json"),
    loadJson("json/L4.json"),
    loadJson("json/result.json"),
  ]);

  const levelJsonMap = { L1, L2, L3, L4 };

  LEVELS.forEach(level => {
    const json = levelJsonMap[level];
    const field = levelField[level];
    if (!json || !json.visualizations) return;

    json.visualizations.forEach(v => {
      const id = v.vis_id;
      if (!visData[id]) {
        visData[id] = {
          file_name: v.file_name,
          levels: {}
        };
      }
      const gptText = v.models?.gpt?.[field] || "";
      const geminiText = v.models?.gemini?.[field] || "";
      visData[id].levels[level] = { gpt: gptText, gemini: geminiText };
    });
  });

  // result.json: 键是 "vis_009" 这种
  Object.keys(result).forEach(key => {
    if (!key.startsWith("vis_")) return;
    const id = key.replace("vis_", "");
    entailmentData[id] = result[key];
  });
}

// ---------------- UI building ----------------

function buildGallery() {
  const galleryGrid = document.getElementById("gallery-grid");
  galleryGrid.innerHTML = "";

  const ids = Object.keys(visData)
  .filter(id => id !== "010" && id !== "025")
  .sort();


  ids.forEach(id => {
    const item = visData[id];
    const div = document.createElement("div");
    div.className = "thumb";
    div.dataset.id = id;

    const img = document.createElement("img");
    img.src = `gallery/${item.file_name}`;
    img.alt = id;

    const p = document.createElement("p");
    p.textContent = `vis ${id}`;

    div.appendChild(img);
    div.appendChild(p);
    galleryGrid.appendChild(div);
  });
}

function setupThumbClicks() {
  const galleryView = document.getElementById("gallery-view");
  const detailView = document.getElementById("detail-view");
  const backBtn = document.getElementById("back-btn");

  galleryView.addEventListener("click", (e) => {
    const thumb = e.target.closest(".thumb");
    if (!thumb) return;
    const id = thumb.dataset.id;
    openDetail(id);
  });

  backBtn.addEventListener("click", () => {
    detailView.classList.add("hidden");
    galleryView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function openDetail(visId) {
  const data = visData[visId];
  if (!data) return;

  const galleryView = document.getElementById("gallery-view");
  const detailView = document.getElementById("detail-view");
  const detailImage = document.getElementById("detail-image");
  const detailId = document.getElementById("detail-id");
  const detailLabel = document.getElementById("detail-label");

  detailImage.src = `gallery/${data.file_name}`;
  detailImage.alt = `vis ${visId}`;
  detailId.textContent = `vis ${visId}`;
  detailLabel.textContent = data.file_name || `Visualization ${visId}`;

  // 填充 L1–L4 文本
  LEVELS.forEach(level => {
    const textGPT = document.getElementById(`text-${level}-gpt`);
    const textGem = document.getElementById(`text-${level}-gemini`);

    const lvlData = data.levels[level];
    if (lvlData) {
      textGPT.textContent = lvlData.gpt || "(no GPT text for this level)";
      textGem.textContent = lvlData.gemini || "(no Gemini text for this level)";
    } else {
      textGPT.textContent = "(no GPT text for this level)";
      textGem.textContent = "(no Gemini text for this level)";
    }
  });

  // entailment + human annotation
const entail = entailmentData[visId] || {};
LEVELS.forEach(level => {
  const labelEl = document.querySelector(
    `.entailment-label[data-extra-level="${level}"]`
  );
  const commentEl = document.querySelector(
    `.entailment-comment[data-extra-level="${level}"]`
  );

  const status = entail.entailment_status?.[level] || "Not annotated";
  const comment = entail.human_annotation?.[level] || "";

  if (labelEl) labelEl.textContent = status;
  if (commentEl) commentEl.textContent = comment || "";

  const scrolly = document.querySelector(
    `.lvl-scrolly[data-scroll-level="${level}"]`
  );
  if (scrolly) {
    const isEnt = (status || "").toLowerCase() === "entailment";
    scrolly.dataset.hasEntailment = isEnt ? "true" : "false";

    scrolly.classList.remove("stage-overlap", "stage-extra");
    scrolly.classList.add("stage-split");
    scrolly.scrollTop = 0;
  }
});


  // 显示 detail
  galleryView.classList.add("hidden");
  detailView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // 重置每个 level 的滚动和阶段
  document.querySelectorAll(".lvl-scrolly").forEach(scrolly => {
    scrolly.scrollTop = 0;
    scrolly.classList.remove("stage-overlap", "stage-extra");
    scrolly.classList.add("stage-split");
  });
}

// ---------------- scroll animations ----------------

function setupLevelFadeIn() {
  const levels = document.querySelectorAll(".level");
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  levels.forEach(level => io.observe(level));
}

function setupScrollMerge() {
  document.querySelectorAll(".lvl-scrolly").forEach(scrolly => {
    const stages = scrolly.querySelectorAll(".lvl-stage");
    if (!stages.length) return;

    const io = new IntersectionObserver(entries => {
      let best = null;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry;
        }
      });
      if (!best) return;

      const stageEl = best.target;
      const stageName = stageEl.dataset.stage;

      // 标记当前 active stage，用来控制 extra 文本是否出现
      stages.forEach(s => s.classList.toggle("active-stage", s === stageEl));

      const hasEnt =
        scrolly.dataset.hasEntailment &&
        scrolly.dataset.hasEntailment === "true";

      // ⭐ 如果还没怎么滚（刚打开 detail），强制保持 split，不让它一开始就跳到 overlap
      if (scrolly.scrollTop < 10) {
        scrolly.classList.remove("stage-overlap", "stage-extra");
        scrolly.classList.add("stage-split");
        return;
      }

      if (!hasEnt) {
        scrolly.classList.remove("stage-overlap", "stage-extra");
        scrolly.classList.add("stage-split");
        return;
      }

      scrolly.classList.remove("stage-split", "stage-overlap", "stage-extra");
      scrolly.classList.add(`stage-${stageName}`);
    }, {
      root: scrolly,
      threshold: 0.6
    });

    stages.forEach(stage => io.observe(stage));
  });
}



// ---------------- init ----------------

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadAllData();
    buildGallery();
    setupThumbClicks();
    setupLevelFadeIn();
    setupScrollMerge();
  } catch (err) {
    console.error(err);
    alert("Failed to load JSON data. If you are opening index.html via file://, please run a local server (e.g., `python -m http.server`).");
  }
});
