import { badRequest, json, searchFreeToUseMusic, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = (url.searchParams.get("query") || "").trim();
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 30)));

  if (!query) {
    return badRequest("Missing query");
  }

  try {
    return json(await searchFreeToUseMusic(query, limit));
  } catch (error) {
    return serverError("Failed to search Free To Use music", error);
  }
}
