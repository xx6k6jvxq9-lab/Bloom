import {
  badRequest,
  enqueueWechatIncomingMessage,
  json,
  readRequestJson,
  resolveWebhookMessagePayload,
  serverError,
} from "../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../_lib/wechatBridgeBackend.js";

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const body = await readRequestJson(context.request);
  const payload = resolveWebhookMessagePayload(body);
  if (!payload.conversationId || !payload.text) {
    return badRequest("Unable to resolve conversationId or text from callback payload", {
      resolved: payload,
    });
  }

  try {
    const message = await enqueueWechatIncomingMessage(context.env, {
      conversationId: payload.conversationId,
      text: payload.text,
      senderDisplayName: payload.senderDisplayName,
    });

    if (!message) {
      return json(
        {
          accepted: false,
          reason: "No enabled binding for this conversationId",
          resolved: payload,
        },
        { status: 202 },
      );
    }

    return json({
      accepted: true,
      message,
    });
  } catch (error) {
    return serverError("Failed to handle Clawbot callback", error);
  }
}
