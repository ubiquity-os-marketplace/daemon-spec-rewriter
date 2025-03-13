import { encodeAsync, fetchIssueConversation } from "../helpers/conversation-parsing";
import { Context } from "../types";
import { CallbackResult } from "../types/proxy";
import { createSpecRewriteSysMsg, llmQuery } from "./prompt";
import { TokenLimits } from "../helpers/conversation-parsing";

export const ADMIN_ROLES = ["admin", "owner", "billing_manager"];
export const COLLABORATOR_ROLES = ["write", "member", "collaborator"];

export class SpecificationRewriter {
  readonly context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async performSpecRewrite(): Promise<CallbackResult> {
    if (!(await this.canUserRewrite(this.context))) {
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

    const sysPromptTokenCount = (await encodeAsync(createSpecRewriteSysMsg([], UBIQUITY_OS_APP_NAME))).length;
    const queryTokenCount = (await encodeAsync(llmQuery)).length;

    const tokenLimits: TokenLimits = {
      modelMaxTokenLimit: this.context.adapters.openRouter.completions.getModelMaxTokenLimit(this.context.config.openRouterAiModel),
      maxCompletionTokens: this.context.adapters.openRouter.completions.getModelMaxOutputLimit(this.context.config.openRouterAiModel),
      runningTokenCount: 0,
      tokensRemaining: 0,
    };

    // what we start out with to include files
    tokenLimits.tokensRemaining = tokenLimits.modelMaxTokenLimit - tokenLimits.maxCompletionTokens - sysPromptTokenCount - queryTokenCount;
    const githubConversation = await fetchIssueConversation(this.context, tokenLimits);

    return await completions.createCompletion(
      openRouterAiModel,
      githubConversation,
      UBIQUITY_OS_APP_NAME,
      completions.getModelMaxOutputLimit(openRouterAiModel)
    );
  }

  async getUserRole(context: Context) {
    const orgLogin = context.payload.organization?.login;
    const user = context.payload.sender.login;
    const { logger, octokit } = context;

    try {
      // Validate the organization login
      if (typeof orgLogin !== "string" || orgLogin.trim() === "") {
        throw new Error("Invalid organization name");
      }

      let role;

      try {
        const response = await octokit.rest.orgs.getMembershipForUser({
          org: orgLogin,
          username: user,
        });
        role = response.data.role.toLowerCase();
        return role;
      } catch (err) {
        logger.error("Could not get user membership", { err });
      }

      // If we failed to get organization membership, narrow down to repo role
      const permissionLevel = await octokit.rest.repos.getCollaboratorPermissionLevel({
        username: user,
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
      });
      role = permissionLevel.data.role_name?.toLowerCase();
      context.logger.debug(`Retrieved collaborator permission level for ${user}.`, {
        user,
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        isAdmin: permissionLevel.data.user?.permissions?.admin,
        role,
        data: permissionLevel.data,
      });

      return role;
    } catch (err) {
      logger.error("Could not get user role", { err });
      return "unknown";
    }
  }

  async canUserRewrite(context: Context) {
    const userRole = await this.getUserRole(context);
    return ADMIN_ROLES.includes(userRole.toLowerCase()) || COLLABORATOR_ROLES.includes(userRole.toLowerCase());
  }
}

export async function timeLabelChange(context: Context<"issues.labeled">): Promise<CallbackResult> {
  if (context.payload.label?.name.toLowerCase().includes("Time")) {
    const specificationRewriter = new SpecificationRewriter(context);
    return specificationRewriter.performSpecRewrite();
  } else {
    return { status: 200, reason: "Skipping spec rewrite because time label wasn't changed" };
  }
}
