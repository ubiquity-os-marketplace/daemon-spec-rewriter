import { SpecificationRewriter, timeLabelChange } from "../handlers/spec-rewriter";
import { Context, SupportedEvents } from "../types";
import { CallbackResult } from "../types/proxy";

export async function callCallbacks<T extends SupportedEvents>(context: Context<T>, eventName: T): Promise<CallbackResult> {
  if (!context.config.eventWhiteList.includes(eventName)) {
    context.logger.info(`Skipping as ${eventName} is not in event white list`);
    return { status: 204, reason: "skipped" };
  }

  if (eventName === "issues.labeled") {
    return timeLabelChange(context as Context<"issues.labeled">);
  } else return new SpecificationRewriter(context).performSpecRewrite();
}
