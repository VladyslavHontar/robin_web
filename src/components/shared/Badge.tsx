type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'accent'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-overlay text-text-secondary border-border',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-error/10 text-error border-error/20',
  accent: 'bg-accent/10 text-accent border-accent/20',
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: BadgeVariant
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
