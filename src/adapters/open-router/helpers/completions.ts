import { createSpecRewriteSysMsg, llmQuery } from "../../../handlers/prompt";
import { Context } from "../../../types";
import { SuperOpenRouter } from "./open-router";
import OpenAI from "openai";

interface Model {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: object;
  pricing: object;
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  per_request_limits: object;
}

export class OpenRouterCompletion extends SuperOpenRouter {
  constructor(client: OpenAI, context: Context) {
    super(client, context);
  }

  async getModelMaxTokenLimit(): Promise<number | null> {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const data = (await response.json()) as { data: Model[] };
    const model = data["data"].find((m: Model) => m.id === this.context.config.openRouterAiModel);
    return model ? model.top_provider.context_length : null;
  }

  async getModelMaxOutputLimit(): Promise<number | null> {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const data = (await response.json()) as { data: Model[] };
    const model = data["data"].find((m: Model) => m.id === this.context.config.openRouterAiModel);
    return model ? model.top_provider.max_completion_tokens : null;
  }

  async createCompletion(model: string, githubConversation: string[], botName: string, maxTokens: number): Promise<string> {
    const sysMsg = createSpecRewriteSysMsg(githubConversation, botName, this.context.payload.issue.user?.login);

    this.context.logger.debug(`System message: ${sysMsg}`);

    const res = (await this.client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: sysMsg,
        },
        {
          role: "user",
          content: llmQuery,
        },
      ],
      max_tokens: maxTokens,
      temperature: 0,
    })) as OpenAI.Chat.Completions.ChatCompletion & {
      error: { message: string; code: number; metadata: object } | undefined;
    };

    if (!res.choices || res.choices.length === 0) {
      throw this.context.logger.error(`Unexpected no response from LLM, Reason: ${res.error ? res.error.message : "No reason specified"}`);
    }

    const answer = res.choices[0].message.content;
    if (!answer) {
      throw this.context.logger.error("Unexpected response format: Expected text block");
    }

    const inputTokens = res.usage?.prompt_tokens;
    const completionTokens = res.usage?.completion_tokens;

    if (inputTokens && completionTokens) {
      this.context.logger.info(`Number of tokens used: ${inputTokens + completionTokens}`);
    } else {
      this.context.logger.info(`LLM did not output usage statistics`);
    }

    return answer;
  }
}
