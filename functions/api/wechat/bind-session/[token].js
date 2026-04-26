import {
  badRequest,
  getWechatBindSessionByToken,
  json,
  markWechatBindSessionBound,
  readRequestJson,
  serverError,
} from "../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../_lib/wechatBridgeBackend.js";

export async function onRequestGet(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  try {
    const session = await getWechatBindSessionByToken(context.env, String(context.params.token || "").trim());
    return json({ session });
  } catch (error) {
    return serverError("Failed to load WeChat bind session", error);
  }
}

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const url = new URL(context.request.url);
  if (!url.pathname.endsWith("/bind")) {
    return new Response("Not Found", { status: 404 });
  }

  const body = await readRequestJson(context.request);
  const conversationId = String(body?.conversationId || "").trim();
  if (!conversationId) {
    return badRequest("Missing conversationId");
  }

  try {
    const result = await markWechatBindSessionBound(context.env, String(context.params.token || "").trim(), {
      conversationId,
      displayName: typeof body?.displayName === "string" ? body.displayName.trim() : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : undefined,
    });

    if (!result) {
      return json({ error: "Bind session not found" }, { status: 404 });
    }

    return json(result);
  } catch (error) {
    return serverError("Failed to bind WeChat session", error);
  }
}
