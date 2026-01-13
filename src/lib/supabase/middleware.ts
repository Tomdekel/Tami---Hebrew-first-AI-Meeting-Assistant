import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/meetings", "/settings"];

// Routes that should redirect to /meetings if already authenticated
const authRoutes = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Skip full auth check for RSC (React Server Component) requests
  // These are client-side navigations that already have a valid session
  const isRSCRequest = request.headers.get("RSC") === "1";
  const hasAuthCookie = request.cookies.has("sb-access-token") ||
    request.cookies.getAll().some(c => c.name.includes("auth-token"));

  // For RSC requests with existing auth cookies, skip the expensive getUser() call
  // The page components will validate the session if needed
  if (isRSCRequest && hasAuthCookie) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session and get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if trying to access protected route without auth
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/meetings", request.url));
  }

  return supabaseResponse;
}
