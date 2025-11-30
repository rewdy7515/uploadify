const loginBtn = document.querySelector("#loginBtn");
const exportBtn = document.querySelector("#exportBtn");
const importBtn = document.querySelector("#importBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const switchBtn = document.querySelector("#switchBtn");
const inputFile = document.querySelector("#inputFile");
const statusEl = document.querySelector("#status");
const app = document.querySelector("#app");
const authRow = document.querySelector("#authRow");
const switchRow = document.querySelector("#switchRow");
const userInfo = document.querySelector("#userInfo");
const userNameEl = document.querySelector("#userName");
const avatarEl = document.querySelector("#avatar");
const progressTitle = document.querySelector("#progressTitle");
const logEl = document.querySelector("#log");
const progressWrap = document.querySelector("#progressWrap");
const progressEl = document.querySelector("#progress");
const progressLabel = document.querySelector("#progressLabel");
const importSelection = document.querySelector("#importSelection");
const importGoBtn = document.querySelector("#importGoBtn");

let isLogged = false;
let backupBlob = null;
let progressTimer = null;
let backupData = null;
let importData = null;
let selectionState = {
  userName: false,
  profileImage: false,
  playlists: true,
  liked: true,
  albums: true,
  artists: true,
  podcasts: true,
};
let importSelectionState = {
  userName: false,
  profileImage: false,
  playlists: true,
  liked: true,
  albums: true,
  artists: true,
  podcasts: true,
};

init();

function init() {
  loginBtn.onclick = () => {
    loginBtn.disabled = true;
    window.location.href = "/api/login";
  };

  exportBtn.onclick = handleExport;
  importBtn.onclick = () => inputFile.click();
  downloadBtn.onclick = downloadBackup;
  inputFile.onchange = handleImport;
  switchBtn.onclick = switchAccount;
  initSelection();
  initImportSelection();

  hydrateAuthState();
}

function setLogged(state) {
  isLogged = state;

  if (isLogged) {
    app.classList.remove("hidden");
    statusEl.textContent = "Listo. Exporta o importa tus playlists.";
    switchRow.classList.remove("hidden");
    authRow.classList.add("hidden");
    loadProfile();
  } else {
    app.classList.add("hidden");
    statusEl.textContent = "Conecta tu cuenta de Spotify para continuar.";
    downloadBtn.classList.add("hidden");
    switchRow.classList.add("hidden");
    backupBlob = null;
    authRow.classList.remove("hidden");
    userInfo.classList.add("hidden");
  }
}

function initSelection() {
  document.querySelectorAll('#selection input[type="checkbox"]').forEach((chk) => {
    const key = chk.dataset.key;
    chk.checked = selectionState[key];
    chk.onchange = () => {
      selectionState[key] = chk.checked;
    };
  });
}

function initImportSelection() {
  document.querySelectorAll('#importSelection input[type="checkbox"]').forEach((chk) => {
    const key = chk.dataset.imp;
    chk.checked = importSelectionState[key];
    chk.onchange = () => {
      importSelectionState[key] = chk.checked;
    };
  });
  importGoBtn.onclick = startImport;
}

function hydrateAuthState() {
  const params = new URLSearchParams(window.location.search);
  const authedParam = params.get("authed");
  const authedSession = sessionStorage.getItem("spotifyAuthed");

  if (authedParam === "1") {
    sessionStorage.setItem("spotifyAuthed", "1");
    params.delete("authed");
    const newUrl =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", newUrl);
    setLogged(true);
    return;
  }

  setLogged(authedSession === "1");
}

async function handleExport() {
  if (!isLogged) {
    log("Primero inicia sesión con Spotify.");
    return;
  }

  toggleExportState(true);
  startProgress("Exportando datos...");

  try {
    await streamExport();
  } catch (err) {
    log(`Error al exportar: ${err.message}`);
    stopProgress();
  } finally {
    toggleExportState(false);
  }
}

async function handleImport(e) {
  if (!isLogged) {
    log("Primero inicia sesión con Spotify.");
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    importData = json;
    populateImportSelection(json);
    importSelection.classList.remove("hidden");
    log("Selecciona qué importar y presiona Continuar.");
  } catch (err) {
    log(`Error al importar: ${err.message}`);
  } finally {
    inputFile.value = "";
  }
}

async function startImport() {
  if (!isLogged) {
    log("Primero inicia sesión con Spotify.");
    return;
  }
  if (!importData) {
    log("Primero selecciona un archivo de respaldo.");
    return;
  }

  const payload = buildImportPayload();
  const hasData =
    (payload.playlists?.length || 0) +
      (payload.liked?.length || 0) +
      (payload.albums?.length || 0) +
      (payload.artists?.length || 0) +
      (payload.podcasts?.length || 0) >
    0;

  if (!hasData) {
    log("No hay datos seleccionados para importar.");
    return;
  }

  toggleExportState(true);
  startProgress("Importando datos...");

  try {
    await streamImport(payload);
  } catch (err) {
    log(`Error al importar: ${err.message}`);
    stopProgress();
  } finally {
    toggleExportState(false);
  }
}

function downloadBackup() {
  if (!backupData) {
    log("Primero exporta tus datos.");
    return;
  }

  backupBlob = new Blob([JSON.stringify(buildSelectedData(), null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(backupBlob);
  a.download = "spotify_backup.json";
  a.click();
}

function log(message) {
  logEl.textContent = message;
}

function toggleExportState(isLoading) {
  exportBtn.disabled = isLoading;
  importBtn.disabled = isLoading;
}

function startProgress(title) {
  progressTitle.textContent = title || "Procesando...";
  progressEl.value = 0;
  progressLabel.textContent = "0%";
  progressWrap.classList.remove("hidden");
}

function finishProgress(showDownload = true) {
  progressEl.value = 100;
  progressLabel.textContent = "100%";
  if (showDownload) {
    downloadBtn.classList.remove("hidden");
  }
}

function stopProgress() {
  progressWrap.classList.add("hidden");
}

function switchAccount() {
  sessionStorage.removeItem("spotifyAuthed");
  userInfo.classList.add("hidden");
  window.location.href = "/api/login";
}

async function loadProfile() {
  try {
    const res = await fetch("/api/session");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.logged) return;

    const { user } = data;
    if (user?.name) userNameEl.textContent = user.name;
    if (user?.image) {
      avatarEl.src = user.image;
      avatarEl.classList.remove("hidden");
    } else {
      avatarEl.classList.add("hidden");
    }
    userInfo.classList.remove("hidden");
  } catch (err) {
    console.error(err);
  }
}

async function streamExport() {
  const res = await fetch("/api/export");
  if (!res.ok || !res.body) {
    throw new Error(await res.text());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "progress") {
        progressEl.value = msg.percent;
        progressLabel.textContent = `${msg.percent}%`;
      } else if (msg.type === "data") {
        backupData = msg.payload;
        updateSelectionCounts(msg.counts);
        finishProgress();
        downloadBtn.classList.remove("hidden");
        document.querySelector("#selection").classList.remove("hidden");
        log("Exportación completada. Descarga el archivo.");
      }
    }
  }
}

async function streamImport(payload) {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    throw new Error(await res.text());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "progress") {
        progressEl.value = msg.percent;
        progressLabel.textContent = `${msg.percent}%`;
      } else if (msg.type === "done") {
        finishProgress(false);
        log("Importación completada.");
      }
    }
  }
}

