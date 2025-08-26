import { createActionsPlugin } from "@ubiquity-os/plugin-sdk";
import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";

createActionsPlugin(
  (context) => {
    return context.payload;
  },
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? LOG_LEVEL.INFO,
    kernelPublicKey: process.env.KERNEL_PUBLIC_KEY,
    returnDataToKernel: false,
  }
).catch(console.error);
