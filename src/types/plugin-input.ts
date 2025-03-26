import { StaticDecode, Type as T } from "@sinclair/typebox";

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
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
