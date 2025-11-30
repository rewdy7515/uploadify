const SpotifyWebApi = require("spotify-web-api-node");

function getSpotify() {
  const required = ["SP_CLIENT_ID", "SP_CLIENT_SECRET", "SP_REDIRECT_URI"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno Spotify: ${missing.join(", ")}`
    );
  }

  return new SpotifyWebApi({
    clientId: process.env.SP_CLIENT_ID,
    clientSecret: process.env.SP_CLIENT_SECRET,
    redirectUri: process.env.SP_REDIRECT_URI,
  });
}

module.exports = { getSpotify };
//
