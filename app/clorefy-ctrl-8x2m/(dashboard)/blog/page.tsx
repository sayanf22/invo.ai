"use client"

import { useEffect, useState } from "react"
import { FileText, Check, Archive, Eye, Sparkles, RefreshCw, AlertCircle, Trash2 } from "lucide-react"

interface BlogPost {
  id: string
  slug: string
  title: string
  description: string
  category: string
  status: "draft" | "review" | "published" | "archived"
  wordCount: number
  readTimeMinutes: number
  generatedBy: "human" | "ai"
  aiModel: string | null
  publishedAt: string | null
  createdAt: string
}

type StatusFilter = "all" | "draft" | "review" | "published" | "archived"

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generation form state
  const [topic, setTopic] = useState("")
  const [keyword, setKeyword] = useState("")
  const [category, setCategory] = useState("guides")

  const loadPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("status", filter)
      const res = await fetch(`/api/admin/blog/list?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`)
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic || !keyword) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, primaryKeyword: keyword, category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setTopic("")
      setKeyword("")
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const changeStatus = async (id: string, status: BlogPost["status"]) => {
    try {
      const res = await fetch("/api/admin/blog/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Status change failed")
      }
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed")
    }
  }

  const deletePost = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nThis permanently removes the post and cannot be undone.`)) return
    try {
      const res = await fetch("/api/admin/blog/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blog Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated blog posts using Kimi K2.5 (AWS Bedrock). Posts auto-publish daily at 10:00 UTC. Delete or archive from here.
        </p>
      </div>

      {/* Generation form */}
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Generate New Post</h2>
        </div>
        <form onSubmit={handleGenerate} className="grid gap-3">
          <input
            type="text"
            placeholder="Topic (e.g., How to create a GST invoice in India)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            required
            disabled={generating}
          />
          <input
            type="text"
            placeholder="Primary keyword (e.g., GST invoice format India)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            required
            disabled={generating}
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background"
              disabled={generating}
            >
              <option value="guides">Guides</option>
              <option value="templates">Templates</option>
              <option value="country">Country Guides</option>
              <option value="tips">Tips</option>
              <option value="comparisons">Comparisons</option>
              <option value="news">News</option>
            </select>
            <button
              type="submit"
              disabled={generating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        {(["all", "draft", "review", "published", "archived"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={loadPosts}
          className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Posts list */}
      <div className="border rounded-xl divide-y bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No posts{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="p-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.category}
                  </span>
                  <StatusBadge status={p.status} />
                  {p.generatedBy === "ai" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] font-medium">
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </span>
                  )}
                </div>
                <h3 className="font-medium truncate">{p.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{p.wordCount.toLocaleString()} words</span>
                  <span>{p.readTimeMinutes} min read</span>
                  <span className="truncate">/blog/{p.slug}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <a
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-muted"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </a>
                {p.status !== "published" && (
                  <button
                    onClick={() => changeStatus(p.id, "published")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                  >
                    <Check className="w-3.5 h-3.5" /> Publish
                  </button>
                )}
                {p.status === "published" && (
                  <button
                    onClick={() => changeStatus(p.id, "draft")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700"
                  >
                    Unpublish
                  </button>
                )}
                {p.status !== "archived" && (
                  <button
                    onClick={() => changeStatus(p.id, "archived")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
                    title="Archive"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deletePost(p.id, p.title)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                  title="Delete permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: BlogPost["status"] }) {
  const colors: Record<BlogPost["status"], string> = {
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    archived: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colors[status]}`}
    >
      {status}
    </span>
  )
}
