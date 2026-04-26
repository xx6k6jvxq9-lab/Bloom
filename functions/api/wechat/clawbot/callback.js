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
  if ((!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) || !payload.text) {
    return badRequest("Unable to resolve WeChat identity or text from callback payload", {
      resolved: payload,
    });
  }

  try {
    const message = await enqueueWechatIncomingMessage(context.env, {
      conversationId: payload.conversationId,
      wechatIdentity: payload.wechatIdentity,
      channelAccountId: payload.channelAccountId,
      channelPeerId: payload.channelPeerId,
      text: payload.text,
      senderDisplayName: payload.senderDisplayName,
    });

    if (!message) {
      return json(
        {
          accepted: false,
          reason: "No enabled binding for this WeChat identity",
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
