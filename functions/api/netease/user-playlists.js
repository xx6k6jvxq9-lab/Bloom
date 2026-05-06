import { badRequest, fetchNeteaseUserPlaylists, json, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const uid = (url.searchParams.get("uid") || "").trim();
  const rawLimit = Number(url.searchParams.get("limit") || 30);
  const rawOffset = Number(url.searchParams.get("offset") || 0);
  const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 30));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

  if (!uid) {
    return badRequest("Missing user ID");
  }

  try {
    return json(await fetchNeteaseUserPlaylists(uid, limit, offset));
  } catch (error) {
    return serverError("Failed to fetch user playlists", error);
  }
}
