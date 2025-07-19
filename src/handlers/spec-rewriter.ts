import { Context } from "../types";
import { CallbackResult } from "../helpers/callback-proxy";
import { createSpecRewriteSysMsg, llmQuery } from "./prompt";
import { encode } from "gpt-tokenizer";
import { Comment } from "../types/github";

export type TokenLimits = {
  modelMaxTokenLimit: number;
  maxCompletionTokens: number;
  tokensRemaining: number;
};

export class SpecificationRewriter {
  protected readonly context: Context;
  readonly cooldown: number;

  constructor(context: Context) {
    this.context = context;

    this.cooldown = this.context.config.cooldown;
  }

  async performSpecRewrite(): Promise<CallbackResult> {
    const isCommandRewrite = this.context.command?.name === "rewrite";
    const isCommentRewrite = this._isIssueCommentEvent(this.context) && this.context.payload.comment.body.trim().startsWith("/rewrite");

    if (!isCommandRewrite && !isCommentRewrite && this._isIssueCommentEvent(this.context)) {
      return { status: 204, reason: this.context.logger.warn("Command is not /rewrite, Aborting!").logMessage.raw };
    }

    if (!(await this.canUserRewrite())) {
      throw this.context.logger.warn("You do not have sufficient permissions to rewrite the specification.");
    }

    const issueBody = this.context.payload.issue.body;
    const rewriterRegex = /<!-- daemon-spec-rewriter - (.*?) -->/;
    const match = issueBody?.match(rewriterRegex);

    if (match) {
      const lastRewriteTimestamp = new Date(match[1]);
      const currentTime = new Date();
      const elapsedTime = currentTime.getTime() - lastRewriteTimestamp.getTime();

      if (elapsedTime < this.cooldown) {
        this.context.logger.warn("Cooldown period active, Aborting!");
        const timeLeft = (this.cooldown - elapsedTime) / 1000 / 60;
        throw this.context.logger.warn(`Rewrite is currently on cooldown, Please try again after ${Math.ceil(timeLeft)} minutes`);
      }
    }
    const specOrCallback = await this.rewriteSpec();

    if (typeof specOrCallback === "object") {
      return specOrCallback as CallbackResult;
    }

    const rewrittenSpec = specOrCallback + "\n\n" + `<!-- daemon-spec-rewriter - ${new Date().toISOString()} -->`;
    await this.context.octokit.rest.issues.update({
      owner: this.context.payload.repository.owner.login,
      repo: this.context.payload.repository.name,
      issue_number: this.context.payload.issue.number,
      body: rewrittenSpec,
    });

    return { status: 200, reason: "Success" };
  }

  async rewriteSpec(): Promise<
    | string
    | {
        status: number;
        reason: string;
      }
  > {
    const {
      env: { UBIQUITY_OS_APP_NAME },
      config: { openRouterAiModel },
      adapters: {
        openRouter: { completions },
      },
    } = this.context;

    const sysPromptTokenCount = encode(createSpecRewriteSysMsg([], UBIQUITY_OS_APP_NAME, "")).length;
    const queryTokenCount = encode(llmQuery).length;
    const tokenLimit = await this.context.adapters.openRouter.completions.getModelTokenLimits();

    if (!tokenLimit) {
      throw this.context.logger.error(`The token limits for configured model ${this.context.config.openRouterAiModel} were not found`);
    }

    if (tokenLimit.contextLength === tokenLimit.maxCompletionTokens) {
      tokenLimit.maxCompletionTokens = tokenLimit.contextLength / 10;
    }

    const tokenLimits: TokenLimits = {
      modelMaxTokenLimit: tokenLimit.contextLength,
      maxCompletionTokens: tokenLimit.maxCompletionTokens,
      tokensRemaining: 0,
    };
    // what we start out with to include files
    tokenLimits.tokensRemaining = tokenLimits.modelMaxTokenLimit - tokenLimits.maxCompletionTokens - sysPromptTokenCount - queryTokenCount;
    // reduce 10% to accommodate token estimate
    tokenLimits.tokensRemaining = 0.9 * tokenLimits.tokensRemaining;
    const githubConversation = await this.fetchIssueConversation(this.context, tokenLimits);

    if (githubConversation.length === 1) {
      if (this._isIssueCommentEvent(this.context)) {
        throw this.context.logger.warn(`Skipping "/rewrite" as this issue doesn't have a conversation`);
      } else {
        return { status: 204, reason: this.context.logger.warn(`Skipping rewrite as this doesn't have a conversation`).logMessage.raw };
      }
    }
    const { specification, confidenceThreshold } = await completions.createCompletion(
      openRouterAiModel,
      githubConversation,
      UBIQUITY_OS_APP_NAME,
      tokenLimit.maxCompletionTokens
    );

    if (confidenceThreshold > 0.5) {
      return specification;
    } else {
      return githubConversation[0];
    }
  }

