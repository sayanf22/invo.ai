/**
 * Markdown Message Component
 * Renders AI messages with proper markdown formatting
 */

interface MarkdownMessageProps {
    content: string
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
    // Simple markdown parser for common patterns
    const renderMarkdown = (text: string) => {
        // Split by lines to preserve structure
        const lines = text.split('\n')
        
        return lines.map((line, lineIndex) => {
            // Handle bold text: **text** or __text__
            let processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            processedLine = processedLine.replace(/__(.+?)__/g, '<strong>$1</strong>')
            
            // Handle italic text: *text* or _text_
            processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>')
            processedLine = processedLine.replace(/_(.+?)_/g, '<em>$1</em>')
            
            // Handle inline code: `code`
            processedLine = processedLine.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-sm">$1</code>')
            
            // Handle bullet points
            if (processedLine.trim().startsWith('- ') || processedLine.trim().startsWith('• ')) {
                processedLine = processedLine.replace(/^[\s]*[-•]\s/, '• ')
                return (
                    <div key={lineIndex} className="ml-4">
                        <span dangerouslySetInnerHTML={{ __html: processedLine }} />
                    </div>
                )
            }
            
            // Handle numbered lists
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
