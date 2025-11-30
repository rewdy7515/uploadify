const { getSpotify } = require("./spotify");
const { parseCookies } = require("./cookies");

module.exports = async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.access;

    if (!token) return res.status(401).send("No logueado");

    const spotify = getSpotify();
    spotify.setAccessToken(token);

    const backup = req.body || {};
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });

    const emit = (obj) => res.write(JSON.stringify(obj) + "\n");

    const totals = {
      playlists: backup.playlists?.length || 0,
      liked: backup.liked?.length || 0,
      albums: backup.albums?.length || 0,
      artists: backup.artists?.length || 0,
      podcasts: backup.podcasts?.length || 0,
    };

    let totalWork =
      totals.playlists +
      totals.liked +
      totals.albums +
      totals.artists +
      totals.podcasts;

    const playlistTrackTotals =
      backup.playlists?.reduce(
        (acc, pl) => acc + (pl.tracks?.length || 0),
        0
      ) || 0;
    totalWork += playlistTrackTotals;

    let workDone = 0;
    const update = () => {
      const pct = Math.min(
        100,
        Math.round((workDone / Math.max(totalWork, 1)) * 100)
      );
      emit({ type: "progress", percent: pct });
    };

    // playlists
    if (Array.isArray(backup.playlists)) {
      for (let pl of backup.playlists) {
        const newPl = await spotify.createPlaylist(pl.name || "Migrated playlist", {
          public: pl.public,
        });
        workDone += 1;
        update();

        if (Array.isArray(pl.tracks)) {
          for (let i = 0; i < pl.tracks.length; i += 100) {
            const slice = pl.tracks.slice(i, i + 100);
            await spotify.addTracksToPlaylist(newPl.body.id, slice);
            workDone += slice.length;
            update();
          }
        }
      }
    }

    // liked tracks
    if (Array.isArray(backup.liked)) {
      for (let i = 0; i < backup.liked.length; i += 50) {
        const slice = backup.liked.slice(i, i + 50);
        await spotify.addToMySavedTracks(slice);
        workDone += slice.length;
        update();
      }
    }

    // albums guardados
    if (Array.isArray(backup.albums)) {
      for (let i = 0; i < backup.albums.length; i += 20) {
        const slice = backup.albums.slice(i, i + 20);
        await spotify.addToMySavedAlbums(slice);
        workDone += slice.length;
        update();
      }
    }

    // artistas seguidos
    if (Array.isArray(backup.artists)) {
      for (let i = 0; i < backup.artists.length; i += 50) {
        const slice = backup.artists.slice(i, i + 50);
        await spotify.followArtists(slice);
        workDone += slice.length;
        update();
      }
    }

    // podcasts (shows guardados)
    if (Array.isArray(backup.podcasts)) {
      for (let i = 0; i < backup.podcasts.length; i += 50) {
        const slice = backup.podcasts.slice(i, i + 50);
        await spotify.addToMySavedShows(slice);
        workDone += slice.length;
        update();
      }
    }

    emit({ type: "progress", percent: 100 });
    emit({ type: "done" });
    res.end();
  } catch (err) {
    console.log(err);
    res.status(500).send("Error al importar");
  }
};
