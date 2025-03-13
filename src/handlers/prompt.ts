export const llmQuery = `Rewrite the issue specification based on the provided GitHub conversation. The conversation is ordered chronologically, with the first comment being the original issue body.

Consider the following guidelines:
1. Give highest priority to the original issue body (first comment), as it represents the issue author's initial intent
2. Incorporate clarifications and additional requirements from subsequent comments
3. Resolve any contradictions by favoring more recent comments
4. Remove any ambiguities in the original specification
5. Format the specification in a clear, structured manner
6. Output ONLY the rewritten specification without additional commentary

Output the rewritten specification in markdown format.`;

export function createSpecRewriteSysMsg(githubConversation: string[], botName: string) {
  return [
    "You are tasked with rewriting GitHub issue specifications based on the entire conversation history. Your goal is to create a clear, comprehensive specification that incorporates all relevant information from the discussion.",
    "\n",
    "Guidelines:",
    "- The first comment in the conversation is the original issue body and should be given the highest weight",
    "- Subsequent comments may contain clarifications, additional requirements, or modifications",
    "- When conflicts exist between comments, generally favor more recent information",
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
