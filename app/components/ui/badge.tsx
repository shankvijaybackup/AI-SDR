import * as React from "react"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const variantClasses = {
  default: "border-transparent bg-slate-900 text-white",
  secondary: "border-transparent bg-slate-100 text-slate-900",
  destructive: "border-transparent bg-red-500 text-white",
  outline: "border-slate-200 text-slate-700",
}

function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const baseClasses = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
  const variantClass = variantClasses[variant] || variantClasses.default
  
  return (
    <div className={`${baseClasses} ${variantClass} ${className}`} {...props} />
  )
}

export { Badge }
