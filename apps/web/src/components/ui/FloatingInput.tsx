import * as React from "react"
import { cn } from "@/lib/utils"

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | boolean
  icon?: React.ReactNode
  rightElement?: React.ReactNode
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, type, label, error, icon, rightElement, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
              {icon}
            </div>
          )}
          <input
            id={id}
            type={type}
            ref={ref}
            className={cn(
              "peer w-full px-2 pt-6 pb-2 border-b-2 border-slate-100 focus:border-emerald-500 transition-colors bg-transparent outline-none text-slate-800 font-medium placeholder-transparent",
              icon && "pl-10",
              rightElement && "pr-10",
              error && "border-red-500 focus:border-red-500",
              className
            )}
            placeholder={label}
            {...props}
          />
          <label
            htmlFor={id}
            className={cn(
              "absolute left-2 text-slate-400 font-medium transition-colors duration-200 pointer-events-none origin-[0_0]",
              // Resting state: positioned like placeholder when empty and unfocused
              "peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:scale-100",
              // Floating state: shrunk and moved up when focused or has value
              "top-1.5 text-xs scale-75 text-slate-400",
              // Focus state color change
              "peer-focus:top-1.5 peer-focus:text-xs peer-focus:scale-75 peer-focus:text-emerald-600",
              icon && "peer-placeholder-shown:left-10 left-2",
              error && "peer-focus:text-red-500 text-red-500"
            )}
          >
            {label}
          </label>
          {rightElement && (
            <div className="absolute right-2 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && typeof error === "string" && (
          <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = "FloatingInput"

export { FloatingInput }
