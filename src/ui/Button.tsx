import React from 'react'
import { twMerge } from 'tailwind-merge'

type RBDButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  styling?: 'solid' | 'bordered'
}

const variants = {
  solid: 'bg-ink text-canvas hover:bg-ink/85',
  bordered: ' bg-surface text-muted hover:bg-sunken hover:text-ink',
} as const

const Button = ({ children, styling = 'solid', className, type = 'button', ...props }: RBDButtonProps) => {
  return (
    <button
      type={type}
      className={twMerge('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50', variants[styling], className)}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
