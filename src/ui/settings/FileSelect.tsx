import React, { useId } from 'react'
import { IoClose, IoDocumentOutline } from 'react-icons/io5'
import { twMerge } from 'tailwind-merge'

type FileSelectProps = {
  value?: string
  onSelect: (file: File) => void | Promise<void>
  onClear?: () => void
  accept?: string
  placeholder?: string
  disabled?: boolean
  busy?: boolean
  icon?: React.ReactNode
  className?: string
  'aria-label'?: string
}

const FileSelect = ({
  value,
  onSelect,
  onClear,
  accept,
  placeholder = 'No file selected',
  disabled = false,
  busy = false,
  icon = <IoDocumentOutline className="size-5" aria-hidden />,
  className,
  'aria-label': ariaLabel = 'File',
}: FileSelectProps) => {
  const inputId = `${useId()}-file`
  const inactive = disabled || busy

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void onSelect(file)
  }

  return (
    <div className={twMerge('flex items-center gap-2', className)}>
      <label
        htmlFor={inputId}
        title="Choose a file"
        className={twMerge(
          'relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted ring-2 ring-transparent transition-shadow focus-within:ring-accent',
          inactive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-sunken hover:text-ink hover:ring-line'
        )}
      >
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={inactive}
          onChange={onChange}
          aria-label={ariaLabel}
          className="sr-only"
        />
      </label>

      <label
        htmlFor={inputId}
        className={twMerge(
          'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm',
          inactive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        )}
      >
        <span className={twMerge('min-w-0 flex-1 truncate', value ? 'text-ink' : 'text-muted')} title={value || undefined}>
          {busy ? 'Importing…' : value || placeholder}
        </span>
        {value && onClear && !inactive ? (
          <button
            type="button"
            onClick={(e) => {
              // Keep the click from bubbling to the label and reopening the picker.
              e.preventDefault()
              onClear()
            }}
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            className="-mr-1 rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
          >
            <IoClose className="size-4" aria-hidden />
          </button>
        ) : null}
      </label>
    </div>
  )
}

export default FileSelect
