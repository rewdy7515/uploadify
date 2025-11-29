import json
import argparse
import datetime
import spotipy
from spotipy.oauth2 import SpotifyOAuth

# ============================
# CONFIGURACIÓN
# ============================
CLIENT_ID = "718853ddcbd949beb34aa6e55a5a3f85"
CLIENT_SECRET = "ae27c3b688124ec490ca5b6a45fd5d06"
REDIRECT_URI = "http://127.0.0.1:8080/callback"

SCOPE = (
    "playlist-read-private "
    "playlist-read-collaborative "''
    "playlist-modify-private "
    "playlist-modify-public "
    "user-library-read "
    "user-library-modify "
    "user-follow-read "
    "user-follow-modify"
)


def get_spotify(cache_path: str):
    auth_manager = SpotifyOAuth(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        redirect_uri=REDIRECT_URI,
        scope=SCOPE,
        cache_path=cache_path,
        open_browser=True,
    )
    sp = spotipy.Spotify(auth_manager=auth_manager)
    return sp


# ============================
# EXPORT
# ============================
def export_all(sp: spotipy.Spotify, output_file: str):
    user = sp.me()
    user_id = user["id"]
    print(f"Exportando datos de: {user_id}")

    data = {
        "version": 1,
        "exported_at": datetime.datetime.utcnow().isoformat() + "Z",
        "user_id": user_id,
        "playlists": [],
        "liked_tracks": [],
        "saved_albums": [],
        "followed_artists": [],
        "saved_shows": [],
        "saved_episodes": [],
    }

    # ---- Playlists ----
    print("Exportando playlists...")
    playlists = sp.current_user_playlists(limit=50)
    while playlists:
        for pl in playlists["items"]:
            pl_id = pl["id"]
            pl_name = pl["name"]
            print(f"  - {pl_name}")

            tracks_uris = []
            tracks = sp.playlist_tracks(pl_id, limit=100)
            while tracks:
                for item in tracks["items"]:
                    track = item.get("track")
                    if track and track.get("uri"):
                        tracks_uris.append(track["uri"])
                if tracks["next"]:
                    tracks = sp.next(tracks)
                else:
                    break

            data["playlists"].append(
                {
                    "name": pl_name,
                    "description": pl.get("description") or "",
                    "public": pl.get("public", False),
                    "collaborative": pl.get("collaborative", False),
                    "tracks": tracks_uris,
                }
            )

        if playlists["next"]:
            playlists = sp.next(playlists)
        else:
            break

    # ---- Liked tracks ----
    print("Exportando canciones guardadas (Liked Songs)...")
    results = sp.current_user_saved_tracks(limit=50)
    while results:
        for item in results["items"]:
            track = item.get("track")
            if track and track.get("uri"):
                data["liked_tracks"].append(track["uri"])
        if results["next"]:
            results = sp.next(results)
        else:
            break

    # ---- Saved albums ----
    print("Exportando álbumes guardados...")
    results = sp.current_user_saved_albums(limit=50)
    while results:
        for item in results["items"]:
            album = item.get("album")
            if album and album.get("id"):
                data["saved_albums"].append(album["id"])
        if results["next"]:
            results = sp.next(results)
        else:
            break

    # ---- Followed artists ----
    print("Exportando artistas seguidos...")
    results = sp.current_user_followed_artists(limit=50)
    while True:
        artists = results["artists"]
        for artist in artists["items"]:
            if artist.get("id"):
                data["followed_artists"].append(artist["id"])
        if artists["next"]:
            results = sp.next(artists)
        else:
            break

    # ---- Saved shows (podcasts) ----
    print("Exportando podcasts (shows guardados)...")
    results = sp.current_user_saved_shows(limit=50)
    while results:
        for item in results["items"]:
            show = item.get("show")
            if show and show.get("id"):
                data["saved_shows"].append(show["id"])
        if results["next"]:
            results = sp.next(results)
        else:
            break

    # ---- Saved episodes (si aplica) ----
    print("Exportando episodios guardados...")
    try:
        results = sp.current_user_saved_episodes(limit=50)
        while results:
            for item in results["items"]:
                ep = item.get("episode")
                if ep and ep.get("id"):
                    data["saved_episodes"].append(ep["id"])
            if results["next"]:
                results = sp.next(results)
            else:
                break
    except Exception as e:
        print("  (No se pudieron leer episodios guardados, se ignora)", e)

    # Guardar archivo
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"\n✔ Export completado → {output_file}")


