import { NextResponse } from "next/server";

type RevalidateResponse = {
  ok?: boolean;
  revalidated?: string[];
  error?: string;
};

const DEFAULT_REVALIDATE_TAGS = [
  "news",
  "news:en",
  "news:ar",
  "horses",
  "horses:en",
  "horses:ar",
  "events",
  "events:en",
  "events:ar",
  "pages",
  "page:home",
  "page:home:en",
  "page:home:ar",
  "page:farm",
  "page:farm:en",
  "page:farm:ar",
  "page:news",
  "page:news:en",
  "page:news:ar",
  "page:events",
  "page:events:en",
  "page:events:ar",
  "page:horses",
  "page:horses:en",
  "page:horses:ar",
  "page:contact",
  "page:contact:en",
  "page:contact:ar",
  "settings",
  "gallery",
  "gallery:en",
  "gallery:ar",
  "farm",
  "farm:en",
  "farm:ar",
] as const;

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

export async function POST(req: Request) {
  const landingBase = normalizeBaseUrl(process.env.LANDING_BASE_URL);
  const landingSecret = (process.env.LANDING_REVALIDATE_SECRET ?? "").trim();

  if (!landingBase || !landingSecret) {
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: missing landing revalidate env." },
      { status: 500 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Force "invalidate all landing cache" semantics even if client sends empty body.
  const normalizedBody =
    body && typeof body === "object" && Array.isArray((body as { tags?: unknown }).tags)
      ? body
      : { tags: [...DEFAULT_REVALIDATE_TAGS] };

  let upstream: Response;
  try {
    upstream = await fetch(`${landingBase}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": landingSecret,
      },
      body: JSON.stringify(normalizedBody),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach landing revalidate endpoint." },
      { status: 502 }
    );
  }

  let upstreamBody: RevalidateResponse | null = null;
  try {
    upstreamBody = (await upstream.json()) as RevalidateResponse;
  } catch {
    upstreamBody = null;
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
    return NextResponse.json(
      {
        ok: false,
        error: upstreamBody?.error || "Landing revalidate request failed.",
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      revalidated: Array.isArray(upstreamBody?.revalidated) ? upstreamBody?.revalidated : [],
    },
    { status: 200 }
  );
}
