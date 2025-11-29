import { getSpotify } from "./spotify.js";

export default async function handler(req, res) {
  const spotify = getSpotify();
  const token = req.cookies.access;

  if (!token) return res.status(401).send("No logueado");
  spotify.setAccessToken(token);

  const backup = req.body;

  try {
    for (let pl of backup.playlists) {
      const newPl = await spotify.createPlaylist(pl.name, {
        public: pl.public,
      });

      for (let i = 0; i < pl.tracks.length; i += 100) {
        await spotify.addTracksToPlaylist(
          newPl.body.id,
          pl.tracks.slice(i, i + 100)
        );
      }
    }

    res.send("Importación completada");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error al importar");
  }
}
