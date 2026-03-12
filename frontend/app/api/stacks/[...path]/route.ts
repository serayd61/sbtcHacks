import { NextRequest, NextResponse } from "next/server";

/**
 * Stacks API Proxy — forwards requests to Hiro API.
 *
 * Why: Browser extensions (ad blockers, privacy tools) and strict CSP
 * can block direct requests to api.mainnet.hiro.so. By proxying through
 * our own domain (sbtcvault.live/api/stacks/...), requests stay same-origin
 * and bypass all client-side blocking.
 *
 * Routes:
 *   GET  /api/stacks/v2/info         → https://api.mainnet.hiro.so/v2/info
 *   POST /api/stacks/v2/contracts/.. → https://api.mainnet.hiro.so/v2/contracts/..
 *   GET  /api/stacks/extended/...    → https://api.mainnet.hiro.so/extended/...
 */

const HIRO_API = "https://api.mainnet.hiro.so";

// Allowed path prefixes (whitelist to prevent open proxy abuse)
const ALLOWED_PREFIXES = [
  "v2/info",
  "v2/contracts/call-read/",
  "extended/v1/address/",
  "extended/v1/tx/",
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join("/");

  if (!isAllowedPath(apiPath)) {
    return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
  }

  const url = new URL(request.url);
  const targetUrl = `${HIRO_API}/${apiPath}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream API unavailable" },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join("/");

  if (!isAllowedPath(apiPath)) {
    return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
  }

  const targetUrl = `${HIRO_API}/${apiPath}`;

  try {
    const body = await request.text();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream API unavailable" },
      { status: 502 }
    );
  }
}
