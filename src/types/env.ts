import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";

/**
 * Define sensitive environment variables here.
 *
 * These are fed into the worker/workflow as `env` and are
 * taken from either `dev.vars` or repository secrets.
 * They are used with `process.env` but are type-safe.
 */
export const envSchema = T.Object({
  OPENROUTER_API_KEY: T.String(),
  UBIQUITY_OS_APP_NAME: T.String({ default: "UbiquityOS" }),
  KERNEL_PUBLIC_KEY: T.Optional(T.String()),
  LOG_LEVEL: T.Enum(LOG_LEVEL, { default: LOG_LEVEL.INFO }),
});

export type Env = StaticDecode<typeof envSchema>;
