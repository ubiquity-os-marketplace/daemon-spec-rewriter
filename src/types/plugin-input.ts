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
    openRouterAiModel: T.String({ default: "deepseek/deepseek-r1-0528" }),
    openRouterBaseUrl: T.String({ default: "https://openrouter.ai/api/v1" }),
    maxRetryAttempts: T.Number({ default: 5 }),
    cooldown: thresholdType({
      default: "5 minutes",
      description: "The cooldown before between each issue's rewrite",
      examples: ["5 minutes", "3 minutes"],
    }),
    eventWhiteList: T.Array(
      T.Union([
        T.Literal("issues.labeled"),
        T.Literal("issues.assigned"),
        T.Literal("issues.unassigned"),
        T.Literal("issues.edited"),
        T.Literal("issues.reopened"),
        T.Literal("issues.unlabeled"),
        T.Literal("issue_comment.created"),
      ]),
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
