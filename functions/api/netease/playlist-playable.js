import { badRequest, fetchPlayableNeteasePlaylist, json, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) {
    return badRequest("Missing playlist ID");
  }

  try {
    return json(await fetchPlayableNeteasePlaylist(id));
  } catch (error) {
    return serverError("Failed to fetch playable playlist data", error);
  }
}
