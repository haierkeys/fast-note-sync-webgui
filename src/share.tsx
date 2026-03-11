import "@/i18n/translations";
import "@/app/globals.css";

import { ConfirmDialogProvider } from "@/components/context/confirm-dialog-context";
import { ThemeProvider } from "@/components/context/theme-context";
import { Toaster } from "@/components/ui/sonner";
import ReactDOM from "react-dom/client";
import React from "react";
import { ShareApp } from "./app/ShareApp";

// 初始化配色方案 (分享页面也需要保持一致的主题感知，但使用独立的存储键)
const initColorScheme = () => {
    const stored = localStorage.getItem('share-settings')
    if (stored) {
        try {
            const { state } = JSON.parse(stored)
            if (state?.colorScheme) {
                document.documentElement.setAttribute('data-color-scheme', state.colorScheme)
            }
        } catch {
            // 忽略解析错误
        }
    }
}
initColorScheme()

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="auto" storageKey="share-theme">
            <ConfirmDialogProvider>
                <ShareApp />
                <Toaster />
            </ConfirmDialogProvider>
        </ThemeProvider>
    </React.StrictMode>
)
