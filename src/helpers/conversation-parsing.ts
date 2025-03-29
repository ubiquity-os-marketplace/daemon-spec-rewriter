import { Context } from "../types/context";
import { countTokens } from "@anthropic-ai/tokenizer";

export type TokenLimits = {
  modelMaxTokenLimit: number;
  maxCompletionTokens: number;
  tokensRemaining: number;
};

/**
 * Fetches the conversation for a single GitHub issue including the original issue body
 * and all comments, formats them as "author: comment", and keeps track of token count.
 */
export async function fetchIssueConversation(context: Context, tokenLimits: TokenLimits): Promise<string[]> {
  const conversation: string[] = [];
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const issueNumber = context.payload.issue.number;
  const issue = context.payload.issue;

  const issueBody = `${issue.body || "No description provided"}`;
  conversation.push(issueBody);

  const issueBodyTokenCount = countTokens(issueBody);
  tokenLimits.tokensRemaining -= issueBodyTokenCount;

  if (tokenLimits.tokensRemaining <= 0) {
    context.logger.info("Token limit reached after adding issue body, returning conversation as is");
    return conversation;
  }

  // Fetch all comments for the issue and remove issue body
  const comments = await context.octokit
    .paginate(context.octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    })
    .then((response) => response.splice(1));

  // get comments by newest first
  const sortedComments = comments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const comment of sortedComments) {
    const formattedComment = `${comment.user?.login}: ${comment.body}`;

    const commentTokenCount = countTokens(formattedComment);

    // Check if adding this comment would exceed token limit
    if (tokenLimits.tokensRemaining - commentTokenCount <= 0) {
      context.logger.info("Token limit would be exceeded, stopping comment collection");
      break;
    }

    // Add comment at index 1 pushing existing comment forward and update token counts
    conversation.splice(1, 0, formattedComment);
    tokenLimits.tokensRemaining -= commentTokenCount;
  }

  return conversation;
}