# ============================
# IMPORT
# ============================
def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i: i + size]


def import_all(sp: spotipy.Spotify, input_file: str):
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    user_id = sp.me()["id"]
    print(f"Importando datos en cuenta: {user_id}")

    # ---- Playlists ----
    print("Importando playlists...")
    for pl in data.get("playlists", []):
        name = pl["name"]
        desc = pl.get("description", "")
        public = pl.get("public", False)

        print(f"  Creando playlist: {name}")
        new_pl = sp.user_playlist_create(
            user=user_id,
            name=name,
            public=public,
            description=desc,
        )
        new_id = new_pl["id"]

        uris = pl.get("tracks", [])
        for batch in chunk(uris, 100):
            try:
                sp.playlist_add_items(new_id, batch)
            except Exception as e:
                print(f"    Error agregando tracks (se continúa): {e}")

    # ---- Liked tracks ----
    print("Importando Liked Songs...")
    liked = data.get("liked_tracks", [])
    for batch in chunk(liked, 50):
        try:
            sp.current_user_saved_tracks_add(batch)
        except Exception as e:
            print(f"  Error guardando canciones: {e}")

    # ---- Saved albums ----
    print("Importando álbumes guardados...")
    albums = data.get("saved_albums", [])
    for batch in chunk(albums, 50):
        try:
            sp.current_user_saved_albums_add(batch)
        except Exception as e:
            print(f"  Error guardando álbumes: {e}")

    # ---- Followed artists ----
    print("Importando artistas seguidos...")
    artists = data.get("followed_artists", [])
    for batch in chunk(artists, 50):
        try:
            sp.user_follow_artists(batch)
        except Exception as e:
            print(f"  Error siguiendo artistas: {e}")

    # ---- Saved shows ----
    print("Importando podcasts (shows guardados)...")
    shows = data.get("saved_shows", [])
    for batch in chunk(shows, 50):
        try:
            sp.current_user_saved_shows_add(batch)
        except Exception as e:
            print(f"  Error guardando shows: {e}")

    # ---- Saved episodes ----
    print("Importando episodios guardados...")
    episodes = data.get("saved_episodes", [])
    for batch in chunk(episodes, 50):
        try:
            sp.current_user_saved_episodes_add(batch)
        except Exception as e:
            print(f"  Error guardando episodios: {e}")

    print("\n✔ Import completado.")


# ============================
# CLI
# ============================
def main():
    parser = argparse.ArgumentParser(
        description="Spotify full backup & migrate")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # export
    export_p = subparsers.add_parser(
        "export", help="Exportar datos de una cuenta")
    export_p.add_argument(
        "--file", "-f", default="spotify_full_backup.json", help="Archivo de salida"
    )
    export_p.add_argument(
        "--cache",
        default=".cache_old_account",
        help="Archivo de cache de token (para esta cuenta)",
    )

    # import
    import_p = subparsers.add_parser(
        "import", help="Importar datos a otra cuenta")
    import_p.add_argument(
        "--file", "-f", default="spotify_full_backup.json", help="Archivo de entrada"
    )
    import_p.add_argument(
        "--cache",
        default=".cache_new_account",
        help="Archivo de cache de token (para esta cuenta)",
    )

    args = parser.parse_args()

    if args.command == "export":
        sp = get_spotify(cache_path=args.cache)
        export_all(sp, args.file)
    elif args.command == "import":
        sp = get_spotify(cache_path=args.cache)
        import_all(sp, args.file)


if __name__ == "__main__":
    main()
