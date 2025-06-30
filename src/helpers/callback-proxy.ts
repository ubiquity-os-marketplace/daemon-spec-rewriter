import { SpecificationRewriter, timeLabelChange } from "../handlers/spec-rewriter";
import { Context, SupportedEvents } from "../types";

export type CallbackResult = { status: 200 | 201 | 204 | 404 | 500; reason: string; content?: string | Record<string, unknown> };

export async function callCallbacks<T extends SupportedEvents>(context: Context<T>, eventName: T): Promise<CallbackResult> {
  if (!context.config.eventWhiteList.includes(eventName)) {
    context.logger.info(`Skipping as ${eventName} is not in event white list`);
    return { status: 204, reason: "skipped" };
  }
  if (eventName === "issues.labeled" || eventName === "issues.unlabeled") {
    return timeLabelChange(context as Context<"issues.labeled">);
  } else {
    return new SpecificationRewriter(context).performSpecRewrite();
  }
}
