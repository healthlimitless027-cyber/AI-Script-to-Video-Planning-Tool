/* ================================================================
   AI SCRIPT TO VIDEO PLANNING TOOL — script.js
   Vanilla JavaScript only. No frameworks.
   ================================================================ */

/* ----------------------------------------------------------------
   🔑 HARDCODED PEXELS API KEYS
   Add as many keys as you want here. The tool automatically
   rotates between them (round-robin) and skips to the next key
   if one hits its rate limit (HTTP 429) or is invalid (401).
   No input box is shown to the user — keys stay in this file only.
   ------------------------------------------------------------- */
const API_KEYS = [
  "g3q5vBoaF3X70yvsZXtOgVnjvRShczpx3o0J7GuIRkrrqSOqh8LO85X6",
  "YOUR_PEXELS_API_KEY_2",
  "YOUR_PEXELS_API_KEY_3"
];

let currentKeyIndex = 0;

/**
 * getNextApiKey()
 * Returns the next key in the rotation (round-robin), skipping
 * empty/placeholder entries.
 */
function getNextApiKey() {
  const validKeys = API_KEYS.filter(
    (k) => k && !k.startsWith("YOUR_PEXELS_API_KEY")
  );
  if (validKeys.length === 0) return null;
  const key = validKeys[currentKeyIndex % validKeys.length];
  currentKeyIndex++;
  return key;
}

/* ----------------------------------------------------------------
   GLOBAL STATE
   scenes: array of scene objects, each shaped like:
   {
     id, index, text, duration, mediaType,
     results: [], resultIndex: -1, query: "", page: 1,
     selectedMedia: null  // { url, thumbnail, type } once confirmed
   }
   ------------------------------------------------------------- */
let scenes = [];

// Currently selected global media type ("video" or "image") — chosen once
// near the top buttons and applied to every scene automatically.
let globalMediaType = "video";

const LS_SCENES_KEY = "s2v_scenes";

