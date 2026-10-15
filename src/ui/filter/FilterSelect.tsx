import React from 'react'
import { twMerge } from 'tailwind-merge'
import { MultiSelect } from '@/components/base/input/multi-select'
import { filterActiveClass, filterControlClass, filterFocusClass } from './filterControl'

type FilterSelectProps = Omit<React.ComponentProps<typeof MultiSelect>, 'size' | 'triggerClassName'>

/** MultiSelect dressed as a filter control; highlights while anything is selected. */
const FilterSelect = ({ selectedKeys, ...props }: FilterSelectProps) => {
  const active = selectedKeys === 'all' || (selectedKeys instanceof Set && selectedKeys.size > 0)

  return (
    <MultiSelect
      {...props}
      size="sm"
      selectedKeys={selectedKeys}
      triggerClassName={twMerge(filterControlClass, filterFocusClass, 'w-full py-0 shadow-none', active && filterActiveClass)}
    />
  )
}

export default FilterSelect
