import React from 'react'
import { twMerge } from 'tailwind-merge'
import { filterActiveClass, filterControlClass, filterFocusClass, filterIconClass } from './filterControl'

type FilterButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  icon?: React.ReactNode
  /** Toggle state; also sets aria-pressed. */
  active?: boolean
}

const FilterButton = ({ icon, active, className, children, type = 'button', ...props }: FilterButtonProps) => {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={twMerge(filterControlClass, filterFocusClass, 'shrink-0 font-medium', active && filterActiveClass, className)}
      {...props}
    >
      {icon ? <span className={twMerge(filterIconClass, active && 'text-accent')} aria-hidden>{icon}</span> : null}
      {children}
    </button>
  )
}

export default FilterButton
