import {
  badRequest,
  enqueueWechatOutgoingMessage,
  json,
  readRequestJson,
  serverError,
} from "../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../_lib/wechatBridgeBackend.js";

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const body = await readRequestJson(context.request);
  const conversationId = String(body?.conversationId || "").trim();
  const characterId = String(body?.characterId || "").trim();
  const text = String(body?.text || "").trim();
  if (!conversationId || !characterId || !text) {
    return badRequest("Missing conversationId, characterId or text");
  }

  try {
    const message = await enqueueWechatOutgoingMessage(context.env, {
      conversationId,
      characterId,
      text,
      replyToMessageId: typeof body?.replyToMessageId === "string" ? body.replyToMessageId.trim() : undefined,
      characterName: typeof body?.characterName === "string" ? body.characterName.trim() : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : undefined,
    });

    if (!message) {
      return json({ error: "No enabled binding for this conversationId and characterId" }, { status: 404 });
    }

    return json({ message });
  } catch (error) {
    return serverError("Failed to enqueue WeChat outgoing message", error);
  }
}
