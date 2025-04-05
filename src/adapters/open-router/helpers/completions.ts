import { createSpecRewriteSysMsg, llmQuery } from "../../../handlers/prompt";
import { Context } from "../../../types";
import { SuperOpenRouter } from "./open-router";
import OpenAI from "openai";
import { getOpenRouterModelTokenLimits, OpenRouterError, retry } from "@ubiquity-os/plugin-sdk/helpers";

export class OpenRouterCompletion extends SuperOpenRouter {
  constructor(client: OpenAI, context: Context) {
    super(client, context);
  }

  async getModelTokenLimits(): Promise<{ contextLength: number; maxCompletionTokens: number } | null> {
    return await getOpenRouterModelTokenLimits(this.context.config.openRouterAiModel);
  }

  async createCompletion(model: string, githubConversation: string[], botName: string, maxTokens: number): Promise<string> {
    const sysMsg = createSpecRewriteSysMsg(githubConversation, botName, this.context.payload.issue.user?.login);

    this.context.logger.debug(`System message: ${sysMsg}`);

    const llmResponse = await retry(
      async () => {
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
          max_completion_tokens: maxTokens,
          temperature: 0,
        })) as OpenAI.Chat.Completions.ChatCompletion | OpenRouterError;
        if ("error" in res) {
          throw this.context.logger.error(`LLM Error: ${res.error.message}`);
        }

        if (!res.choices || res.choices.length === 0) {
          throw this.context.logger.error("Unexpected no response from LLM: No choices returned.");
        }

        const answer = res.choices[0].message.content;
        if (!answer) {
          throw this.context.logger.error("Unexpected response format: Expected text block");
        }

        return { res, answer };
      },
      {
        maxRetries: this.context.config.maxRetryAttempts,
        onError: (err) => {
          this.context.logger.warn(`LLM Error, retrying...`, { err });
        },
      }
    );

    const inputTokens = llmResponse.res.usage?.prompt_tokens;
    const completionTokens = llmResponse.res.usage?.completion_tokens;

    if (inputTokens && completionTokens) {
      this.context.logger.info(`Number of tokens tokens used: ${inputTokens + completionTokens}`, { inputTokens, completionTokens });
    } else {
      this.context.logger.info(`LLM did not output usage statistics`);
    }

    return llmResponse.answer;
  }
}
