export function getWechatBridgeDurableObject(env) {
  return env?.WECHAT_BRIDGE_DO || null;
}

export async function forwardToWechatBridgeDurableObject(context) {
  const namespace = getWechatBridgeDurableObject(context.env);
  if (!namespace) {
    return null;
  }

  const id = namespace.idFromName("global");
  const stub = namespace.get(id);
  return stub.fetch(context.request.clone());
}
