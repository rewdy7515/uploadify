import { getSpotify } from "./spotify.js";

export default async function handler(req, res) {
  const spotify = getSpotify();

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
  res.writeHead(302, { Location: url }).end();
}
