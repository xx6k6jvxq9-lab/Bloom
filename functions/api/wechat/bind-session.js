import {
  badRequest,
  createWechatBindSession,
  getAppOrigin,
  json,
  readRequestJson,
  serverError,
} from "../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../_lib/wechatBridgeBackend.js";

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const body = await readRequestJson(context.request);
  const characterId = String(body?.characterId || "").trim();
  if (!characterId) {
    return badRequest("Missing characterId");
  }

  try {
    const session = await createWechatBindSession(context.env, characterId, getAppOrigin(context.request));
    return json(session);
  } catch (error) {
    return serverError("Failed to create WeChat bind session", error);
  }
}
