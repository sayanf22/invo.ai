import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Public routes that don't require authentication
    const publicRoutes = ["/auth/login", "/auth/signup", "/auth/callback", "/auth/reset-password"]
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

    // If user is not logged in and trying to access protected route
    if (!user && !isPublicRoute && pathname !== "/") {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        url.searchParams.set("redirect", pathname)
        return NextResponse.redirect(url)
    }

    // If user is logged in
    if (user) {
        // If on auth pages, redirect to home
        if (isPublicRoute) {
            const url = request.nextUrl.clone()
            url.pathname = "/"
            return NextResponse.redirect(url)
        }

        // Check if onboarding is complete (we'll check this in the page itself)
        // Middleware shouldn't make DB calls for performance
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api routes
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)",
    ],
}
