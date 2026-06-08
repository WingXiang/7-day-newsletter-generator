import { NextRequest, NextResponse } from "next/server";
import {
  getAccount,
  listSequences,
  createSequence,
  createSequenceEmail,
  createBroadcast,
  type CreateEmailParams,
  type CreateBroadcastParams,
} from "@/lib/kit-api";

type Action =
  | { action: "verify"; apiKey: string }
  | { action: "list-sequences"; apiKey: string }
  | { action: "create-sequence"; apiKey: string; name: string }
  | { action: "create-email"; apiKey: string; sequenceId: number; params: CreateEmailParams }
  | { action: "create-broadcast"; apiKey: string; params: CreateBroadcastParams };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Action;

  try {
    switch (body.action) {
      case "verify": {
        const data = await getAccount(body.apiKey);
        return NextResponse.json(data);
      }
      case "list-sequences": {
        const sequences = await listSequences(body.apiKey);
        return NextResponse.json({ sequences });
      }
      case "create-sequence": {
        const sequence = await createSequence(body.apiKey, body.name);
        return NextResponse.json({ sequence });
      }
      case "create-email": {
        const email = await createSequenceEmail(
          body.apiKey,
          body.sequenceId,
          body.params,
        );
        return NextResponse.json({ email });
      }
      case "create-broadcast": {
        const broadcast = await createBroadcast(body.apiKey, body.params);
        return NextResponse.json({ broadcast });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Kit API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kit API error" },
      { status: 500 },
    );
  }
}
