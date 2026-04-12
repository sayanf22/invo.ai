/**
 * Unit tests for AIInputWithLoading integration in ProfileUpdateChat
 * Feature: profile-update-ai-improvements
 * 
 * These tests verify the component's conditional rendering logic
 * by analyzing the source code structure.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

const componentSource = readFileSync(
  resolve(__dirname, "../components/profile-update-chat.tsx"),
  "utf-8"
)

describe("AIInputWithLoading integration", () => {
  it("should import AIInputWithLoading component", () => {
    expect(componentSource).toContain(
      'import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"'
    )
  })

  it("should render AIInputWithLoading in full mode with correct props", () => {
    // Verify the component renders AIInputWithLoading when isFullMode is true
    expect(componentSource).toContain("{isFullMode ? (")
    expect(componentSource).toContain("<AIInputWithLoading")
    expect(componentSource).toContain("showAttachButton={true}")
    expect(componentSource).toContain("stagedFile={stagedFile}")
    expect(componentSource).toContain("onFileSelect={(file) => setStagedFile(file)}")
    expect(componentSource).toContain("onFileRemove={() => setStagedFile(null)}")
    expect(componentSource).toContain('placeholder="Tell me what to update..."')
  })

  it("should NOT render attach button in section mode (uses simple Input)", () => {
    // In section mode (the else branch), only Input + Button are rendered
    // No showAttachButton, no Paperclip, no file input
    const sectionModeBlock = componentSource.split("{isFullMode ? (")[1]?.split(") : (")[1]
    expect(sectionModeBlock).toBeDefined()
    expect(sectionModeBlock).toContain("<Input")
    expect(sectionModeBlock).toContain("<Button")
    expect(sectionModeBlock).not.toContain("showAttachButton")
    expect(sectionModeBlock).not.toContain("Paperclip")
  })

  it("should show 'Analyzing file...' status text during upload", () => {
    expect(componentSource).toContain(
      'statusText={isUploading ? "Analyzing file..." : undefined}'
    )
  })

  it("should pass isUploading prop to AIInputWithLoading", () => {
    expect(componentSource).toContain("isUploading={isUploading}")
  })

  it("should pass isLoading prop to AIInputWithLoading", () => {
    expect(componentSource).toContain("isLoading={isLoading}")
  })
})
