import {
  disableWechatBindingByCharacterId,
  getWechatBindingByCharacterId,
  json,
  serverError,
} from "../../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../../_lib/wechatBridgeBackend.js";

export async function onRequestGet(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  try {
    const binding = await getWechatBindingByCharacterId(
      context.env,
      String(context.params.characterId || "").trim(),
      context.request.url ? new URL(context.request.url).searchParams.get("bloomUserId")?.trim() : undefined,
    );
    return json({ binding });
  } catch (error) {
    return serverError("Failed to load WeChat binding", error);
  }
}

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const url = new URL(context.request.url);
  if (!url.pathname.endsWith("/disable")) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const binding = await disableWechatBindingByCharacterId(
      context.env,
      String(context.params.characterId || "").trim(),
      context.request.url ? new URL(context.request.url).searchParams.get("bloomUserId")?.trim() : undefined,
    );
    return json({ binding });
  } catch (error) {
    return serverError("Failed to disable WeChat binding", error);
  }
}
