import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real authorization happens next to the data
// (requireUser in pages and server actions).
const PUBLIC_PATHS = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("lc_session");

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }
  if (!hasSession && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