  async canUserRewrite() {
    const { sender, repository } = this.context.payload;
    const { login: repoOwner } = repository.owner;
    const { login: senderLogin, type: senderType } = sender;

    if (senderType === "Bot") return true;

    const octokit = this.context.octokit;

    try {
      const collaborators = (
        await octokit.rest.repos.listCollaborators({
          owner: repoOwner,
          repo: repository.name,
          affiliation: "direct",
        })
      ).data;

      const isCollaborator = collaborators.some((user) => user.login === senderLogin);
      if (isCollaborator) return true;

      if (repository.owner.type === "Organization") {
        const membership = await octokit.rest.orgs.getMembershipForUser({
          org: repoOwner,
          username: senderLogin,
        });

        const isAdmin = membership.data.role === "admin";
        if (isAdmin) return true;
      }

      return false;
    } catch (e) {
      this.context.logger.error(`Couldn't fetch user permissions, Error: ${e}`);
      return false;
    }
  }

  async fetchIssueConversation(context: Context, tokenLimits: TokenLimits): Promise<string[]> {
    const issue = context.payload.issue;
    if (!issue.body) {
      throw context.logger.error("Issue body not found, Aborting");
    }

    const conversation: string[] = [];
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueNumber = context.payload.issue.number;

    const issueBody = issue.body.replace(/^\s*<!-- daemon-spec-rewriter[\s\S]*?-->\s*$/gm, "");
    conversation.push(issueBody);

    const issueBodyTokenCount = encode(issueBody).length;
    tokenLimits.tokensRemaining -= issueBodyTokenCount;

    if (tokenLimits.tokensRemaining < 0) {
      context.logger.info("Token limit reached after adding issue body, returning conversation as is");
      return conversation;
    }

    // Fetch all comments for the issue and remove issue body
    const comments = await context.octokit.paginate(context.octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const filteredComments = comments
      .splice(1)
      .filter((comment) => comment.user?.type !== "Bot")
      .filter((comment) => comment.body && !/^\/\w+$/.test(comment.body.trim()));

    // add the newest comments which fit in the context from oldest to newest
    const sortedComments = filteredComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const selectedComments = await this.selectComments(sortedComments, tokenLimits);

    conversation.push(...selectedComments);
    return conversation;
  }

  async selectComments(sortedComments: Comment[], tokenLimits: TokenLimits) {
    const issue = this.context.payload.issue;
    if (!issue.user) {
      throw this.context.logger.error("Issue author not found, Aborting");
    }

    const conversation: string[] = [];
    for (const comment of sortedComments) {
      if (!comment.user) continue;

      const userLogin = comment.user.login;
      const userRoles = await this.getUserRoles(userLogin);

      const formattedComment = `${userLogin} (${userRoles.join(",")}): ${comment.body}`;
      const commentTokenCount = encode(formattedComment).length;

      if (tokenLimits.tokensRemaining < commentTokenCount) {
        this.context.logger.info("Token limit would be exceeded, stopping comment collection");
        break;
      }

      conversation.splice(1, 0, formattedComment);
      tokenLimits.tokensRemaining -= commentTokenCount;
    }

    return conversation;
  }

  async getUserRoles(username: string) {
    const issue = this.context.payload.issue;
    if (!issue.user) {
      throw this.context.logger.error("Issue author not found, Aborting");
    }
    const issueAuthor = issue.user.login;
    const issueAssignees = new Set(issue.assignees.map((assignee) => assignee?.login).filter(Boolean));

    const userRoles = [...(issueAuthor === username ? ["issue-author"] : []), ...(issueAssignees.has(username) ? ["assignee"] : [])];
    try {
      const { status } = await this.context.octokit.rest.repos.checkCollaborator({
        owner: this.context.payload.repository.owner.login,
        repo: this.context.payload.repository.name,
        username,
      });
      userRoles.push(status === 204 ? "collaborator" : "contributor");
    } catch (error) {
      this.context.logger.warn(`User is not a collaborator: ${error}`);
      userRoles.push("contributor");
    }
    return userRoles;
  }

  private _isIssueCommentEvent(context: Context): context is Context<"issue_comment.created"> {
    return "comment" in context.payload;
  }
}

export async function timeLabelChange(context: Context<"issues.labeled" | "issues.unlabeled">): Promise<CallbackResult> {
  if (context.payload.label?.name.toLowerCase().startsWith("time")) {
    const specificationRewriter = new SpecificationRewriter(context);
    return specificationRewriter.performSpecRewrite();
  } else {
    return { status: 204, reason: "Skipping spec rewrite because time label wasn't changed" };
  }
}
