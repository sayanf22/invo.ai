// Minimal Cloudflare Workers R2 type declarations
// Only the methods we actually use — avoids needing @cloudflare/workers-types

interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: {
      httpMetadata?: { contentType?: string; [key: string]: any }
      customMetadata?: Record<string, string>
      [key: string]: any
    }
  ): Promise<R2Object | null>

  get(key: string): Promise<R2ObjectBody | null>

  delete(keys: string | string[]): Promise<void>

  head(key: string): Promise<R2Object | null>
}

interface R2Object {
  key: string
  size: number
  etag: string
  httpMetadata?: { contentType?: string }
  customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  blob(): Promise<Blob>
}

// Extend globalThis for __name polyfill
declare var __name: ((fn: any, name: string) => any) | undefined
