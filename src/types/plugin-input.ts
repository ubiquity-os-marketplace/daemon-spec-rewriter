import { StaticDecode, StringOptions, Type as T, TypeBoxError } from "@sinclair/typebox";
import ms from "ms";

function thresholdType(options?: StringOptions) {
  return T.Transform(T.String(options))
    .Decode((value) => {
      const milliseconds = ms(value);
      if (milliseconds === undefined) {
        throw new TypeBoxError(`Invalid threshold value: [${value}]`);
      }
      return milliseconds;
    })
    .Encode((value) => {
      const textThreshold = ms(value, { long: true });
      if (textThreshold === undefined) {
        throw new TypeBoxError(`Invalid threshold value: [${value}]`);
      }
      return textThreshold;
    });
}

/**
 * This should contain the properties of the bot config
 * that are required for the plugin to function.
 *
 * The kernel will extract those and pass them to the plugin,
 * which are built into the context object from setup().
 */

export const pluginSettingsSchema = T.Object(
  {
    openRouterAiModel: T.String({ default: "anthropic/claude-3.7-sonnet" }),
    openRouterBaseUrl: T.String({ default: "https://openrouter.ai/api/v1" }),
    maxRetryAttempts: T.Number({ default: 5 }),
    cooldown: thresholdType({
      default: "5 minutes",
      description: "The cooldown before between each issue's rewrite",
      examples: ["5 minutes", "3 minutes"],
    }),
    eventWhiteList: T.Array(
      T.Enum({
        IssuesLabeled: "issues.labeled",
        IssuesAssigned: "issues.assigned",
        IssuesUnassigned: "issues.unassigned",
        IssuesEdited: "issues.edited",
        IssuesReopened: "issues.reopened",
        IssuesUnlabeled: "issues.unlabeled",
        IssueCommentCreated: "issue_comment.created",
      }),
      {
        examples: ["issues.labeled", "issues.assigned"],
        description: "List of webhooks on which the plugin gets executed",
        default: ["issues.labeled", "issue_comment.created"],
      }
    ),
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
