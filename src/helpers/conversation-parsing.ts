import { Context } from "../types/context";
import { TokenLimits } from "../types/llm";
import { encode } from "gpt-tokenizer";
import { EncodeOptions } from "gpt-tokenizer/esm/GptEncoding";

export async function encodeAsync(text: string, options?: EncodeOptions): Promise<number[]> {
  return new Promise((resolve) => {
    const result = encode(text, options);
    resolve(result);
  });
}

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

  const issueBody = `${issue.user?.login}: ${issue.body || "No description provided"}`;
  conversation.push(issueBody);

  const issueBodyTokenCount = (await encodeAsync(issueBody)).length;
  tokenLimits.runningTokenCount += issueBodyTokenCount;
  tokenLimits.tokensRemaining -= issueBodyTokenCount;

  if (tokenLimits.tokensRemaining <= 0) {
    context.logger.info("Token limit reached after adding issue body, returning conversation so far");
    return conversation;
  }

  // Fetch all comments for the issue
  const comments = await context.octokit.rest.issues
    .listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    })
    .then((response) => response.data);

  const sortedComments = comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (const comment of sortedComments) {
    const formattedComment = `${comment.user?.login}: ${comment.body || ""}`;

    const commentTokenCount = (await encodeAsync(formattedComment)).length;

    // Check if adding this comment would exceed token limit
    if (tokenLimits.tokensRemaining - commentTokenCount <= 0) {
      context.logger.info("Token limit would be exceeded, stopping comment collection");
      break;
    }

    // Add comment to conversation and update token counts
    conversation.push(formattedComment);
    tokenLimits.runningTokenCount += commentTokenCount;
    tokenLimits.tokensRemaining -= commentTokenCount;
  }

  return conversation;
}
