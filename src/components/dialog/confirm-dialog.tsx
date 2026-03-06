import { CheckCircle, XCircle, AlertTriangle, Info, HelpCircle, } from "lucide-react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import * as React from "react";


type DialogType = "success" | "error" | "warning" | "info" | "confirm"

type ConfirmDialogProps = {
  isOpen: boolean
  onCancel: () => void
  onConfirm?: () => void
  message: string
  type?: DialogType | string
  children?: React.ReactNode
  className?: string
}

const typeConfig: Record<DialogType, {
  icon: React.ElementType
  iconClass: string
  titleKey: string
}> = {
  success: {
    icon: CheckCircle,
    iconClass: "text-green-500",
    titleKey: "ui.common.success",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-500",
    titleKey: "ui.common.error",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-yellow-500",
    titleKey: "ui.common.warning",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-500",
    titleKey: "ui.common.info",
  },
  confirm: {
    icon: HelpCircle,
    iconClass: "text-amber-500",
    titleKey: "ui.common.confirm",
  },
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  message,
  type = "error",
  children,
  className,
}) => {
  const { t } = useTranslation()
  const dialogType = (type in typeConfig ? type : "error") as DialogType
  const config = typeConfig[dialogType]
  const Icon = config.icon

  // 处理 Enter 键
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === "Enter") {
        e.preventDefault()
        if (type === "confirm" && onConfirm) {
          onConfirm()
        } else {
          onCancel()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, type, onConfirm, onCancel])

  const handleNonConfirmClose = () => {
    if (type !== "confirm" && onConfirm) {
      onConfirm()
    }
    onCancel()
  }

  return (
    <AlertDialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogPrimitive.Portal>
        {/* Overlay with fade animation */}
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        {/* Content with scale and fade animation */}
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%]",
            "gap-4 border bg-background p-4 sm:p-6 shadow-2xl duration-200 rounded-lg sm:rounded-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            className || "max-w-md"
          )}
        >
          {/* Header with icon */}
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <AlertDialogPrimitive.Title className="flex items-center justify-center sm:justify-start gap-2 text-base sm:text-lg font-semibold leading-none tracking-tight">
              <Icon className={cn("h-5 w-5", config.iconClass)} />
              <span className={config.iconClass}>{t(config.titleKey)}</span>
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </AlertDialogPrimitive.Description>
          </div>

          {/* Custom children content */}
          {children && <div className="py-2">{children}</div>}

          {/* Footer with buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0 sm:space-x-2">
            {type === "confirm" ? (
              <>
                <AlertDialogPrimitive.Cancel
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto rounded-xl")}
                  onClick={onCancel}
                >
                  {t("ui.common.cancel")}
                </AlertDialogPrimitive.Cancel>
                <AlertDialogPrimitive.Action
                  className={cn(buttonVariants({ variant: "destructive" }), "w-full sm:w-auto rounded-xl")}
                  onClick={onConfirm}
                >
                  {t("ui.common.confirm")}
                </AlertDialogPrimitive.Action>
              </>
            ) : (
              <AlertDialogPrimitive.Action
                className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto rounded-xl")}
                onClick={handleNonConfirmClose}
              >
                {t("ui.common.close")}
              </AlertDialogPrimitive.Action>
            )}
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
