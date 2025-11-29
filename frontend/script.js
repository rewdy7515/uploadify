document.querySelector("#export").onclick = async () => {
  const res = await fetch("/api/export");
  const data = await res.json();

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "spotify_backup.json";
  a.click();
};

document.querySelector("#import").onclick = () => {
  document.querySelector("#inputFile").click();
};

document.querySelector("#inputFile").onchange = async (e) => {
  const text = await e.target.files[0].text();
  const json = JSON.parse(text);

  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  document.querySelector("#log").textContent = await res.text();
};
