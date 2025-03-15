# `@ubiquity-os-marketplace/daemon-spec-rewriter`

This is a plugin which rewrites the issue specification based on the GitHub conversation of that issue.

## Usage

Just change the time label on an issue or use the command '/rewrite'

## How it works

With its huge context window, we are able to feed the entire issue conversation with issue specification. This allows the model to have a very deep understanding of the current scope and provide a better specification with latest research

## Installation

`.ubiquity-os.config.yml`:

```yml
plugins:
  - uses:
      - plugin: http://localhost:4000
        with:
          openRouterAiModel: "" # Optional - defaults to "anthropic/claude-3.5-sonnet"
          openRouterBaseUrl: "" # Optional - defaults to Open Router's API endpoint
          tokenLimit: { context: 200000, output: 4096 } #  # Required if using custom openRouterAiModel. Defaults to Claude 3.5 Sonnet limits
```

Important:
If you specify a custom openRouterAiModel, you must also provide the appropriate tokenLimit configuration for that model. The default token limits are set for Claude 3.5 Sonnet and may not be suitable for other models.

`.dev.vars` (for local testing):

specify the OpenRouterBase URL in the `.ubiquity-os.config.yml` file and set the `OPENROUTER_API_KEY` in the `.dev.vars` file.

```dotenv
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
UBIQUITY_OS_APP_NAME="UbiquityOS"
```

## Testing

```sh
bun run test
```
