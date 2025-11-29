import express from "express";
import SpotifyWebApi from "spotify-web-api-node";
import cors from "cors";
import fs from "fs";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI; // e.g. https://tusitio.com/callback

const spotify = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

// ------------------- LOGIN -------------------
app.get("/login", (req, res) => {
  const scopes = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-library-read",
    "user-library-modify",
    "user-follow-read",
    "user-follow-modify",
  ];

  const url = spotify.createAuthorizeURL(scopes);
  res.redirect(url);
});

// ------------------- CALLBACK -------------------
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const data = await spotify.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    // guardar tokens en memoria (o Redis)
    spotify.setAccessToken(access_token);
    spotify.setRefreshToken(refresh_token);

    res.redirect("/"); // vuelve a la web
  } catch (err) {
    res.send("Error en login: " + err);
  }
});

// ------------------- EXPORT -------------------
app.get("/export", async (req, res) => {
  try {
    const me = await spotify.getMe();
    const user_id = me.body.id;

    let backup = {
      user_id,
      playlists: [],
      liked_tracks: [],
      saved_albums: [],
      followed_artists: [],
    };

    // --- PLAYLISTS ---
    let playlists = await spotify.getUserPlaylists({ limit: 50 });
    while (true) {
      for (let p of playlists.body.items) {
        let tracks = [];
        let t = await spotify.getPlaylistTracks(p.id, { limit: 100 });

        while (true) {
          for (let item of t.body.items) {
            if (item.track?.uri) tracks.push(item.track.uri);
          }
          if (t.body.next)
            t = await spotify.getPlaylistTracks(p.id, {
              limit: 100,
              offset: t.body.offset + 100,
            });
          else break;
        }

        backup.playlists.push({
          name: p.name,
          public: p.public,
          tracks,
        });
      }
      if (playlists.body.next)
        playlists = await spotify.getUserPlaylists({
          limit: 50,
          offset: playlists.body.offset + 50,
        });
      else break;
    }

    // --- LIKED SONGS ---
    let liked = await spotify.getMySavedTracks({ limit: 50 });
    while (true) {
      for (let i of liked.body.items) {
        backup.liked_tracks.push(i.track.uri);
      }
      if (!liked.body.next) break;
      liked = await spotify.getMySavedTracks({
        limit: 50,
        offset: liked.body.offset + 50,
      });
    }

    return res.json(backup);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error exportando");
  }
});

// ------------------- IMPORT -------------------
app.post("/import", async (req, res) => {
  const data = req.body;

  try {
    const me = await spotify.getMe();
    const user_id = me.body.id;

    // Crear playlists
    for (let pl of data.playlists) {
      const newPl = await spotify.createPlaylist(pl.name, {
        public: pl.public,
      });

      for (let i = 0; i < pl.tracks.length; i += 100) {
        const chunk = pl.tracks.slice(i, i + 100);
        await spotify.addTracksToPlaylist(newPl.body.id, chunk);
      }
    }

    res.send("Importación completada");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error importando");
  }
});

// ------------------- SERVIDOR -------------------
app.listen(3000, () => console.log("Servidor corriendo en puerto 3000"));