function buildSelectedData() {
  if (!backupData) return {};

  const selected = {};

  if (selectionState.userName || selectionState.profileImage) {
    selected.user = {};
    if (selectionState.userName && backupData.user?.name) {
      selected.user.name = backupData.user.name;
    }
    if (selectionState.profileImage && backupData.user?.image) {
      selected.user.image = backupData.user.image;
    }
    // if nothing got added, drop user
    if (Object.keys(selected.user).length === 0) delete selected.user;
  }

  if (selectionState.playlists) selected.playlists = backupData.playlists || [];
  if (selectionState.liked) selected.liked = backupData.liked || [];
  if (selectionState.albums) selected.albums = backupData.albums || [];
  if (selectionState.artists) selected.artists = backupData.artists || [];
  if (selectionState.podcasts) selected.podcasts = backupData.podcasts || [];

  return selected;
}

function updateSelectionCounts(counts = {}) {
  Object.entries(counts).forEach(([key, value]) => {
    const countEl = document.querySelector(`#count-${key}`);
    const chk = document.querySelector(`#selection input[data-key="${key}"]`);
    if (countEl) countEl.textContent = value ?? 0;
    if (chk) {
      const zero = !value || value === 0;
      chk.disabled = zero;
      if (zero) {
        chk.checked = false;
        selectionState[key] = false;
      }
    }
  });
}

function populateImportSelection(data = {}) {
  const counts = {
    userName: data.user?.name ? 1 : 0,
    profileImage: data.user?.image ? 1 : 0,
    playlists: data.playlists?.length || 0,
    liked: data.liked?.length || 0,
    albums: data.albums?.length || 0,
    artists: data.artists?.length || 0,
    podcasts: data.podcasts?.length || 0,
  };

  Object.entries(counts).forEach(([key, value]) => {
    const countEl = document.querySelector(`#imp-count-${key}`);
    const chk = document.querySelector(`#importSelection input[data-imp="${key}"]`);
    if (countEl) countEl.textContent = value ?? 0;

    const hasData = value && value > 0;
    const importable = !["userName", "profileImage"].includes(key);
    if (chk) {
      chk.disabled = !importable || !hasData;
      chk.checked = importable && hasData;
      importSelectionState[key] = chk.checked;
    }
  });
}

function buildImportPayload() {
  const payload = {};
  if (importSelectionState.playlists && importData?.playlists)
    payload.playlists = importData.playlists;
  if (importSelectionState.liked && importData?.liked)
    payload.liked = importData.liked;
  if (importSelectionState.albums && importData?.albums)
    payload.albums = importData.albums;
  if (importSelectionState.artists && importData?.artists)
    payload.artists = importData.artists;
  if (importSelectionState.podcasts && importData?.podcasts)
    payload.podcasts = importData.podcasts;
  return payload;
}
