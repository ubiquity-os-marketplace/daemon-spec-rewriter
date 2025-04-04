import { createSpecRewriteSysMsg, llmQuery } from "../../../handlers/prompt";
import { Context } from "../../../types";
import { SuperOpenRouter } from "./open-router";
import OpenAI from "openai";
import { getOpenRouterModelTokenLimits, OpenRouterError, retry } from "@ubiquity-os/plugin-sdk/helpers";

export class OpenRouterCompletion extends SuperOpenRouter {
  constructor(client: OpenAI, context: Context) {
    super(client, context);
  }

  async getModelMaxTokenLimit(): Promise<number | undefined> {
    return (await getOpenRouterModelTokenLimits(this.context.config.openRouterAiModel))?.contextLength;
  }

  async getModelMaxOutputLimit(): Promise<number | undefined> {
    return (await getOpenRouterModelTokenLimits(this.context.config.openRouterAiModel))?.maxCompletionTokens;
  }

  async createCompletion(model: string, githubConversation: string[], botName: string, maxTokens: number): Promise<string> {
    const sysMsg = createSpecRewriteSysMsg(githubConversation, botName, this.context.payload.issue.user?.login);

    this.context.logger.debug(`System message: ${sysMsg}`);

    const res = await retry(
      async () => {
        return (await this.client.chat.completions.create({
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
          max_completion_tokens: maxTokens,
          temperature: 0,
        })) as OpenAI.Chat.Completions.ChatCompletion & OpenRouterError;
      },
      {
        maxRetries: this.context.config.maxRetryAttempts,
        onError: (err) => {
          this.context.logger.warn(`LLM Error, retrying...`, { err });
        },
      }
    );
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
      this.context.logger.info(`Number of tokens input tokens used: ${inputTokens}, Number of tokens output tokens generated: ${completionTokens}`);
    } else {
      this.context.logger.info(`LLM did not output usage statistics`);
    }

    return answer;
  }
}
