import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

export const verifyGoogleToken = async (code) => {
  try {
    const { tokens } = await client.getToken({
      code,
      // 'postmessage' is strictly required here because the frontend uses @react-oauth/google with useGoogleLogin
      // It sets redirect_uri to 'postmessage' under the hood. Any other domain here will cause redirect_uri_mismatch!
      redirect_uri: "postmessage",
    });

    const loginTicket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const userData = loginTicket.getPayload();

    return userData;
  } catch (error) {
    console.log(error);
    throw new Error(error.message || "Failed to verify Google token");
  }
};
