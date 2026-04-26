import {
  badRequest,
  json,
  markWechatBindSessionBound,
  readRequestJson,
  resolveOpenClawConnectPayload,
  serverError,
} from "../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../_lib/wechatBridgeBackend.js";

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  const body = await readRequestJson(context.request);
  const payload = resolveOpenClawConnectPayload(body, context.request.url);

  if (!payload.token) {
    return badRequest("Missing bind token in OpenClaw callback", { resolved: payload });
  }

  if (!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) {
    return badRequest("Missing WeChat identity in OpenClaw callback", { resolved: payload });
  }

  try {
    const result = await markWechatBindSessionBound(context.env, payload.token, {
      conversationId: payload.conversationId,
      wechatIdentity: payload.wechatIdentity,
      channelAccountId: payload.channelAccountId,
      channelPeerId: payload.channelPeerId,
      openClawPairingId: payload.openClawPairingId,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
    });

    if (!result) {
      return json({ error: "Bind session not found", resolved: payload }, { status: 404 });
    }

    return json({ connected: true, ...result });
  } catch (error) {
    return serverError("Failed to process OpenClaw connect callback", error);
  }
}
