export const llmQuery = `Process the GitHub issue conversation with extreme precision.
CONTEXT:
- You'll receive a GitHub conversation including an original issue specification and comments.
- Your goal is to synthesize this into an improved specification ONLY if there is sufficient context.
TASK:
1. Analyze the entire conversation chronologically.
2. Extract and synthesize the most important information.
3. Create a clear, comprehensive specification ONLY if there is sufficient context.
DECISION CRITERIA:
If any of the following are true:
- The original specification is empty or minimal.
- The conversation is vague or lacks substantive information.
- There are unresolved contradictions.
- Comments don't provide clear requirements.
- You are uncertain about any aspect of the requirements.
THEN, output exactly the text from the "GitHub Issue Specification" section with no modifications whatsoever.
IMPORTANT OUTPUT INSTRUCTIONS:
- If insufficient context exists: Return ONLY the text contained in the "GitHub Issue Specification" section exactly as provided, with NO modifications, commentary, analysis, headers, or any additional text.
- If sufficient context exists: Provide a well-structured markdown specification with clear sections.
- DO NOT include any internal reasoning, chain-of-thought, or extra commentary in your output.
`;

export function createSpecRewriteSysMsg(githubConversation: string[], botName: string, issueAuthor?: string) {
  return `Advanced GitHub Issue Specification Rewriter
Core Objectives:
- Transform raw GitHub conversation into a precise, actionable specification.
- Synthesize information from multiple comments.
- Ensure clarity, completeness, and implementability.
Sophisticated Analysis Guidelines:
- Primary source of intent: Issue Specification by ${issueAuthor}
- Enhanced context weighting for comments by ${issueAuthor}
- Intelligent conflict resolution using:
 * Chronological progression,
 * Author credibility,
 * Specificity of requirements.
- Comprehensive requirement synthesis.
- Removal of ambiguities and speculative elements.
Assistant Persona: ${botName}
GitHub Issue Specification:
${githubConversation[0]}
GitHub Conversation:
${githubConversation.slice(1).join("\n")}`;
}
