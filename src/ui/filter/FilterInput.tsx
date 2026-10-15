import React from 'react'
import { twMerge } from 'tailwind-merge'
import { filterControlClass, filterFocusWithinClass, filterIconClass } from './filterControl'

type FilterInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'className'> & {
  icon?: React.ReactNode
  className?: string
  inputClassName?: string
}

const FilterInput = ({ icon, className, inputClassName, ...props }: FilterInputProps) => {
  return (
    <label className={twMerge(filterControlClass, filterFocusWithinClass, 'cursor-text hover:bg-surface', className)}>
      {icon ? <span className={filterIconClass} aria-hidden>{icon}</span> : null}
      <input
        {...props}
        className={twMerge('h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted', inputClassName)}
      />
    </label>
  )
}

export default FilterInput
