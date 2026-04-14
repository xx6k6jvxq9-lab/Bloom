import { badRequest, json, searchNeteaseSongs, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keywords = (url.searchParams.get("keywords") || "").trim();
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 12)));

  if (!keywords) {
    return badRequest("Missing keywords");
  }

  try {
    return json(await searchNeteaseSongs(keywords, limit));
  } catch (error) {
    return serverError("Failed to search music", error);
  }
}
