import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["build/index.ts", "src/main.ts"],
  project: ["src/**/*.ts"],
  ignore: ["src/types/config.ts", "**/__mocks__/**", "**/__fixtures__/**"],
  ignoreExportsUsedInFile: true,
  // eslint can also be safely ignored as per the docs: https://knip.dev/guides/handling-issues#eslint--jest
  ignoreDependencies: ["eslint-config-prettier", "eslint-plugin-prettier", "ts-node", "hono"],
  eslint: true,
};

export default config;