/* ----------------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------------- */
const scriptInput = document.getElementById("scriptInput");
const generateBtn = document.getElementById("generateBtn");
const generateAllBtn = document.getElementById("generateAllBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const scenesContainer = document.getElementById("scenesContainer");
const scenesHeading = document.getElementById("scenesHeading");
const storyboardContainer = document.getElementById("storyboardContainer");
const exportBtn = document.getElementById("exportBtn");
const globalStatus = document.getElementById("globalStatus");
const globalMediaTypeRadios = document.querySelectorAll('input[name="globalMediaType"]');

/* ================================================================
   INITIALIZATION
   ================================================================ */

/**
 * init()
 * Runs on page load. Restores previously generated scenes from
 * LocalStorage so work isn't lost on refresh.
 */
function init() {
  const savedScenes = localStorage.getItem(LS_SCENES_KEY);
  if (savedScenes) {
    try {
      scenes = JSON.parse(savedScenes);
      if (scenes.length > 0 && scenes[0].mediaType) {
        globalMediaType = scenes[0].mediaType;
        globalMediaTypeRadios.forEach((radio) => {
          radio.checked = radio.value === globalMediaType;
        });
      }
      renderScenes();
      updateStoryboard();
    } catch (e) {
      console.error("Failed to parse saved scenes:", e);
    }
  }

  if (getNextApiKey() === null) {
    setGlobalStatus(
      "⚠️ No real API key set yet. Open script.js and replace the placeholder values inside API_KEYS with your real Pexels key(s).",
      "error"
    );
  }
}

/**
 * setGlobalStatus(message, type)
 * Shows a status line above the scenes area (loading/progress/errors).
 */
function setGlobalStatus(message, type) {
  if (!globalStatus) return;
  globalStatus.textContent = message;
  globalStatus.className = "status-text " + (type || "");
}

/* ================================================================
   SCRIPT PARSING / SCENE GENERATION
   ================================================================ */

/**
 * splitScript(rawText)
 * Splits the pasted script strictly SENTENCE BY SENTENCE, so every
 * scene is exactly one sentence (each sentence gets its own
 * image/video search). Handles ., !, ? as sentence enders, and
 * falls back to the whole text if no sentence punctuation is found.
 */
function splitScript(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Normalize newlines to spaces so multi-line scripts still split cleanly
  const flatText = trimmed.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ");

  // Match each sentence ending in . ! or ? (keeping the punctuation),
  // including an optional closing quote/parenthesis right after it.
  const sentences = flatText.match(/[^.!?]+[.!?]+[)"'\u201d]?(\s|$)/g);

  if (sentences && sentences.length > 0) {
    return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // No punctuation found at all — treat the whole thing as one scene
  return [flatText];
}

/**
 * generateScenes()
 * Splits the textarea content into scenes and builds fresh scene
 * objects with default duration/media type, then renders them.
 */
function generateScenes() {
  const rawText = scriptInput.value;
  const chunks = splitScript(rawText);

  if (chunks.length === 0) {
    alert("Please paste a script before generating scenes.");
    return;
  }

  scenes = chunks.map((text, i) => ({
    id: "scene_" + Date.now() + "_" + i,
    index: i + 1,
    text: text,
    duration: 5,
    mediaType: globalMediaType,
    results: [],
    resultIndex: -1,
    query: "",
    page: 1,
    selectedMedia: null,
  }));

  saveScenesToStorage();
  renderScenes();
  updateStoryboard();
  setGlobalStatus("", "");
}

/**
 * clearAll()
 * Wipes scenes from memory, storage, and the UI.
 */
function clearAll() {
  if (!confirm("This will clear the script, all scenes, and the storyboard. Continue?")) {
    return;
  }
  scenes = [];
  scriptInput.value = "";
  localStorage.removeItem(LS_SCENES_KEY);
  renderScenes();
  updateStoryboard();
  setGlobalStatus("", "");
}

/* ================================================================
   RENDERING SCENE CARDS
   ================================================================ */

function renderScenes() {
  scenesContainer.innerHTML = "";
  scenesHeading.style.display = scenes.length ? "block" : "none";
  scenes.forEach((scene) => scenesContainer.appendChild(buildSceneCard(scene)));
}

function buildSceneCard(scene) {
  const card = document.createElement("div");
  card.className = "scene-card";
  card.dataset.sceneId = scene.id;

  const header = document.createElement("div");
  header.className = "scene-card-header";

  const numberBadge = document.createElement("div");
  numberBadge.className = "scene-number";
  numberBadge.textContent = scene.index;
  header.appendChild(numberBadge);

  if (scene.selectedMedia) {
    const badge = document.createElement("span");
    badge.className = "selected-badge";
    badge.textContent = "✓ Media Selected";
    header.appendChild(badge);
  }
  card.appendChild(header);

  // ---- Controls: Media Type + Duration — placed at the TOP of every
  // card (right after the scene number), before the scene text ----
  const controls = document.createElement("div");
  controls.className = "scene-controls";

  const mediaWrap = document.createElement("div");
  mediaWrap.innerHTML = `<label>Media Type</label>`;
  const mediaSelect = document.createElement("select");
  ["video", "image"].forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m === "video" ? "Video" : "Image";
    if (scene.mediaType === m) opt.selected = true;
    mediaSelect.appendChild(opt);
  });
  mediaSelect.addEventListener("change", (e) => {
    scene.mediaType = e.target.value;
    scene.results = [];
    scene.resultIndex = -1;
    saveScenesToStorage();
    renderPreview(card, scene);
  });
  mediaWrap.appendChild(mediaSelect);
  controls.appendChild(mediaWrap);

  const durationWrap = document.createElement("div");
  durationWrap.innerHTML = `<label>Duration</label>`;
  const durationSelect = document.createElement("select");
  [5, 10, 15].forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d + " sec";
    if (scene.duration === d) opt.selected = true;
    durationSelect.appendChild(opt);
  });
  durationSelect.addEventListener("change", (e) => {
    scene.duration = parseInt(e.target.value, 10);
    saveScenesToStorage();
    updateStoryboard();
  });
  durationWrap.appendChild(durationSelect);
  controls.appendChild(durationWrap);

  card.appendChild(controls);

  // ---- Scene text (now shown below the controls) ----
  const textBox = document.createElement("div");
  textBox.className = "scene-text";
  textBox.textContent = scene.text;
  card.appendChild(textBox);

  const preview = document.createElement("div");
  preview.className = "scene-preview";
  preview.id = "preview_" + scene.id;
  card.appendChild(preview);
  renderPreview(card, scene);

  const actions = document.createElement("div");
  actions.className = "scene-actions";

  const searchBtn = document.createElement("button");
  searchBtn.className = "btn btn-secondary btn-small";
  searchBtn.textContent = "🔍 Search Pexels";
  searchBtn.addEventListener("click", () => searchMediaForScene(scene, card));
  actions.appendChild(searchBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-secondary btn-small";
  nextBtn.textContent = "⏭️ Next Result";
  nextBtn.addEventListener("click", () => nextResult(scene, card));
  actions.appendChild(nextBtn);

  const selectBtn = document.createElement("button");
  selectBtn.className = "btn btn-primary btn-small";
  selectBtn.textContent = "✅ Select This";
  selectBtn.addEventListener("click", () => selectMedia(scene, card));
  actions.appendChild(selectBtn);

  card.appendChild(actions);
  return card;
}

