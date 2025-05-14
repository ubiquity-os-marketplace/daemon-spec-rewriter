import { RestEndpointMethodTypes } from "@octokit/rest";

export type Comment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];
