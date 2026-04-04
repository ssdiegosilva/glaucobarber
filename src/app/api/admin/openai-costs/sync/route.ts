import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

// ── Default OpenAI prices (USD, as of 2025) ──────────────────────────────────
// Updated manually when OpenAI changes pricing.
const DEFAULT_PRICES: Record<string, {
  displayName: string;
  inputPer1M:  number;
  outputPer1M: number;
  imageCents?: number;
}> = {
  // GPT-4o mini
  "gpt-4o-mini":             { displayName: "GPT-4o mini",          inputPer1M: 0.15, outputPer1M: 0.60 },
  "gpt-4o-mini-2024-07-18":  { displayName: "GPT-4o mini (Jul 24)", inputPer1M: 0.15, outputPer1M: 0.60 },
  // GPT-4o
  "gpt-4o":                  { displayName: "GPT-4o",               inputPer1M: 2.50, outputPer1M: 10.00 },
  "gpt-4o-2024-08-06":       { displayName: "GPT-4o (Aug 24)",      inputPer1M: 2.50, outputPer1M: 10.00 },
  "gpt-4o-2024-11-20":       { displayName: "GPT-4o (Nov 24)",      inputPer1M: 2.50, outputPer1M: 10.00 },
  "gpt-4o-2024-05-13":       { displayName: "GPT-4o (May 24)",      inputPer1M: 5.00, outputPer1M: 15.00 },
  // Image models
  "gpt-image-1":             { displayName: "GPT Image 1",          inputPer1M: 0, outputPer1M: 0, imageCents: 4 },
  "dall-e-3":                { displayName: "DALL-E 3",             inputPer1M: 0, outputPer1M: 0, imageCents: 4 },
  "dall-e-2":                { displayName: "DALL-E 2",             inputPer1M: 0, outputPer1M: 0, imageCents: 2 },
  // Legacy
  "gpt-4-turbo":             { displayName: "GPT-4 Turbo",          inputPer1M: 10.00, outputPer1M: 30.00 },
  "gpt-4-turbo-2024-04-09":  { displayName: "GPT-4 Turbo (Apr 24)", inputPer1M: 10.00, outputPer1M: 30.00 },
  "gpt-4":                   { displayName: "GPT-4",                inputPer1M: 30.00, outputPer1M: 60.00 },
  "o1-mini":                 { displayName: "o1 mini",              inputPer1M: 1.10,  outputPer1M: 4.40  },
  "o1":                      { displayName: "o1",                   inputPer1M: 15.00, outputPer1M: 60.00 },
  "o3-mini":                 { displayName: "o3 mini",              inputPer1M: 1.10,  outputPer1M: 4.40  },
  "o3":                      { displayName: "o3",                   inputPer1M: 10.00, outputPer1M: 40.00 },
};

// ── OpenAI Organization Usage API helpers ────────────────────────────────────

type CompletionResult = {
  model: string;
  num_model_requests: number;
  input_tokens: number;
  output_tokens: number;
};

type ImageResult = {
  model: string;
  num_model_requests: number;
  images?: number;
};

type BucketData<T> = {
  data: Array<{ results: T[] }>;
  has_more: boolean;
  next_page: string | null;
};

async function fetchAllPages<T>(
  endpoint: string,
  params: URLSearchParams,
  apiKey: string,
): Promise<T[]> {
  const all: T[] = [];
  let nextPage: string | null = null;

  do {
    if (nextPage) params.set("page", nextPage);
    const url = `https://api.openai.com/v1/organization/usage/${endpoint}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI ${endpoint} API ${res.status}: ${body}`);
    }

    const data: BucketData<T> = await res.json();
    for (const bucket of data.data ?? []) {
      all.push(...(bucket.results ?? []));
    }
    nextPage = data.has_more ? data.next_page : null;
  } while (nextPage);

  return all;
}

