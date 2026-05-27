import { badRequest, json, resolveNeteaseShareInputToUrl, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const input = (new URL(context.request.url).searchParams.get("input") || "").trim();
  if (!input) {
    return badRequest("Missing share input");
  }

  try {
    const url = await resolveNeteaseShareInputToUrl(input);
    if (!url) {
      return badRequest("Unable to resolve NetEase share input");
    }

    return json({ url });
  } catch (error) {
    return serverError("Failed to resolve NetEase share input", error);
  }
}
