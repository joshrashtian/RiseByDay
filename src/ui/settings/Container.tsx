import React from 'react'
import { twMerge } from 'tailwind-merge'

type DivProps = React.HTMLAttributes<HTMLDivElement>

const ContainerRoot = ({ className, ...props }: DivProps) => (
  <div
    className={twMerge(
      'flex flex-col overflow-hidden rounded-2xl border border-line/30  bg-zinc-100/40 dark:bg-zinc-900/90',
      className
    )}
    {...props}
  />
)

const ContainerTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={twMerge('truncate text-sm font-semibold', className)} {...props} />
)

const ContainerActions = ({ className, ...props }: DivProps) => (
  <div className={twMerge('flex shrink-0 items-center gap-2', className)} {...props} />
)

const ContainerBody = ({ className, ...props }: DivProps) => (
  <div className={twMerge('px-3 py-3', className)} {...props} />
)

type ContainerHeaderType = DivProps & {
  icon?: React.ReactNode
  id?: string
  heading: string
}

const ContainerHeader = ({ className, id, icon, heading }: ContainerHeaderType) => {
  return (
  <div className="flex  items-center justify-between gap-4 border-b border-line px-4 py-4">
      <div className="flex items-center gap-3">
        { icon &&
      <span className="inline-flex size-10 items-center justify-center border-b text-xl ">
       {icon}
      </span>
        }
      <div>
        <h3
          id={`${heading}-heading`}
          className="font-black text-lg font-semibold text-ink"
        >
          {heading}
          </h3>
        </div>
      </div>
  </div>
  )
}

const ContainerFooter = ({ className, ...props }: DivProps) => (
  <div
    className={twMerge('flex items-center justify-end gap-2 border-t border-line px-3 py-3', className)}
    {...props}
  />
)

const Container = Object.assign(ContainerRoot, {
  Header: ContainerHeader,
  Title: ContainerTitle,
  Actions: ContainerActions,
  Body: ContainerBody,
  Footer: ContainerFooter,
})

export default Container
