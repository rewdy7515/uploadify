import SpotifyWebApi from "spotify-web-api-node";

export function getSpotify() {
  return new SpotifyWebApi({
    clientId: process.env.SP_CLIENT_ID,
    clientSecret: process.env.SP_CLIENT_SECRET,
    redirectUri: process.env.SP_REDIRECT_URI,
  });
}