function renderPreview(card, scene) {
  const preview = card.querySelector(".scene-preview");
  preview.innerHTML = "";
  const current = scene.results[scene.resultIndex];

  if (!current) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder-text";
    placeholder.textContent =
      "No media loaded yet. Click \"Search Pexels\" to find " + scene.mediaType + "s for this scene.";
    preview.appendChild(placeholder);
    return;
  }

  if (scene.mediaType === "image") {
    const img = document.createElement("img");
    img.src = current.previewUrl;
    img.alt = "Pexels image preview";
    preview.appendChild(img);
  } else {
    const video = document.createElement("video");
    video.src = current.previewUrl;
    video.controls = true;
    video.muted = true;
    preview.appendChild(video);
  }
}

function showLoadingSpinner(card) {
  const preview = card.querySelector(".scene-preview");
  preview.innerHTML = "";
  const spinner = document.createElement("div");
  spinner.className = "loading-spinner";
  preview.appendChild(spinner);
}

/* ================================================================
   PEXELS API INTEGRATION
   ================================================================ */

function buildQueryFromText(text) {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on",
    "for", "with", "is", "are", "was", "were", "it", "this", "that",
    "as", "by", "at", "be", "he", "she", "they", "we", "you", "i",
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !stopwords.has(w));
  return words.slice(0, 6).join(" ") || text.slice(0, 40);
}

/**
 * searchMediaForScene(scene, card)
 * Fires a fresh Pexels search (page 1) for the given scene.
 */
async function searchMediaForScene(scene, card) {
  scene.query = buildQueryFromText(scene.text);
  scene.page = 1;
  if (card) showLoadingSpinner(card);

  try {
    const results = await fetchPexelsResults(scene, scene.page);
    scene.results = results;
    scene.resultIndex = results.length ? 0 : -1;
    saveScenesToStorage();
    if (card) renderPreview(card, scene);

    if (!results.length && card) {
      const preview = card.querySelector(".scene-preview");
      preview.innerHTML = "";
      const msg = document.createElement("p");
      msg.className = "placeholder-text";
      msg.textContent = "No results found for \"" + scene.query + "\". Try editing the scene text.";
      preview.appendChild(msg);
    }
    return results;
  } catch (err) {
    console.error(err);
    if (card) {
      const preview = card.querySelector(".scene-preview");
      preview.innerHTML = "";
      const msg = document.createElement("p");
      msg.className = "placeholder-text";
      msg.textContent = "Error fetching media: " + err.message;
      preview.appendChild(msg);
    }
    throw err;
  }
}

/**
 * fetchPexelsResults(scene, page)
 * Calls the correct Pexels endpoint (photos or videos), rotating
 * through API_KEYS and retrying on 401/429 with the next key.
 */
