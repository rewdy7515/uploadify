import { getSpotify } from "./spotify.js";

export default async function handler(req, res) {
  const code = req.query.code;

  const spotify = getSpotify();

  try {
    const tokenData = await spotify.authorizationCodeGrant(code);

    res.setHeader("Set-Cookie", [
      `access=${tokenData.body.access_token}; Path=/; HttpOnly`,
      `refresh=${tokenData.body.refresh_token}; Path=/; HttpOnly`,
    ]);

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error autenticando con Spotify");
  }
}
