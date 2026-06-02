import { NextRequest, NextResponse } from "next/server";
import { getStatus, getClientIp } from "@/lib/rate-limit";

/**
 * Returns the current rate limit status for the calling IP.
 * Used by the UI to show "今日剩餘 X / 10 次".
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const status = await getStatus(ip);
  return NextResponse.json(status);
}
