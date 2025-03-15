export const llmQuery = `Rewrite the issue specification based on the provided GitHub conversation. The conversation is ordered chronologically, with the first comment being the original issue body.
Consider the following guidelines:
1. Give highest priority to the original issue body (first comment), as it represents the issue author's initial intent
2. Give additional weight to any messages from the issue author (the person who wrote the first comment)
3. Incorporate clarifications and additional requirements from subsequent comments
4. Resolve any contradictions by favoring more recent comments, especially those from the issue author
5. Remove any ambiguities in the original specification
6. Format the specification in a clear, structured manner
7. Output ONLY the rewritten specification without additional commentary
Output the rewritten specification in markdown format.`;

export function createSpecRewriteSysMsg(githubConversation: string[], botName: string, issueAuthor?: string) {
  // Extract the issue author from the first comment
  return [
    "You are tasked with rewriting GitHub issue specifications based on the entire conversation history. Your goal is to create a clear, comprehensive specification that incorporates all relevant information from the discussion.",
    "\n",
    "Guidelines:",
    "- The first comment in the conversation is the original issue body and should be given the highest weight",
    `- Comments from the issue author (${issueAuthor}) should be given additional weight`,
    "- Subsequent comments may contain clarifications, additional requirements, or modifications",
    "- When conflicts exist between comments, generally favor more recent information, especially from the issue author",
    "- Remove ambiguities and vague requirements",
    "- Organize the specification in a logical structure with clear sections",
    "- Include acceptance criteria when possible",
    "\n",
    `Your name is: ${botName}`,
    "\n",
    "GitHub Conversation (in chronological order):",
    githubConversation.join("\n"),
  ].join("\n");
}
