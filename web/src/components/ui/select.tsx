"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type SelectContextValue = {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  // Map from value → display label, populated by SelectItem children
  labels: Map<string, React.ReactNode>
  registerLabel: (value: string, label: React.ReactNode) => void
  size: "sm" | "default"
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  labels: new Map(),
  registerLabel: () => {},
  size: "default",
  triggerRef: { current: null },
})

// ---------------------------------------------------------------------------
// Select (root)
// ---------------------------------------------------------------------------

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  disabled?: boolean
  size?: "sm" | "default"
}

function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  children,
  size = "default",
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Map<string, React.ReactNode>>(new Map())
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  function handleValueChange(newValue: string) {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
    setOpen(false)
  }

  function registerLabel(itemValue: string, label: React.ReactNode) {
    setLabels((prev) => {
      if (prev.get(itemValue) === label) return prev
      const next = new Map(prev)
      next.set(itemValue, label)
      return next
    })
  }

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current && triggerRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  return (
    <SelectContext.Provider
      value={{ value, onValueChange: handleValueChange, open, setOpen, labels, registerLabel, size, triggerRef }}
    >
      <div data-slot="select" className="relative inline-block">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// SelectTrigger
// ---------------------------------------------------------------------------

type SelectTriggerProps = {
  className?: string
  children?: React.ReactNode
  size?: "sm" | "default"
}

function SelectTrigger({ className, children, size: sizeProp }: SelectTriggerProps) {
  const { open, setOpen, size: ctxSize, triggerRef } = React.useContext(SelectContext)
  const size = sizeProp ?? ctxSize

  return (
    <button
      ref={triggerRef}
      data-slot="select-trigger"
      data-size={size}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)]",
        "dark:bg-input/30 dark:hover:bg-input/50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// SelectValue
// ---------------------------------------------------------------------------

type SelectValueProps = {
  className?: string
  placeholder?: string
}

function SelectValue({ className, placeholder }: SelectValueProps) {
  const { value, labels } = React.useContext(SelectContext)
  const label = labels.get(value)
  const display = label ?? value ?? placeholder ?? ""

  return (
    <span
      data-slot="select-value"
      className={cn("flex flex-1 items-center gap-1.5 text-left line-clamp-1", className)}
    >
      {display || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SelectContent (dropdown panel)
// ---------------------------------------------------------------------------

type SelectContentProps = {
  className?: string
  children?: React.ReactNode
}

function SelectContent({ className, children }: SelectContentProps) {
  const { open, triggerRef } = React.useContext(SelectContext)

  // Position the dropdown below the trigger
  const [style, setStyle] = React.useState<React.CSSProperties>({})
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 50,
    })
  }, [open, triggerRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      data-slot="select-content"
      role="listbox"
      style={style}
      className={cn(
        "isolate z-50 max-h-60 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
        className
      )}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectGroup
// ---------------------------------------------------------------------------

type SelectGroupProps = {
  className?: string
  children?: React.ReactNode
}

function SelectGroup({ className, children }: SelectGroupProps) {
  return (
    <div data-slot="select-group" role="group" className={cn("scroll-my-1 p-1", className)}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectLabel
// ---------------------------------------------------------------------------

type SelectLabelProps = {
  className?: string
  children?: React.ReactNode
}

function SelectLabel({ className, children }: SelectLabelProps) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectItem
// ---------------------------------------------------------------------------

type SelectItemProps = {
  value: string
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

function SelectItem({ value, className, children, disabled }: SelectItemProps) {
  const { value: selectedValue, onValueChange, registerLabel } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  // Register this item's label so SelectValue can display it
  React.useEffect(() => {
    registerLabel(value, children)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, children])

  return (
    <div
      data-slot="select-item"
      role="option"
      aria-selected={isSelected}
      data-disabled={disabled ? "" : undefined}
      onClick={() => !disabled && onValueChange(value)}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-none select-none",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
    >
      <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</span>
      {isSelected && (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
          <CheckIcon className="pointer-events-none size-4" />
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectSeparator
// ---------------------------------------------------------------------------

type SelectSeparatorProps = {
  className?: string
}

function SelectSeparator({ className }: SelectSeparatorProps) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
    />
  )
}

// ---------------------------------------------------------------------------
// SelectScrollUpButton / SelectScrollDownButton
// (kept for API compatibility – scroll behaviour is handled natively by overflow-y-auto)
// ---------------------------------------------------------------------------

type SelectScrollButtonProps = {
  className?: string
}

function SelectScrollUpButton({ className }: SelectScrollButtonProps) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
    >
      <ChevronUpIcon />
    </div>
  )
}

function SelectScrollDownButton({ className }: SelectScrollButtonProps) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
    >
      <ChevronDownIcon />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
