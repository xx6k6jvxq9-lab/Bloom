import { badRequest, proxyNeteaseCover, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const src = new URL(context.request.url).searchParams.get("src");
  if (!src) {
    return badRequest("Missing cover source");
  }

  try {
    return await proxyNeteaseCover(context.request, src);
  } catch (error) {
    return serverError("Failed to proxy NetEase cover", error);
  }
}
