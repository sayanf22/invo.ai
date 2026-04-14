'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

const ADMIN_BASE = '/clorefy-ctrl-8x2m'

const NAV_ITEMS = [
  { label: 'Overview', path: ADMIN_BASE },
  { label: 'Users', path: `${ADMIN_BASE}/users` },
  { label: 'Subscriptions', path: `${ADMIN_BASE}/subscriptions` },
  { label: 'AI Usage', path: `${ADMIN_BASE}/ai-usage` },
  { label: 'Revenue', path: `${ADMIN_BASE}/revenue` },
  { label: 'Security', path: `${ADMIN_BASE}/security` },
  { label: 'Settings', path: `${ADMIN_BASE}/settings` },
]

interface UserResult {
  id: string
  full_name: string | null
  email: string
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(q)}&pageSize=5`
      )
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchUsers(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchUsers])

  function navigate(path: string) {
    setOpen(false)
    router.push(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search users or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        {users.length > 0 && (
          <>
            <CommandGroup heading="Users">
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => navigate(`${ADMIN_BASE}/users`)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{user.full_name ?? 'Unnamed'}</span>
                  <span className="text-xs text-gray-400">{user.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.path} onSelect={() => navigate(item.path)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
