import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

/**
 * Edge runtime compatibility tests.
 *
 * These tests read source files as text and scan for forbidden Node.js-specific
 * imports that are incompatible with Cloudflare Workers / edge runtimes.
 *
 * Validates: Requirements 10.1, 10.2, 10.4
 */

const FORBIDDEN_NODE_MODULES = [
  "http",
  "https",
  "net",
  "tls",
  "crypto",
  "stream",
  "child_process",
  "fs",
  "path",
  "os",
  "dgram",
  "dns",
  "cluster",
  "worker_threads",
]

// Patterns that indicate Node.js-specific imports
const FORBIDDEN_PATTERNS = FORBIDDEN_NODE_MODULES.flatMap((mod) => [
  // require('module') or require("module")
  new RegExp(`require\\s*\\(\\s*['"]${mod}['"]\\s*\\)`, "g"),
  // import ... from 'module' or import ... from "module"
  new RegExp(`import\\s+.*\\s+from\\s+['"]${mod}['"]`, "g"),
  // import 'module' or import "module" (side-effect imports)
  new RegExp(`^\\s*import\\s+['"]${mod}['"]`, "gm"),
  // require('node:module') or import from 'node:module'
  new RegExp(`require\\s*\\(\\s*['"]node:${mod}['"]\\s*\\)`, "g"),
  new RegExp(`import\\s+.*\\s+from\\s+['"]node:${mod}['"]`, "g"),
])

// Node.js stream class that should not be used
const NODE_STREAM_PATTERNS = [
  /stream\.Readable/g,
  /stream\.Writable/g,
  /stream\.Transform/g,
  /stream\.Duplex/g,
  /new\s+Readable\s*\(/g,
  /new\s+Writable\s*\(/g,
  /new\s+Transform\s*\(/g,
]

// Node.js Buffer usage
const BUFFER_PATTERNS = [
  /Buffer\.from\s*\(/g,
  /Buffer\.alloc\s*\(/g,
  /Buffer\.concat\s*\(/g,
  /new\s+Buffer\s*\(/g,
]

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, "..", relativePath)
  return fs.readFileSync(fullPath, "utf-8")
}

function findForbiddenImports(source: string): string[] {
  const matches: string[] = []
  for (const pattern of FORBIDDEN_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
    const found = source.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }
  return matches
}

function findNodeStreamUsage(source: string): string[] {
  const matches: string[] = []
  for (const pattern of NODE_STREAM_PATTERNS) {
    pattern.lastIndex = 0
    const found = source.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }
  return matches
}

function findBufferUsage(source: string): string[] {
  const matches: string[] = []
  for (const pattern of BUFFER_PATTERNS) {
    pattern.lastIndex = 0
    const found = source.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }
  return matches
}

describe("Edge runtime compatibility", () => {
  const FILES_TO_CHECK = [
    "lib/bedrock.ts",
    "lib/deepseek.ts",
    "app/api/ai/stream/route.ts",
  ]

  describe("forbidden Node.js imports", () => {
    for (const file of FILES_TO_CHECK) {
      it(`${file} has no forbidden Node.js module imports`, () => {
        const source = readSource(file)
        const forbidden = findForbiddenImports(source)
        expect(
          forbidden,
          `Found forbidden Node.js imports in ${file}: ${forbidden.join(", ")}`
        ).toHaveLength(0)
      })
    }
  })

  describe("no Node.js stream usage", () => {
    for (const file of FILES_TO_CHECK) {
      it(`${file} does not use Node.js stream classes`, () => {
        const source = readSource(file)
        const nodeStreams = findNodeStreamUsage(source)
        expect(
          nodeStreams,
          `Found Node.js stream usage in ${file}: ${nodeStreams.join(", ")}`
        ).toHaveLength(0)
      })
    }
  })

  describe("no Node.js Buffer usage", () => {
    for (const file of FILES_TO_CHECK) {
      it(`${file} does not use Node.js Buffer`, () => {
        const source = readSource(file)
        const bufferUsage = findBufferUsage(source)
        expect(
          bufferUsage,
          `Found Node.js Buffer usage in ${file}: ${bufferUsage.join(", ")}`
        ).toHaveLength(0)
      })
    }
  })

  describe("uses edge-compatible Web APIs", () => {
    it("lib/bedrock.ts uses ReadableStream or Web Fetch API", () => {
      const source = readSource("lib/bedrock.ts")
      // Bedrock client should use fetch (Web Fetch API)
      expect(source).toMatch(/\bfetch\s*\(/)
    })

    it("lib/deepseek.ts uses Web Fetch API", () => {
      const source = readSource("lib/deepseek.ts")
      expect(source).toMatch(/\bfetch\s*\(/)
    })

    it("app/api/ai/stream/route.ts uses ReadableStream for response streaming", () => {
      const source = readSource("app/api/ai/stream/route.ts")
      expect(source).toContain("new ReadableStream")
    })

    it("app/api/ai/stream/route.ts uses TextEncoder for SSE encoding", () => {
      const source = readSource("app/api/ai/stream/route.ts")
      expect(source).toContain("new TextEncoder")
    })
  })
})
