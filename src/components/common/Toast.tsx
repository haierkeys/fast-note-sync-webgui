import { toast as sonnerToast } from 'sonner';
import { CircleCheck, CircleX, AlertTriangle, Info, Loader2 } from 'lucide-react';

type ToastOptions = {
    description?: string;
    duration?: number;
};

const icons = {
    success: <CircleCheck className="size-5 text-primary" />,
    error: <CircleX className="size-5 text-destructive" />,
    warning: <AlertTriangle className="size-5 text-destructive/70" />,
    info: <Info className="size-5 text-accent-foreground" />,
    loading: <Loader2 className="size-5 text-muted-foreground animate-spin" />,
};

const createAccessibleMessage = (message: string) => (
    <span role="alert" aria-live="assertive">{message}</span>
);

export const toast = {
    success: (message: string, options?: ToastOptions) => {
        sonnerToast(createAccessibleMessage(message), {
            icon: icons.success,
            ...options,
        });
    },
    error: (message: string, options?: ToastOptions) => {
        sonnerToast(createAccessibleMessage(message), {
            icon: icons.error,
            ...options,
        });
    },
    warning: (message: string, options?: ToastOptions) => {
        sonnerToast(createAccessibleMessage(message), {
            icon: icons.warning,
            ...options,
        });
    },
    info: (message: string, options?: ToastOptions) => {
        sonnerToast(createAccessibleMessage(message), {
            icon: icons.info,
            ...options,
        });
    },
    loading: (message: string, options?: ToastOptions) => {
        return sonnerToast(createAccessibleMessage(message), {
            icon: icons.loading,
            duration: Infinity,
            ...options,
        });
    },
    dismiss: sonnerToast.dismiss,
};
