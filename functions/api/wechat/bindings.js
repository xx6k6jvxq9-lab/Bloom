import {
  getWechatBindingsOverview,
  json,
  serverError,
} from "../../_lib/wechatBridgeStore.js";
import { forwardToWechatBridgeDurableObject } from "../../_lib/wechatBridgeBackend.js";

export async function onRequestGet(context) {
  const durableObjectResponse = await forwardToWechatBridgeDurableObject(context);
  if (durableObjectResponse) {
    return durableObjectResponse;
  }

  try {
    const overview = await getWechatBindingsOverview(context.env);
    return json(overview);
  } catch (error) {
    return serverError("Failed to load WeChat bindings overview", error);
  }
}
