import { createActionsPlugin } from "@ubiquity-os/plugin-sdk";

createActionsPlugin((context) => {
  return context.payload;
}).catch(console.error);
