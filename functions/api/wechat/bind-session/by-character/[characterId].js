import {
  getWechatBindSessionByCharacterId,
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
    const session = await getWechatBindSessionByCharacterId(context.env, String(context.params.characterId || "").trim());
    return json({ session });
  } catch (error) {
    return serverError("Failed to load WeChat bind session", error);
  }
}
