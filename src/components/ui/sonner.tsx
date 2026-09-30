"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Follows the app theme; no colour overrides so `richColors` success/error toasts keep their colours.
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{ style: { fontFamily: "inherit", borderRadius: "12px" } }}
      {...props}
    />
  )
}

export { Toaster }
