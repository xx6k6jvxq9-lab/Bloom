import {
  badRequest,
  enqueueWechatIncomingMessage,
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
  const conversationId = String(body?.conversationId || "").trim();
  const wechatIdentity = String(body?.wechatIdentity || "").trim();
  const channelPeerId = String(body?.channelPeerId || "").trim();
  const text = String(body?.text || "").trim();
  if ((!conversationId && !wechatIdentity && !channelPeerId) || !text) {
    return badRequest("Missing WeChat identity or text");
  }

  try {
    const message = await enqueueWechatIncomingMessage(context.env, {
      conversationId: conversationId || undefined,
      wechatIdentity: wechatIdentity || undefined,
      channelAccountId: typeof body?.channelAccountId === "string" ? body.channelAccountId.trim() : undefined,
      channelPeerId: channelPeerId || undefined,
      text,
      senderDisplayName: typeof body?.senderDisplayName === "string" ? body.senderDisplayName.trim() : undefined,
    });

    if (!message) {
      return json({ error: "No enabled binding for this WeChat identity" }, { status: 404 });
    }

    return json({ message });
  } catch (error) {
    return serverError("Failed to enqueue WeChat incoming message", error);
  }
}