function monthToRange(yearMonth: string): { start: number; end: number } {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month,     1); // exclusive
  return {
    start: Math.floor(start.getTime() / 1000),
    end:   Math.floor(end.getTime()   / 1000),
  };
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // yearMonths: array like ["2026-04"] or undefined (→ current + prev 2 months)
  let yearMonths: string[] = body.yearMonths;
  if (!yearMonths || yearMonths.length === 0) {
    const now = new Date();
    yearMonths = [-2, -1, 0].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }

  const apiKey = process.env.OPENAI_ADMIN_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  // Upsert known prices first
  await Promise.all(
    Object.entries(DEFAULT_PRICES).map(([model, p]) =>
      prisma.aiModelPrice.upsert({
        where: { model },
        create: {
          model,
          displayName:            p.displayName,
          inputPricePer1mTokens:  p.inputPer1M,
          outputPricePer1mTokens: p.outputPer1M,
          imagePriceCents:        p.imageCents ?? null,
        },
        update: {
          displayName:            p.displayName,
          inputPricePer1mTokens:  p.inputPer1M,
          outputPricePer1mTokens: p.outputPer1M,
          imagePriceCents:        p.imageCents ?? null,
        },
      }),
    ),
  );

  const errors: string[] = [];
  const synced: string[] = [];

  for (const yearMonth of yearMonths) {
    const { start, end } = monthToRange(yearMonth);
    const params = new URLSearchParams({
      start_time:    String(start),
      end_time:      String(end),
      "group_by[]":  "model",
      bucket_width:  "1d",
      limit:         "100",
    });

    // Aggregate by model across all days in the month
    const modelMap: Record<string, { nRequests: number; inputTokens: bigint; outputTokens: bigint }> = {};

    // ── Completions ────────────────────────────────────────────────────────
    try {
      const completions = await fetchAllPages<CompletionResult>("completions", new URLSearchParams(params), apiKey);
      for (const r of completions) {
        if (!r.model) continue;
        const k = modelMap[r.model] ?? { nRequests: 0, inputTokens: BigInt(0), outputTokens: BigInt(0) };
        k.nRequests    += r.num_model_requests ?? 0;
        k.inputTokens  += BigInt(r.input_tokens  ?? 0);
        k.outputTokens += BigInt(r.output_tokens ?? 0);
        modelMap[r.model] = k;
      }
    } catch (err) {
      errors.push(`completions/${yearMonth}: ${(err as Error).message}`);
    }

    // ── Images ─────────────────────────────────────────────────────────────
    try {
      const images = await fetchAllPages<ImageResult>("images", new URLSearchParams(params), apiKey);
      for (const r of images) {
        if (!r.model) continue;
        const k = modelMap[r.model] ?? { nRequests: 0, inputTokens: BigInt(0), outputTokens: BigInt(0) };
        k.nRequests += r.num_model_requests ?? r.images ?? 0;
        modelMap[r.model] = k;
      }
    } catch (err) {
      errors.push(`images/${yearMonth}: ${(err as Error).message}`);
    }

    if (Object.keys(modelMap).length === 0 && errors.length > 0) continue;

    // Fetch stored prices
    const prices = await prisma.aiModelPrice.findMany();
    const priceMap = Object.fromEntries(prices.map((p) => [p.model, p]));

    // Upsert snapshots
    for (const [model, usage] of Object.entries(modelMap)) {
      const p = priceMap[model];
      let costUsd = 0;
      if (p) {
        if (p.imagePriceCents != null && p.imagePriceCents > 0) {
          costUsd = (usage.nRequests * p.imagePriceCents) / 100;
        } else {
          const inM  = Number(usage.inputTokens)  / 1_000_000;
          const outM = Number(usage.outputTokens) / 1_000_000;
          costUsd    = inM * p.inputPricePer1mTokens + outM * p.outputPricePer1mTokens;
        }
      }

      await prisma.aiUsageSnapshot.upsert({
        where:  { yearMonth_model: { yearMonth, model } },
        create: { yearMonth, model, nRequests: usage.nRequests, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd, syncedAt: new Date() },
        update: { nRequests: usage.nRequests, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd, syncedAt: new Date() },
      });
    }

    synced.push(yearMonth);
  }

  return NextResponse.json({ ok: true, synced, errors, syncedAt: new Date().toISOString() });
}
