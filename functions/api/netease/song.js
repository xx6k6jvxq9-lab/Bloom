import { badRequest, proxyNeteaseSong, serverError } from "../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const id = context.request.url ? new URL(context.request.url).searchParams.get("id") : null;
  if (!id) {
    return badRequest("Missing song ID");
  }

  try {
    return await proxyNeteaseSong(context.request, id);
  } catch (error) {
    return serverError("Failed to proxy song", error);
  }
}
