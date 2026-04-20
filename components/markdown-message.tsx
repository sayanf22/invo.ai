/**
 * Markdown Message Component
 * Renders AI messages with proper markdown formatting.
 *
 * SECURITY: All user-visible content is HTML-escaped before any markdown
 * substitution. This prevents XSS from AI-generated or user-supplied content.
 */

interface MarkdownMessageProps {
    content: string
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
    const renderMarkdown = (text: string) => {
        const lines = text.split('\n')

        return lines.map((line, lineIndex) => {
            // 1. Escape HTML FIRST — before any substitution
            let processedLine = escapeHtml(line)

            // 2. Apply markdown substitutions on the already-escaped string
            //    The substituted tags are safe because we control them exactly.
            processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            processedLine = processedLine.replace(/__(.+?)__/g, '<strong>$1</strong>')
            processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>')
            processedLine = processedLine.replace(/_(.+?)_/g, '<em>$1</em>')
            processedLine = processedLine.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-sm font-mono">$1</code>')

            // Bullet points
            if (processedLine.trim().startsWith('- ') || processedLine.trim().startsWith('• ') || processedLine.trim().startsWith('&bull; ')) {
                processedLine = processedLine.replace(/^[\s]*(?:-|•|&bull;)\s/, '• ')
                return (
                    <div key={lineIndex} className="ml-4">
                        <span dangerouslySetInnerHTML={{ __html: processedLine }} />
                    </div>
                )
            }

            // Numbered lists
            if (/^\d+\.\s/.test(processedLine.trim())) {
                return (
                    <div key={lineIndex} className="ml-4">
                        <span dangerouslySetInnerHTML={{ __html: processedLine }} />
                    </div>
                )
            }

            // Empty lines
            if (processedLine.trim() === '') {
                return <div key={lineIndex} className="h-2" />
            }

            // Regular lines
            return (
                <div key={lineIndex}>
                    <span dangerouslySetInnerHTML={{ __html: processedLine }} />
                </div>
            )
        })
    }

    return <div className="space-y-1">{renderMarkdown(content)}</div>
}
