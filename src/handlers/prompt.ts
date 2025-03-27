export const llmQuery = `Rewrite the issue specification based on the provided GitHub conversation. 

Your task is to:
1. Analyze the entire conversation chronologically
2. Extract and synthesize the most important information
3. Create a clear, comprehensive specification

Detailed Guidelines:
- Prioritize the original issue body (first comment) as the primary source of intent
- Give extra weight to comments from the original issue author
- Incorporate substantive clarifications and additional requirements from subsequent comments
- Resolve contradictions by:
  a) Favoring more recent comments
  b) Prioritizing comments from the issue author
  c) Seeking the most precise and actionable formulation
- Eliminate ambiguities and vague language
- Ensure the specification is:
  * Specific
  * Measurable
  * Achievable
  * Relevant
  * Time-bound (SMART criteria)

Output Requirements:
- Use markdown format
- Include clear sections (e.g., Overview, Objectives, Detailed Requirements, Acceptance Criteria)
- Provide context for any significant changes from the original specification
- If insufficient information is present, clearly state the need for additional clarification

Constraints:
- If no meaningful specification can be derived, make minimal changes
- Do not add fictional or speculative requirements
- Maintain the original intent of the issue as closely as possible`;

export function createSpecRewriteSysMsg(githubConversation: string[], botName: string, issueAuthor?: string) {
  return [
    "Advanced GitHub Issue Specification Rewriter",
    "\n",
    "Core Objectives:",
    "- Transform raw GitHub conversation into a precise, actionable specification",
    "- Synthesize information from multiple comments",
    "- Ensure clarity, completeness, and implementability",
    "\n",
    "Sophisticated Analysis Guidelines:",
    `- Primary source of intent: Issue body by ${issueAuthor}`,
    `- Enhanced context weighting for comments by ${issueAuthor}`,
    `- Intelligent conflict resolution using:
      * Chronological progression
      * Author credibility
      * Specificity of requirements`,
    "- Comprehensive requirement synthesis",
    "- Removal of ambiguities and speculative elements",
    "\n",
    `Assistant Persona: ${botName}`,
    "\n",
    "GitHub Conversation Transcript:",
    githubConversation.join("\n"),
    "\n",
    "Special Instructions:",
    "- Produce a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) specification",
    "- If insufficient information is present, generate a structured request for clarification",
  ].join("\n");
}
