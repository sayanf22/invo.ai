"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

interface UseRequireAuthOptions {
    redirectTo?: string
    returnTo?: string
}

/**
 * Hook to require authentication before performing an action.
 * Returns a function that wraps any callback and checks auth first.
 * If not authenticated, redirects to login with a return URL.
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    const { redirectTo = "/auth/login", returnTo } = options

    /**
     * Wrap a callback to require authentication.
     * If user is not logged in, redirects to login instead of executing callback.
     */
    const requireAuth = useCallback(
        <T extends (...args: unknown[]) => unknown>(callback: T) => {
            return (...args: Parameters<T>) => {
                // Don't do anything while loading
                if (isLoading) return

                // If not authenticated, redirect to login
                if (!user) {
                    const returnPath = returnTo || window.location.pathname
                    const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(returnPath)}`
                    router.push(loginUrl)
                    return
                }

                // User is authenticated, execute the callback
                return callback(...args) as ReturnType<T>
            }
        },
        [user, isLoading, router, redirectTo, returnTo]
    )

    /**
     * Check if user is authenticated (for conditional rendering)
     */
    const isAuthenticated = !isLoading && !!user

    /**
     * Redirect to login if not authenticated
     */
    const redirectToLogin = useCallback(() => {
        const returnPath = returnTo || window.location.pathname
        const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(returnPath)}`
        router.push(loginUrl)
    }, [router, redirectTo, returnTo])

    return {
        user,
        isLoading,
        isAuthenticated,
        requireAuth,
        redirectToLogin,
    }
}
