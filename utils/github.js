import { GitHub } from "arctic";

const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
const redirect_uri = process.env.GITHUB_REDIRECT_URI;

export const github = new GitHub(clientId, clientSecret, redirect_uri);
