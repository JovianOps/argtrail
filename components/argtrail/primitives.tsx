'use client'

import { Check, CircleDashed, Copy, X } from 'lucide-react'
import { useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Button } from '@/components/ui/button'
import { literal } from '@/lib/argtrail/format'
import { cn } from '@/lib/utils'

export function Panel({
  label,
  title,
  description,
  actions,
  children,
  className,
}: {
  label?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {label && (
              <span className="flex size-5 items-center justify-center rounded bg-primary/15 font-mono text-[11px] font-semibold text-primary">
                {label}
              </span>
            )}
            <h2 className="text-sm font-semibold text-balance">{title}</h2>
          </div>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">{children}</div>
    </section>
  )
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
}

export const inputClass =
  'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring'

export type Status = 'awaiting' | 'match' | 'mismatch' | 'unrepresentable'

const STATUS_STYLES: Record<Status, { label: string; className: string; icon: typeof Check }> = {
  awaiting: { label: 'Not measured', className: 'border-dashed border-muted-foreground/40 text-muted-foreground', icon: CircleDashed },
  match: { label: 'Verified match', className: 'border-success/40 bg-success/10 text-success', icon: Check },
  mismatch: { label: 'Verified mismatch', className: 'border-destructive/40 bg-destructive/10 text-destructive', icon: X },
  unrepresentable: { label: 'Cannot generate', className: 'border-primary/40 bg-primary/10 text-primary', icon: X },
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const style = STATUS_STYLES[status]
  const Icon = style.icon
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium', style.className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label ?? style.label}
    </span>
  )
}

export function Literal({ value, className, muted }: { value: string | undefined; className?: string; muted?: boolean }) {
  if (value === undefined) return <span className="font-mono text-xs text-muted-foreground italic">— none —</span>
  return (
    <code className={cn('font-mono text-xs break-all whitespace-pre-wrap', muted && 'text-muted-foreground', className)}>
      {literal(value)}
    </code>
  )
}

export function CopyButton({
  text,
  label = 'Copy',
  onCopy,
  variant = 'outline',
  size = 'sm',
}: {
  text: string
  label?: string
  onCopy?: () => void
  variant?: 'outline' | 'default' | 'ghost' | 'secondary'
  size?: 'sm' | 'xs' | 'icon-sm'
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={async () => {
        onCopy?.()
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
      aria-label={size === 'icon-sm' ? label : undefined}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {size !== 'icon-sm' && (copied ? 'Copied' : label)}
    </Button>
  )
}

export function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={cn(
        'max-h-72 overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all',
        className,
      )}
    >
      {children}
    </pre>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  )
}
