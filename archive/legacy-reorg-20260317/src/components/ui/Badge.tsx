import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
        medium: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
        low: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        none: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        pending: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20',
        analyzing: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        failed: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        default: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}