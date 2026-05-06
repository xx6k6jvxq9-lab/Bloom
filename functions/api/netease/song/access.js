import { badRequest, json, resolveNeteaseSongAccess, serverError } from "../../../_lib/musicProxy.js";

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) {
    return badRequest("Missing song ID");
  }

  try {
    return json(await resolveNeteaseSongAccess(id));
  } catch (error) {
    return serverError("Failed to resolve song access", error);
  }
}
