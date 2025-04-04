import { fetchIssueConversation } from "../helpers/conversation-parsing";
import { Context } from "../types";
import { CallbackResult } from "../types/proxy";
import { createSpecRewriteSysMsg, llmQuery } from "./prompt";
import { TokenLimits } from "../helpers/conversation-parsing";
import { encode } from "gpt-tokenizer";

export class SpecificationRewriter {
  protected readonly context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async performSpecRewrite(): Promise<CallbackResult> {
    if (this._isIssueCommentEvent(this.context)) {
      if (this.context.payload.comment.body.trim().startsWith("/rewrite")) {
        throw this.context.logger.error("Command is not /rewrite, Aborting!");
      }
    }

    if (!(await this.canUserRewrite())) {
      throw this.context.logger.error("User does not have sufficient permissions to rewrite spec");
    }

    const rewrittenSpec = await this.rewriteSpec();

    await this.context.octokit.rest.issues.update({
      owner: this.context.payload.repository.owner.login,
      repo: this.context.payload.repository.name,
      issue_number: this.context.payload.issue.number,
      body: rewrittenSpec,
    });

    return { status: 200, reason: "Success" };
  }

  async rewriteSpec() {
    const {
      env: { UBIQUITY_OS_APP_NAME },
      config: { openRouterAiModel },
      adapters: {
        openRouter: { completions },
      },
    } = this.context;

    const sysPromptTokenCount = encode(createSpecRewriteSysMsg([], UBIQUITY_OS_APP_NAME, "")).length;
    const queryTokenCount = encode(llmQuery).length;

    const modelMaxTokenLimit = await this.context.adapters.openRouter.completions.getModelMaxTokenLimit();
    const maxCompletionTokens = await this.context.adapters.openRouter.completions.getModelMaxOutputLimit();

    if (!modelMaxTokenLimit || !maxCompletionTokens) {
      throw this.context.logger.error(`The token limits for configured model ${this.context.config.openRouterAiModel} were not found`);
    }
    const tokenLimits: TokenLimits = {
      modelMaxTokenLimit,
      maxCompletionTokens,
      tokensRemaining: 0,
    };

    // what we start out with to include files
    tokenLimits.tokensRemaining = tokenLimits.modelMaxTokenLimit - tokenLimits.maxCompletionTokens - sysPromptTokenCount - queryTokenCount;
    // reduce 10% to accomodate token estimate
    tokenLimits.tokensRemaining = 0.9 * tokenLimits.tokensRemaining;
    const githubConversation = await fetchIssueConversation(this.context, tokenLimits);

    return await completions.createCompletion(openRouterAiModel, githubConversation, UBIQUITY_OS_APP_NAME, maxCompletionTokens);
  }

  async canUserRewrite() {
    const checkRewrite = await this.context.octokit.rest.repos.checkCollaborator({
      owner: this.context.payload.repository.owner.login,
      repo: this.context.payload.repository.name,
      username: this.context.payload.sender.login,
    });
    return checkRewrite.status == 204;
  }

  private _isIssueCommentEvent(context: Context<"issue_comment.created" | "issues.labeled">): context is Context<"issue_comment.created"> {
    return "comment" in context.payload;
  }
}

export async function timeLabelChange(context: Context<"issues.labeled">): Promise<CallbackResult> {
  if (context.payload.label?.name.toLowerCase().startsWith("time")) {
    const specificationRewriter = new SpecificationRewriter(context);
    return specificationRewriter.performSpecRewrite();
  } else {
    return { status: 204, reason: "Skipping spec rewrite because time label wasn't changed" };
  }
}
