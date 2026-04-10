"use client"

import React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { ArrowUp, Paperclip, Square, X, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
}

const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
})

function usePromptInput() {
  const context = React.useContext(PromptInputContext)
  if (!context) throw new Error("usePromptInput must be used within a PromptInput")
  return context
}

interface PromptInputProps {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

const PromptInputRoot = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "")

    const handleChange = (newValue: string) => {
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-2xl border border-border bg-card shadow-sm transition-all duration-200",
              "focus-within:shadow-md focus-within:border-primary/30",
              isLoading && "border-primary/40",
              className
            )}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    )
  }
)
PromptInputRoot.displayName = "PromptInputRoot"

interface PromptInputTextareaProps {
  disableAutosize?: boolean
  placeholder?: string
}

const PromptInputTextarea: React.FC<
  PromptInputTextareaProps & React.ComponentProps<typeof Textarea>
> = ({ className, onKeyDown, disableAutosize = false, placeholder, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return
    textareaRef.current.style.height = "auto"
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`
  }, [value, maxHeight, disableAutosize])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e)
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-[16px] leading-relaxed", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  )
}

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

const PromptInputActions: React.FC<PromptInputActionsProps> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
)

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput()
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

// Main PromptInputBox Component — adapted for Clorefy theme
interface PromptInputBoxProps {
  onSend?: (message: string, file?: File) => void
  isLoading?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const PromptInputBox = React.forwardRef(
  (props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
    const {
      onSend = () => {},
      isLoading = false,
      placeholder = "Describe your document... e.g. Create an invoice for web design services",
      className,
      disabled = false,
    } = props

    const [input, setInput] = React.useState("")
    const [stagedFile, setStagedFile] = React.useState<File | null>(null)
    const fileInputId = React.useId()

    const handleSubmit = () => {
      if (input.trim() || stagedFile) {
        onSend(input.trim(), stagedFile || undefined)
        setInput("")
        setStagedFile(null)
      }
    }

    const hasContent = input.trim() !== "" || stagedFile !== null

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getTypeLabel = (type: string) => {
      if (type === "application/pdf") return "PDF"
      if (type.startsWith("image/png")) return "PNG"
      if (type.startsWith("image/jpeg") || type.startsWith("image/jpg")) return "JPG"
      if (type.startsWith("image/webp")) return "WEBP"
      if (type.startsWith("image/")) return "IMG"
      return "FILE"
    }

    return (
      <PromptInputRoot
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn("w-full", className)}
        disabled={disabled || isLoading}
        ref={ref}
      >
        {/* Staged file card */}
        <AnimatePresence>
          {stagedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="px-5 pt-4 overflow-hidden"
            >
              <div className="inline-flex items-center gap-3 px-3 py-2.5 bg-muted/50 rounded-xl border border-border/40 max-w-[240px] group">
                <div className="w-10 h-10 rounded-lg bg-background border border-border/50 flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[7px] font-bold text-muted-foreground mt-0.5 leading-none">{getTypeLabel(stagedFile.type)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">{stagedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(stagedFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStagedFile(null)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-6 pt-5 pb-2">
          <PromptInputTextarea placeholder={stagedFile ? "Describe what to do with this file..." : placeholder} />
        </div>

        <PromptInputActions className="flex items-center justify-between px-5 pb-4">
          <div className="flex items-center gap-1.5">
            {/* Hidden file input */}
            <input
              id={fileInputId}
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setStagedFile(file)
                if (e.target) e.target.value = ""
              }}
            />
            <PromptInputAction tooltip="Attach file (PDF, image)">
              <label
                htmlFor={!disabled && !isLoading ? fileInputId : undefined}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                  disabled || isLoading
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer"
                )}
                aria-label="Add attachment"
              >
                <Paperclip className="w-[18px] h-[18px]" />
              </label>
            </PromptInputAction>
            <PromptInputAction tooltip="History">
              <button
                type="button"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
                aria-label="History"
              >
                <Clock className="w-[18px] h-[18px]" />
              </button>
            </PromptInputAction>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[14px] text-muted-foreground select-none">
              <span className="font-medium">Clorefy AI</span>
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <PromptInputAction
              tooltip={isLoading ? "Stop generation" : hasContent ? "Send message" : "Type a message"}
            >
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!hasContent && !isLoading) || disabled}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                  isLoading
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/15 cursor-pointer"
                    : hasContent
                    ? "bg-foreground text-background hover:opacity-90 active:scale-90"
                    : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                )}
                aria-label={isLoading ? "Stop" : "Submit prompt"}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="stop"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="send"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ArrowUp className="w-[18px] h-[18px]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </PromptInputAction>
          </div>
        </PromptInputActions>
      </PromptInputRoot>
    )
  }
)
PromptInputBox.displayName = "PromptInputBox"
