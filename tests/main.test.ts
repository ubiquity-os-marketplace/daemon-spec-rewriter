import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import usersGet from "./__mocks__/users-get.json";
import { describe, beforeAll, beforeEach, afterAll, afterEach, it, jest, expect } from "@jest/globals";
import { Context, SupportedEvents } from "../src/types";
import { drop } from "@mswjs/data";
import issueTemplate from "./__mocks__/issue-template";
import repoTemplate from "./__mocks__/repo-template";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { SpecificationRewriter } from "../src/handlers/spec-rewriter";

// Mock constants
const MOCK_ISSUE_REWRITE_SPEC = "rewritten specification";

describe("SpecificationRewriter", () => {
  let specRewriter: SpecificationRewriter;
  let ctx: Context;

  beforeAll(async () => {
    server.listen();
  });

  afterEach(() => {
    drop(db);
    server.resetHandlers();
  });

  afterAll(() => server.close());

  beforeEach(async () => {
    jest.clearAllMocks();
    await setupTests();
    ctx = createContext();
    specRewriter = new SpecificationRewriter(ctx);

    const fakeComments = [
      { created_at: "2021-01-01T00:00:00Z", body: "issue spec", user: { login: "test" } },
      {
        created_at: "2021-01-02T00:00:00Z",
        body: "test",
        user: { login: "user" },
      },
    ];

    jest.spyOn(ctx.octokit, "paginate").mockResolvedValue(fakeComments);
  });

  describe("performSpecRewrite", () => {
    it("should throw error if user lacks rewrite permissions", async () => {
      jest.spyOn(specRewriter, "canUserRewrite").mockResolvedValue(false);

      await expect(specRewriter.performSpecRewrite()).rejects.toMatchObject({
        logMessage: {
          raw: "User does not have sufficient permissions to rewrite spec",
          level: "warn",
          type: "warn",
        },
        metadata: {
          caller: "SpecificationRewriter.performSpecRewrite",
        },
      });
    });

    it("should successfully rewrite specification", async () => {
      // Mock Date to return a consistent value
      const mockDate = new Date("2025-01-01T12:00:00Z");
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      jest.spyOn(specRewriter, "canUserRewrite").mockResolvedValue(true);
      jest.spyOn(specRewriter, "rewriteSpec").mockResolvedValue(MOCK_ISSUE_REWRITE_SPEC);

      const updateSpy = jest
        .spyOn(ctx.octokit.rest.issues, "update")
        .mockResolvedValue({} as unknown as RestEndpointMethodTypes["issues"]["update"]["response"]);

      const result = await specRewriter.performSpecRewrite();

      const expectedBody = `${MOCK_ISSUE_REWRITE_SPEC}\n\n<!-- daemon-spec-rewriter - ${mockDate.toISOString()} -->`;

      expect(updateSpy).toHaveBeenCalledWith({
        owner: ctx.payload.repository.owner.login,
        repo: ctx.payload.repository.name,
        issue_number: ctx.payload.issue.number,
        body: expectedBody,
      });

      expect(result).toEqual({ status: 200, reason: "Success" });
      jest.spyOn(global, "Date").mockRestore();
    });
  });

  describe("rewriteSpec", () => {
    it("should create completion using github conversation", async () => {
      jest
        .spyOn(ctx.adapters.openRouter.completions, "getModelTokenLimits")
        .mockReturnValue(Promise.resolve({ contextLength: 50000, maxCompletionTokens: 5000 }));

      const mockConversation = ["issue spec", "user: test"];

      const createCompletionSpy = jest.spyOn(ctx.adapters.openRouter.completions, "createCompletion").mockResolvedValue(MOCK_ISSUE_REWRITE_SPEC);

      const result = await specRewriter.rewriteSpec();

      expect(createCompletionSpy).toHaveBeenCalledWith(
        ctx.config.openRouterAiModel,
        mockConversation,
        ctx.env.UBIQUITY_OS_APP_NAME,
        (await ctx.adapters.openRouter.completions.getModelTokenLimits())?.maxCompletionTokens
      );

      expect(result).toBe(MOCK_ISSUE_REWRITE_SPEC);
    });
  });

  it("should calculate token budget correctly when calling fetchIssueConversation", async () => {
    const fakeComments = [
      { created_at: "2021-01-01T00:00:00Z", body: "issue spec", user: { login: "test" } },
      {
        created_at: "2021-01-02T00:00:00Z",
        body: "excluded (this comment will be skipped as its old and doesn't fit in remaining tokens)",
        user: { login: "test" },
      },
      { created_at: "2021-01-03T00:00:00Z", body: "included", user: { login: "test" } },
      { created_at: "2021-01-04T00:00:00Z", body: "included", user: { login: "test" } },
      { created_at: "2021-01-05T00:00:00Z", body: "included", user: { login: "test" } },
    ];

    jest.spyOn(ctx.octokit, "paginate").mockResolvedValue(fakeComments);

    const result = await specRewriter.fetchIssueConversation(ctx, {
      maxCompletionTokens: 1000,
      modelMaxTokenLimit: 4000,
      tokensRemaining: 12,
    });

    expect(result).toEqual(["issue spec", "test: included", "test: included", "test: included"]);
  });
});

async function setupTests() {
  // Setup test data
  for (const item of usersGet) {
    db.users.create(item);
  }
  db.repo.create({
    ...repoTemplate,
  });
  db.issue.create({
    ...issueTemplate,
  });
}

function createContext() {
  const logger = new Logs("debug");
  const user = db.users.findFirst({ where: { id: { equals: 1 } } });
  return {
    payload: {
      issue: db.issue.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["issue"],
      sender: user,
      repository: db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["repository"],
      action: "created" as string,
      installation: { id: 1 } as unknown as Context["payload"]["installation"],
      organization: { login: "ubiquity" } as unknown as Context["payload"]["organization"],
      number: 1,
    },
    command: {
      name: "rewrite",
      parameters: null,
    },
    owner: "ubiquity",
    repo: "test-repo",
    logger: logger,
    config: {
      openRouterAiModel: "test-model",
    },
    env: {
      UBIQUITY_OS_APP_NAME: "UbiquityOS",
      OPENROUTER_API_KEY: "test",
    },
    adapters: {
      openRouter: {
        completions: {
          getModelTokenLimits: () => {
            return { contextLength: 50000, maxCompletionTokens: 5000 };
          },
          createCompletion: async (): Promise<string> => MOCK_ISSUE_REWRITE_SPEC,
        },
      },
    },
    octokit: new Octokit(),
    eventName: "issue_comment.created" as SupportedEvents,
  } as unknown as Context;
}
