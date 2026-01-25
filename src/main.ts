import { createActionsPlugin, type Options } from "@ubiquity-os/plugin-sdk";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { plugin } from "./plugin";
import { Command } from "./types/command";
import { SupportedEvents } from "./types/context";
import { Env, envSchema } from "./types/env";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";

createActionsPlugin<PluginSettings, Env, Command, SupportedEvents>((context) => plugin(context), {
  envSchema: envSchema as unknown as Options["envSchema"],
  postCommentOnError: true,
  settingsSchema: pluginSettingsSchema as unknown as Options["settingsSchema"],
  logLevel: (process.env.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
  kernelPublicKey: process.env.KERNEL_PUBLIC_KEY,
}).catch(console.error);
