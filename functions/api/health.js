import { json } from "../_lib/musicProxy.js";

export async function onRequestGet() {
  return json({ status: "ok" });
}
