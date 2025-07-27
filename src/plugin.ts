import { Context } from "./types/context";
import { createAdapters } from "./adapters";
import { callCallbacks } from "./helpers/callback-proxy";
import OpenAI from "openai";

export async function plugin(context: Context) {
  const { env, config } = context;

  const openRouterClient = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: config.openRouterBaseUrl,
  });
  context.adapters = createAdapters(openRouterClient, context);
  return await callCallbacks(context, context.eventName);
}
