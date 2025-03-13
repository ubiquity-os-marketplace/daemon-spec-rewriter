import { Context } from "../types";
import { OpenRouterCompletion } from "./open-router/helpers/completions";
import { SuperOpenRouter } from "./open-router/helpers/open-router";
import OpenAI from "openai";

export function createAdapters(openRouter: OpenAI, context: Context) {
  return {
    openRouter: {
      completions: new OpenRouterCompletion(openRouter, context),
      super: new SuperOpenRouter(openRouter, context),
    },
  };
}
