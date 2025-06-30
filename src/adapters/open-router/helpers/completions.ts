import { createSpecRewriteSysMsg, llmQuery } from "../../../handlers/prompt";
import { SuperOpenRouter } from "./open-router";
import OpenAI from "openai";
import { getOpenRouterModelTokenLimits, OpenRouterError, retry } from "@ubiquity-os/plugin-sdk/helpers";

export class OpenRouterCompletion extends SuperOpenRouter {
  async getModelTokenLimits(): Promise<{ contextLength: number; maxCompletionTokens: number } | null> {
    return await getOpenRouterModelTokenLimits(this.context.config.openRouterAiModel);
  }

  async createCompletion(model: string, githubConversation: string[], botName: string, maxTokens: number) {
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
        const output = this.validateReviewOutput(answer);

        return { res, output };
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
    return llmResponse.output;
  }

  validateReviewOutput(reviewString: string) {
    let rewriteOutput: { confidenceThreshold: number; specification: string };

    function stripCodeFences(text: string): string {
      return text.replace(/```(?:\w+)?\s*([\s\S]*?)\s*```/, "$1").trim();
    }

    try {
      const cleanedReview = stripCodeFences(reviewString);
      rewriteOutput = JSON.parse(cleanedReview);
    } catch (err) {
      throw this.context.logger.error("Couldn't parse JSON output; Aborting", {
        err,
        reviewString,
      });
    }

    if (typeof rewriteOutput.specification !== "string") {
      throw this.context.logger.error("LLM failed to output review comment successfully");
    }

    const confidenceThreshold = rewriteOutput.confidenceThreshold;
    if (Number.isNaN(Number(confidenceThreshold))) {
      throw this.context.logger.error("LLM failed to output a confidence threshold successfully");
    }

    return {
      confidenceThreshold: Number(confidenceThreshold),
      specification: rewriteOutput.specification,
    };
  }
}
