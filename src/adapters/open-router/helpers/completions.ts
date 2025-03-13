import { createSpecRewriteSysMsg, llmQuery } from "../../../handlers/prompt";
import { Context } from "../../../types";
import { SuperOpenRouter } from "./open-router";
import OpenAI from "openai";

export class OpenRouterCompletion extends SuperOpenRouter {
  constructor(client: OpenAI, context: Context) {
    super(client, context);
  }

  getModelMaxTokenLimit(model: string): number {
    const tokenLimit = this.context.config.tokenLimit.context;
    if (!tokenLimit) {
      throw this.context.logger.error(`The token limits for configured model ${model} was not found`);
    }
    return tokenLimit;
  }

  getModelMaxOutputLimit(model: string): number {
    const tokenLimit = this.context.config.tokenLimit.completion;
    if (!tokenLimit) {
      throw this.context.logger.error(`The token limits for configured model ${model} was not found`);
    }
    return tokenLimit;
  }

  async createCompletion(model: string, githubConversation: string[], botName: string, maxTokens: number): Promise<string> {
    const sysMsg = createSpecRewriteSysMsg(githubConversation, botName);

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
      _request_id?: string | null;
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
    const outputTokens = res.usage?.completion_tokens;

    if (inputTokens && outputTokens) {
      this.context.logger.info(`Number of tokens used: ${inputTokens + outputTokens}`);
    } else {
      this.context.logger.info(`LLM did not output usage statistics`);
    }

    return answer;
  }
}