async function fetchPexelsResults(scene, page) {
  const perPage = 10;
  let url;

  if (scene.mediaType === "image") {
    url =
      "https://api.pexels.com/v1/search?query=" +
      encodeURIComponent(scene.query) +
      "&per_page=" + perPage + "&page=" + page +
      "&orientation=landscape&size=large";
  } else {
    const minDur = Math.max(scene.duration - 3, 1);
    const maxDur = scene.duration + 15;
    url =
      "https://api.pexels.com/videos/search?query=" +
      encodeURIComponent(scene.query) +
      "&per_page=" + perPage + "&page=" + page +
      "&min_duration=" + minDur + "&max_duration=" + maxDur +
      "&orientation=landscape&size=large";
  }

  const validKeyCount = API_KEYS.filter(
    (k) => k && !k.startsWith("YOUR_PEXELS_API_KEY")
  ).length;

  if (validKeyCount === 0) {
    throw new Error("No valid API key set in API_KEYS (script.js).");
  }

  let lastError;
  for (let attempt = 0; attempt < validKeyCount; attempt++) {
    const key = getNextApiKey();
    try {
      const response = await fetch(url, { headers: { Authorization: key } });

      if (response.status === 401 || response.status === 429) {
        lastError = new Error(
          response.status === 401 ? "Invalid API key." : "Rate limit hit, rotating key..."
        );
        continue; // try next key
      }
      if (!response.ok) {
        throw new Error("Pexels API request failed (" + response.status + ").");
      }

      const data = await response.json();

      if (scene.mediaType === "image") {
        return (data.photos || []).map((photo) => ({
          id: photo.id,
          previewUrl: photo.src.large,
          thumbnail: photo.src.medium,
          sourceUrl: photo.src.original,
          pageUrl: photo.url,
        }));
      }

      return (data.videos || []).map((video) => {
        const files = video.video_files || [];

        // Prefer a genuinely widescreen (16:9-ish) file: width > height
        // and ratio close to 1.78, at HD resolution or better when possible.
        const landscapeFiles = files.filter(
          (f) => f.width && f.height && f.width > f.height
        );
        const near16by9 = landscapeFiles
          .slice()
          .sort((a, b) => {
            const ratioA = Math.abs(a.width / a.height - 16 / 9);
            const ratioB = Math.abs(b.width / b.height - 16 / 9);
            if (ratioA !== ratioB) return ratioA - ratioB;
            return (b.width || 0) - (a.width || 0); // prefer higher resolution
          })[0];

        const hdFile =
          near16by9 ||
          files.find((f) => f.quality === "hd") ||
          files.find((f) => f.quality === "sd") ||
          files[0];

        return {
          id: video.id,
          previewUrl: hdFile ? hdFile.link : "",
          thumbnail: video.image,
          sourceUrl: hdFile ? hdFile.link : "",
          pageUrl: video.url,
        };
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All API keys failed.");
}

async function nextResult(scene, card) {
  if (!scene.results.length) {
    await searchMediaForScene(scene, card);
    return;
  }

  if (scene.resultIndex < scene.results.length - 1) {
    scene.resultIndex++;
    saveScenesToStorage();
    renderPreview(card, scene);
    return;
  }

  if (card) showLoadingSpinner(card);
  try {
    scene.page += 1;
    const moreResults = await fetchPexelsResults(scene, scene.page);
    if (moreResults.length) {
      scene.results = scene.results.concat(moreResults);
      scene.resultIndex++;
    } else {
      scene.resultIndex = 0;
      scene.page = 1;
    }
    saveScenesToStorage();
    if (card) renderPreview(card, scene);
  } catch (err) {
    console.error(err);
    alert("Error fetching more results: " + err.message);
    if (card) renderPreview(card, scene);
  }
}

function selectMedia(scene, card) {
  const current = scene.results[scene.resultIndex];
  if (!current) {
    alert("Please search and preview a result before selecting.");
    return;
  }
  scene.selectedMedia = {
    type: scene.mediaType,
    url: current.sourceUrl || current.previewUrl,
    thumbnail: current.thumbnail,
    pageUrl: current.pageUrl,
  };
  saveScenesToStorage();
  renderScenes();
  updateStoryboard();
}

/* ================================================================
   GENERATE ALL — one-click: search + auto-select for every scene
   ================================================================ */

/**
 * generateAllMedia()
 * Loops through every scene sequentially, searches Pexels using
 * each scene's text + chosen duration/media type, and automatically
 * selects the first matching result. Sequential (not parallel) to
 * stay friendly to Pexels rate limits.
 */
async function generateAllMedia() {
  if (scenes.length === 0) {
    alert("Generate scenes from your script first.");
    return;
  }

  generateAllBtn.disabled = true;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    setGlobalStatus(
      `⏳ Searching & selecting media for scene ${scene.index} of ${scenes.length}...`,
      ""
    );
    const card = scenesContainer.querySelector(`[data-scene-id="${scene.id}"]`);

    try {
      const results = await searchMediaForScene(scene, card);
      if (results && results.length) {
        scene.resultIndex = 0;
        const current = results[0];
        scene.selectedMedia = {
          type: scene.mediaType,
          url: current.sourceUrl || current.previewUrl,
          thumbnail: current.thumbnail,
          pageUrl: current.pageUrl,
        };
      }
    } catch (err) {
      console.error("Scene " + scene.index + " failed:", err);
    }

    saveScenesToStorage();
    renderScenes();
    updateStoryboard();
  }

  generateAllBtn.disabled = false;
  setGlobalStatus("✅ All scenes processed. Review selections below, then download.", "ok");
}

/* ================================================================
   STORYBOARD
   ================================================================ */

function updateStoryboard() {
  storyboardContainer.innerHTML = "";
  const chosenScenes = scenes.filter((s) => s.selectedMedia);

  if (chosenScenes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-text";
    empty.textContent =
      "No scenes selected yet. Choose media for your scenes above to build your storyboard.";
    storyboardContainer.appendChild(empty);
    return;
  }

  chosenScenes.forEach((scene) => {
    const item = document.createElement("div");
    item.className = "storyboard-item";

    const thumb = document.createElement("img");
    thumb.className = "storyboard-thumb";
    thumb.src = scene.selectedMedia.thumbnail || scene.selectedMedia.url;
    thumb.alt = "Scene " + scene.index + " thumbnail";
    item.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "storyboard-info";
    info.innerHTML = `
      <h4>Scene ${scene.index} — ${scene.duration}s (${scene.selectedMedia.type})</h4>
      <p>${escapeHtml(scene.text)}</p>
    `;
    item.appendChild(info);

    storyboardContainer.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ================================================================
   PERSISTENCE (LocalStorage) & JSON EXPORT
   ================================================================ */

function saveScenesToStorage() {
  localStorage.setItem(LS_SCENES_KEY, JSON.stringify(scenes));
}

function exportStoryboard() {
  const chosenScenes = scenes.filter((s) => s.selectedMedia);
  if (chosenScenes.length === 0) {
    alert("Select media for at least one scene before exporting.");
    return;
  }

  const exportData = chosenScenes.map((scene) => ({
    sceneNumber: scene.index,
    text: scene.text,
    duration: scene.duration,
    mediaType: scene.selectedMedia.type,
    mediaUrl: scene.selectedMedia.url,
    thumbnail: scene.selectedMedia.thumbnail,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "storyboard.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ================================================================
   ZIP DOWNLOAD — bundles all selected media (mp4/jpg) + storyboard.json
   Requires JSZip (loaded via CDN script tag in index.html)
   ================================================================ */

/**
 * downloadAllAsZip()
 * Fetches every selected scene's media file as a blob (several at
 * once, not one-by-one, so it's much faster), packs each into a ZIP
 * (named scene_1.mp4 / scene_1.jpg etc.), includes a storyboard.json
 * summary, then triggers the ZIP download. Reports exactly which
 * scenes failed instead of silently producing an incomplete ZIP.
 */
async function downloadAllAsZip() {
  const chosenScenes = scenes.filter((s) => s.selectedMedia);
  if (chosenScenes.length === 0) {
    alert("Select media for at least one scene before downloading.");
    return;
  }
  if (typeof JSZip === "undefined") {
    alert("JSZip library did not load. Check your internet connection / CDN access.");
    return;
  }

  downloadZipBtn.disabled = true;
  const zip = new JSZip();
  const mediaFolder = zip.folder("media");

  let completed = 0;
  const failedScenes = [];
  const CONCURRENCY = 4; // fetch up to 4 files at once — big speed boost, still gentle on rate limits

  function updateProgress() {
    setGlobalStatus(
      `📦 Downloading media ${completed} of ${chosenScenes.length}...`,
      ""
    );
  }
  updateProgress();

  async function fetchScene(scene) {
    const ext = scene.selectedMedia.type === "video" ? "mp4" : "jpg";
    try {
      const response = await fetch(scene.selectedMedia.url);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const blob = await response.blob();
      mediaFolder.file(`scene_${scene.index}.${ext}`, blob);
    } catch (err) {
      console.error("Failed to add scene " + scene.index + " to zip:", err);
      failedScenes.push(scene.index);
    } finally {
      completed++;
      updateProgress();
    }
  }

  // Run downloads in small parallel batches instead of strictly one
  // at a time — this is the main speed fix.
  for (let i = 0; i < chosenScenes.length; i += CONCURRENCY) {
    const batch = chosenScenes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(fetchScene));
  }

  // Include the storyboard summary inside the zip too
  const storyboardJson = chosenScenes.map((scene) => ({
    sceneNumber: scene.index,
    text: scene.text,
    duration: scene.duration,
    mediaType: scene.selectedMedia.type,
    mediaUrl: scene.selectedMedia.url,
    file: `media/scene_${scene.index}.${scene.selectedMedia.type === "video" ? "mp4" : "jpg"}`,
  }));
  zip.file("storyboard.json", JSON.stringify(storyboardJson, null, 2));

  const successCount = chosenScenes.length - failedScenes.length;
  if (successCount === 0) {
    setGlobalStatus(
      "❌ Couldn't download any media (likely blocked by the source's CORS policy). Try opening a scene's media link directly in a new tab to check.",
      "error"
    );
    downloadZipBtn.disabled = false;
    return;
  }

  setGlobalStatus("📦 Packing ZIP file...", "");
  try {
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storyboard_media.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (failedScenes.length > 0) {
      setGlobalStatus(
        `✅ ZIP downloaded with ${successCount} of ${chosenScenes.length} files (scene(s) ${failedScenes.join(", ")} failed to fetch).`,
        "ok"
      );
    } else {
      setGlobalStatus("✅ ZIP downloaded successfully — all files included.", "ok");
    }
  } catch (err) {
    console.error(err);
    setGlobalStatus("❌ Failed to build ZIP: " + err.message, "error");
  }

  downloadZipBtn.disabled = false;
}


/* ================================================================
   EVENT LISTENERS
   ================================================================ */
generateBtn.addEventListener("click", generateScenes);
generateAllBtn.addEventListener("click", generateAllMedia);
downloadZipBtn.addEventListener("click", downloadAllAsZip);
clearAllBtn.addEventListener("click", clearAll);
exportBtn.addEventListener("click", exportStoryboard);

/**
 * Global Media Type radios ("Video" / "Image" near the top buttons).
 * Changing this updates globalMediaType (used for any newly generated
 * scenes) AND immediately switches every existing scene's media type
 * too, clearing their old search results so a fresh search matches
 * the new type.
 */
globalMediaTypeRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (!e.target.checked) return;
    globalMediaType = e.target.value;

    scenes.forEach((scene) => {
      scene.mediaType = globalMediaType;
      scene.results = [];
      scene.resultIndex = -1;
    });

    saveScenesToStorage();
    renderScenes();
  });
});

// Kick things off
init();
