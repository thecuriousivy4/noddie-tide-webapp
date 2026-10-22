// Server-side route protection (Next.js 16 calls this Proxy; it was Middleware before).
//
// With a realm configured this runs TideCloak's own proxy, which checks the access token
// and its roles before a protected page or API route is reached. Without a realm there is
// nothing to check against, so it passes through and the API routes remain the gate — they
// verify every token themselves, which is where authorization actually belongs.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { createTideCloakProxy, type TidecloakConfig } from "@tidecloak/nextjs/server";

const adapterPath = join(process.cwd(), "tidecloak.json");
const adapter = existsSync(adapterPath)
  ? (JSON.parse(readFileSync(adapterPath, "utf8")) as TidecloakConfig)
  : null;

const tideProxy = adapter
  ? createTideCloakProxy({
      config: adapter,
      protectedRoutes: {
        // Pages. The public page, /signin and the auth callback stay open.
        "/home": [],
        "/register": [],
        "/register/new": ["custodian"],
        "/register/*": [],
        "/requests": [],
        "/requests/*": [],
        "/transparency": [],
        "/activity": [],
        "/guide": [],
        // API. Role checks are repeated inside every handler; this is defence in depth.
        "/api/places/*": [],
        "/api/changes/*": [],
        "/api/works-notices": [],
        "/api/transparency": [],
        "/api/audit": [],
        "/api/policy": [],
        "/api/me": [],
      },
      onFailure: (_ctx: unknown, req: NextRequest) =>
        req.nextUrl.pathname.startsWith("/api/")
          ? NextResponse.json(
              {
                error: {
                  code: "FORBIDDEN",
                  message:
                    "Your token does not carry a role this route requires. The app cannot add one.",
                },
              },
              { status: 403 },
            )
          : NextResponse.redirect(new URL("/signin?denied=1", req.url)),
      onError: (_err: unknown, req: NextRequest) =>
        NextResponse.redirect(new URL("/?autherror=1", req.url)),
    })
  : null;

export async function proxy(req: NextRequest) {
  if (!tideProxy) return NextResponse.next();
  return tideProxy(req);
}

export const config = {
  matcher: [
    "/home",
    "/register",
    "/register/:path*",
    "/requests",
    "/requests/:path*",
    "/transparency",
    "/activity",
    "/guide",
    "/api/:path*",
  ],
};
