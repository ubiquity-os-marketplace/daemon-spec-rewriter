import { Context } from "../types";
import { OpenRouterCompletion } from "./open-router/helpers/completions";
import OpenAI from "openai";

export function createAdapters(openRouter: OpenAI, context: Context) {
  return {
    openRouter: {
      completions: new OpenRouterCompletion(openRouter, context),
    },
  };
}
