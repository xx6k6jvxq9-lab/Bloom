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
  const text = String(body?.text || "").trim();
  if (!conversationId || !text) {
    return badRequest("Missing conversationId or text");
  }

  try {
    const message = await enqueueWechatIncomingMessage(context.env, {
      conversationId,
      text,
      senderDisplayName: typeof body?.senderDisplayName === "string" ? body.senderDisplayName.trim() : undefined,
    });

    if (!message) {
      return json({ error: "No enabled binding for this conversationId" }, { status: 404 });
    }

    return json({ message });
  } catch (error) {
    return serverError("Failed to enqueue WeChat incoming message", error);
  }
}
