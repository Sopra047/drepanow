import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { answerQuestion, buildAiContext } from "@/lib/ai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  const filters = parseFilters(new URLSearchParams(body?.filters ?? {}));

  if (!messages.length) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  const ds = await getDataset();
  const ctx = buildAiContext(ds, filters);
  const content = answerQuestion(ctx, lastUser.content);

  return NextResponse.json({ content });
}
