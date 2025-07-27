import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const rewriteCommandSchema = T.Object({
  name: T.Literal("rewrite"),
});

export type Command = StaticDecode<typeof rewriteCommandSchema>;
