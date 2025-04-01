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
import { ADMIN_ROLES, COLLABORATOR_ROLES, SpecificationRewriter } from "../src/handlers/spec-rewriter";

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
  });

  describe("getUserRole", () => {
    it("should return organization role when available", async () => {
      jest.spyOn(ctx.octokit.rest.orgs, "getMembershipForUser").mockResolvedValue({
        data: { role: "ADMIN" },
      } as unknown as RestEndpointMethodTypes["orgs"]["getMembershipForUser"]["response"]);

      const role = await specRewriter.getUserRole(ctx);
      expect(role).toBe("admin");
    });

    it("should fallback to repository role when org membership fails", async () => {
      jest.spyOn(ctx.octokit.rest.orgs, "getMembershipForUser").mockRejectedValue(new Error("Not found"));

      jest.spyOn(ctx.octokit.rest.repos, "getCollaboratorPermissionLevel").mockResolvedValue({
        data: { role_name: "WRITE" },
      } as unknown as RestEndpointMethodTypes["repos"]["getCollaboratorPermissionLevel"]["response"]);

      const role = await specRewriter.getUserRole(ctx);
      expect(role).toBe("write");
    });

    it("should return 'unknown' if both role retrieval methods fail", async () => {
      jest.spyOn(ctx.octokit.rest.orgs, "getMembershipForUser").mockRejectedValue(new Error("Not found"));
      jest.spyOn(ctx.octokit.rest.repos, "getCollaboratorPermissionLevel").mockRejectedValue(new Error("Permission error"));

      const role = await specRewriter.getUserRole(ctx);
      expect(role).toBe("unknown");
    });
  });

  describe("canUserRewrite", () => {
    it("should allow admin roles to rewrite", async () => {
      for (const role of ADMIN_ROLES) {
        jest.spyOn(specRewriter, "getUserRole").mockResolvedValue(role);
        const canRewrite = await specRewriter.canUserRewrite(ctx);
        expect(canRewrite).toBe(true);
      }
    });

    it("should allow collaborator roles to rewrite", async () => {
      for (const role of COLLABORATOR_ROLES) {
        jest.spyOn(specRewriter, "getUserRole").mockResolvedValue(role);
        const canRewrite = await specRewriter.canUserRewrite(ctx);
        expect(canRewrite).toBe(true);
      }
    });

    it("should deny unknown roles", async () => {
      jest.spyOn(specRewriter, "getUserRole").mockResolvedValue("read");
      const canRewrite = await specRewriter.canUserRewrite(ctx);
      expect(canRewrite).toBe(false);
    });
  });

  describe("performSpecRewrite", () => {
    it("should throw error if user lacks rewrite permissions", async () => {
      jest.spyOn(specRewriter, "canUserRewrite").mockResolvedValue(false);

      await expect(specRewriter.performSpecRewrite()).rejects.toMatchObject({
        logMessage: {
          raw: "User does not have sufficient permissions to rewrite spec",
          level: "error",
          type: "error",
        },
        metadata: {
          caller: "SpecificationRewriter.performSpecRewrite",
        },
      });
    });

    it("should successfully rewrite specification", async () => {
      jest.spyOn(specRewriter, "canUserRewrite").mockResolvedValue(true);
      jest.spyOn(specRewriter, "rewriteSpec").mockResolvedValue(MOCK_ISSUE_REWRITE_SPEC);

      const updateSpy = jest
        .spyOn(ctx.octokit.rest.issues, "update")
        .mockResolvedValue({} as unknown as RestEndpointMethodTypes["issues"]["update"]["response"]);

      const result = await specRewriter.performSpecRewrite();

      expect(updateSpy).toHaveBeenCalledWith({
        owner: ctx.payload.repository.owner.login,
        repo: ctx.payload.repository.name,
        issue_number: ctx.payload.issue.number,
        body: MOCK_ISSUE_REWRITE_SPEC,
      });

      expect(result).toEqual({ status: 200, reason: "Success" });
    });
  });

  describe("rewriteSpec", () => {
    it("should create completion using github conversation", async () => {
      jest.spyOn(ctx.adapters.openRouter.completions, "getModelMaxTokenLimit").mockReturnValue(Promise.resolve(50000));
      jest.spyOn(ctx.adapters.openRouter.completions, "getModelMaxOutputLimit").mockReturnValue(Promise.resolve(5000));

      const mockConversation = ["This is a demo spec for a demo task just perfect for testing."];

      const createCompletionSpy = jest.spyOn(ctx.adapters.openRouter.completions, "createCompletion").mockResolvedValue(MOCK_ISSUE_REWRITE_SPEC);

      const result = await specRewriter.rewriteSpec();

      expect(createCompletionSpy).toHaveBeenCalledWith(
        ctx.config.openRouterAiModel,
        mockConversation,
        ctx.env.UBIQUITY_OS_APP_NAME,
        await ctx.adapters.openRouter.completions.getModelMaxOutputLimit()
      );

      expect(result).toBe(MOCK_ISSUE_REWRITE_SPEC);
    });
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
          getModelMaxTokenLimit: () => 50000,
          getModelMaxOutputLimit: () => 50000,
          createCompletion: async (): Promise<string> => MOCK_ISSUE_REWRITE_SPEC,
        },
      },
    },
    octokit: new Octokit(),
    eventName: "issue_comment.created" as SupportedEvents,
  } as unknown as Context;
}
