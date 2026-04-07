import { NextResponse } from "next/server";

// POST /api/cron/billing
// Per-appointment billing was removed with the move to the single "Profissional" plan.
// This endpoint is kept as a no-op for backward compatibility with any existing cron configs.
export async function POST() {
  return NextResponse.json({ ok: true, message: "No-op: per-appointment billing is disabled." });
}
