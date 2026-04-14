import { badRequest, json, searchNeteaseRadioPrograms, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const keywords = (url.searchParams.get("keywords") || "").trim();
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit") || 6)));

  if (!keywords) {
    return badRequest("Missing keywords");
  }

  try {
    return json(await searchNeteaseRadioPrograms(keywords, limit));
  } catch (error) {
    return serverError("Failed to search NetEase radio", error);
  }
}
