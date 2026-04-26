import {
  json,
  pullWechatIncomingMessages,
  serverError,
} from "../../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../../_lib/wechatBridgeBackend.js";

export async function onRequestPost(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  try {
    const messages = await pullWechatIncomingMessages(context.env);
    return json({ messages });
  } catch (error) {
    return serverError("Failed to pull WeChat incoming messages", error);
  }
}
