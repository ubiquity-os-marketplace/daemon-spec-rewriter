import { Context } from "./types/context";
import { callCallbacks } from "./helpers/callback-proxy";

export async function plugin(context: Context) {
  return await callCallbacks(context, context.eventName);
}
