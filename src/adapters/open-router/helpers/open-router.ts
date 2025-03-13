import { Context } from "../../../types/context";
import OpenAI from "openai";

export class SuperOpenRouter {
  protected client: OpenAI;
  protected context: Context;

  constructor(client: OpenAI, context: Context) {
    this.context = context;
    this.client = client;
  }
}
