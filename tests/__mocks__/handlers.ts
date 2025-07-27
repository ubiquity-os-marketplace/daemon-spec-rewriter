import { http, HttpResponse } from "msw";
import { db } from "./db";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  //  GET https://api.github.com/repos/ubiquity/test-repo/issues/1
  http.get("https://api.github.com/repos/:owner/:repo/issues/:issue_number", ({ params: { owner, repo, issue_number: issueNumber } }) =>
    HttpResponse.json(
      db.issue.findFirst({ where: { owner: { equals: owner as string }, repo: { equals: repo as string }, number: { equals: Number(issueNumber) } } })
    )
  ),

  // list issue comments
  http.get("https://api.github.com/repos/:owner/:repo/issues/:issue_number/comments", ({ params: { owner, repo, issue_number: issueNumber } }) =>
    HttpResponse.json(
      db.comments.findMany({ where: { owner: { equals: owner as string }, repo: { equals: repo as string }, issue_number: { equals: Number(issueNumber) } } })
    )
  ),
];
