import { getSpotify } from "./spotify.js";

export default async function handler(req, res) {
  const spotify = getSpotify();
  const token = req.cookies.access;

  if (!token) return res.status(401).send("No logueado");
  spotify.setAccessToken(token);

  const backup = {
    playlists: [],
    liked: [],
    albums: [],
    artists: [],
  };

  try {
    // playlists
    let pls = await spotify.getUserPlaylists({ limit: 50 });
    for (let pl of pls.body.items) {
      const tracks = [];
      let t = await spotify.getPlaylistTracks(pl.id, { limit: 100 });

      for (let it of t.body.items) {
        if (it.track?.uri) tracks.push(it.track.uri);
      }

      backup.playlists.push({
        name: pl.name,
        public: pl.public,
        tracks,
      });
    }

    // liked tracks
    let liked = await spotify.getMySavedTracks({ limit: 50 });
    for (let it of liked.body.items) {
      backup.liked.push(it.track.uri);
    }

    return res.json(backup);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error al exportar");
  }
}
