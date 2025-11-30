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
const logEl = document.querySelector("#log");
const progressWrap = document.querySelector("#progressWrap");
const progressEl = document.querySelector("#progress");
const progressLabel = document.querySelector("#progressLabel");

let isLogged = false;
let backupBlob = null;
let progressTimer = null;

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

  hydrateAuthState();
}

function setLogged(state) {
  isLogged = state;

  if (isLogged) {
    app.classList.remove("hidden");
    statusEl.textContent = "Listo. Exporta o importa tus playlists.";
    switchRow.classList.remove("hidden");
  } else {
    app.classList.add("hidden");
    statusEl.textContent = "Conecta tu cuenta de Spotify para continuar.";
    downloadBtn.classList.add("hidden");
    switchRow.classList.add("hidden");
    backupBlob = null;
  }
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
  startProgress();

  try {
    const res = await fetch("/api/export");
    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    backupBlob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    finishProgress();
    downloadBtn.classList.remove("hidden");
    log("Exportación completada. Descarga el archivo.");
  } catch (err) {
    stopProgress();
    log(`Error al exportar: ${err.message}`);
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

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    log(await res.text());
  } catch (err) {
    log(`Error al importar: ${err.message}`);
  } finally {
    inputFile.value = "";
  }
}

function downloadBackup() {
  if (!backupBlob) return;
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

function startProgress() {
  progressEl.value = 0;
  progressLabel.textContent = "0%";
  progressWrap.classList.remove("hidden");
  progressTimer = setInterval(() => {
    const next = Math.min(progressEl.value + Math.random() * 12, 90);
    progressEl.value = next;
    progressLabel.textContent = `${Math.round(next)}%`;
  }, 350);
}

function finishProgress() {
  stopProgress();
  progressEl.value = 100;
  progressLabel.textContent = "100%";
  downloadBtn.classList.remove("hidden");
}

function stopProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progressWrap.classList.add("hidden");
}

function switchAccount() {
  sessionStorage.removeItem("spotifyAuthed");
  window.location.href = "/api/login";
}
