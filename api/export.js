const { getSpotify } = require("./spotify");
const { parseCookies } = require("./cookies");

module.exports = async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.access;

    if (!token) return res.status(401).send("No logueado");

    const spotify = getSpotify();
    spotify.setAccessToken(token);

    res.writeHead(200, { "Content-Type": "application/x-ndjson" });

    const backup = {
      user: {},
      playlists: [],
      liked: [],
      albums: [],
      artists: [],
      podcasts: [],
    };

    const emit = (obj) => {
      res.write(JSON.stringify(obj) + "\n");
    };

    // perfil
    const me = await spotify.getMe();
    backup.user = {
      id: me.body?.id,
      name: me.body?.display_name,
      image: me.body?.images?.[0]?.url || null,
      country: me.body?.country,
      product: me.body?.product,
    };

    // estimar trabajo total
    const totals = {
      playlists: me.body?.product ? 0 : 0,
    };

    const firstPlaylists = await spotify.getUserPlaylists({ limit: 50, offset: 0 });
    totals.playlists = firstPlaylists.body.total || firstPlaylists.body.items.length;

    const firstLiked = await spotify.getMySavedTracks({ limit: 1, offset: 0 });
    totals.liked = firstLiked.body.total || 0;

    const firstAlbums = await spotify.getMySavedAlbums({ limit: 1, offset: 0 });
    totals.albums = firstAlbums.body.total || 0;

    const firstArtists = await spotify.getFollowedArtists({ limit: 1 });
    totals.artists = firstArtists.body.artists?.total || firstArtists.body.artists.items.length || 0;

    const firstShows = await spotify.getMySavedShows({ limit: 1, offset: 0 });
    totals.podcasts = firstShows.body.total || 0;

    let totalWork =
      1 + // profile
      totals.playlists +
      totals.liked +
      totals.albums +
      totals.artists +
      totals.podcasts;

    // sum track totals for playlists to acercar a progreso real
    const playlistTrackTotals = new Map();
    for (let pl of firstPlaylists.body.items) {
      playlistTrackTotals.set(pl.id, pl.tracks?.total || 0);
      totalWork += pl.tracks?.total || 0;
    }

    let workDone = 0;
    const update = () => {
      const pct = Math.min(100, Math.round((workDone / Math.max(1, totalWork)) * 100));
      emit({ type: "progress", percent: pct });
    };

    // perfil completado
    workDone += 1;
    update();

    // playlists (paginadas)
    let plOffset = 0;
    let playlistsPage = firstPlaylists;
    do {
      for (let pl of playlistsPage.body.items) {
        const tracks = [];
        const trackTotal = playlistTrackTotals.get(pl.id) ?? pl.tracks?.total ?? 0;

        let trackOffset = 0;
        let trackPage;
        do {
          trackPage = await spotify.getPlaylistTracks(pl.id, { limit: 100, offset: trackOffset });
          for (let it of trackPage.body.items) {
            if (it.track?.uri) tracks.push(it.track.uri);
          }
          trackOffset += trackPage.body.items.length;
          workDone += trackPage.body.items.length;
          update();
        } while (trackPage.body.next);

        backup.playlists.push({
          name: pl.name,
          public: pl.public,
          tracks,
        });
        workDone += 1;
        // si el total era 0, avanzamos un poco
        if (trackTotal === 0) workDone += 1;
        update();
      }
      plOffset += playlistsPage.body.items.length;
      if (playlistsPage.body.next) {
        playlistsPage = await spotify.getUserPlaylists({ limit: 50, offset: plOffset });
        for (let pl of playlistsPage.body.items) {
          totalWork += pl.tracks?.total || 0;
          playlistTrackTotals.set(pl.id, pl.tracks?.total || 0);
        }
      }
    } while (playlistsPage.body.next);

    // liked tracks (paginadas)
    let likedOffset = 0;
    let likedPage = firstLiked;
    do {
      for (let it of likedPage.body.items) {
        if (it.track?.uri) backup.liked.push(it.track.uri);
      }
      likedOffset += likedPage.body.items.length;
      workDone += likedPage.body.items.length;
      update();
      if (likedPage.body.next) {
        likedPage = await spotify.getMySavedTracks({ limit: 50, offset: likedOffset });
      }
    } while (likedPage.body.next);

    // albums guardados
    let albumOffset = 0;
    let albumPage = firstAlbums;
    do {
      for (let it of albumPage.body.items) {
        if (it.album?.uri) backup.albums.push(it.album.uri);
      }
      albumOffset += albumPage.body.items.length;
      workDone += albumPage.body.items.length;
      update();
      if (albumPage.body.next) {
        albumPage = await spotify.getMySavedAlbums({ limit: 20, offset: albumOffset });
      }
    } while (albumPage.body.next);

    // artistas seguidos (cursor)
    let artistAfter = undefined;
    let artistPage = firstArtists;
    do {
      for (let it of artistPage.body.artists.items) {
        if (it.uri) backup.artists.push(it.uri);
      }
      workDone += artistPage.body.artists.items.length;
      update();
      artistAfter = artistPage.body.artists.cursors?.after;
      if (artistAfter) {
        artistPage = await spotify.getFollowedArtists({ limit: 50, after: artistAfter });
      }
    } while (artistPage.body.artists.next);

    // podcasts (shows guardados)
    let showOffset = 0;
    let showPage = firstShows;
    do {
      for (let it of showPage.body.items) {
        if (it.show?.uri) backup.podcasts.push(it.show.uri);
      }
      showOffset += showPage.body.items.length;
      workDone += showPage.body.items.length;
      update();
      if (showPage.body.next) {
        showPage = await spotify.getMySavedShows({ limit: 50, offset: showOffset });
      }
    } while (showPage.body.next);

    emit({ type: "progress", percent: 100 });
    emit({
      type: "data",
      payload: backup,
      counts: {
        userName: backup.user?.name ? 1 : 0,
        profileImage: backup.user?.image ? 1 : 0,
        playlists: backup.playlists.length,
        liked: backup.liked.length,
        albums: backup.albums.length,
        artists: backup.artists.length,
        podcasts: backup.podcasts.length,
      },
    });
    res.end();
  } catch (err) {
    console.log(err);
    res.status(500).send("Error al exportar");
  }
};
