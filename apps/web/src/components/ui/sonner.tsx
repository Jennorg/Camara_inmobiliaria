import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#059669",
          "--normal-text": "#ffffff",
          "--normal-border": "#047857",
          "--success-bg": "#059669",
          "--success-text": "#ffffff",
          "--success-border": "#047857",
          "--border-radius": "var(--radius)",
          "--error-bg": "#ef4444",
          "--error-text": "#ffffff",
          "--error-border": "#dc2626",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !w-[270px] !text-xs !p-3",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
