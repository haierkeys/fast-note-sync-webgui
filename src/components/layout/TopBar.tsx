import { ProfileButton } from "@/components/navigation/ProfileButton";
import { useAppStore, type ModuleId } from "@/stores/app-store";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { ActionGroup } from "./ActionGroup";
import { Logo } from "./Logo";


interface TopBarProps {
  /** 登出回调 */
  onLogout: () => void
  /** 额外的 CSS 类名 */
  className?: string
}

/**
 * TopBar - 顶部栏组件
 *
 * 简洁的顶部导航栏：
 * - 左侧显示 Logo + 当前模块名称
 * - 右侧显示操作按钮组
 * - 移动端包含用户头像
 * - 模块切换时标题有淡入动画
 */
export function TopBar({ onLogout, className }: TopBarProps) {
  const { t } = useTranslation()
  const { currentModule } = useAppStore()

  // 模块名称映射
  const moduleNames: Record<ModuleId, string> = {
    dashboard: t("ui.nav.menuDashboard"),
    vaults: t("ui.nav.menuVaults"),
    notes: t("ui.nav.menuNotes"),
    trash: t("ui.nav.menuTrash"),
    settings: t("ui.nav.menuSettingsBrowser"),
    sync: t("ui.nav.menuSync"),
    git: t("ui.nav.menuGit"),
    config: t("ui.nav.menuSettings"),
    files: t("ui.nav.menuFiles"),
  }

  return (
    <header
      className={cn(
        "h-14 flex items-center justify-between px-4 md:px-6",
        "sticky top-0 z-50",
        "bg-background/80 backdrop-blur-md",
        "border-b border-sidebar-border shadow-md",
        className
      )}
    >
      {/* Logo + Module Title */}
      <div className="flex items-center gap-3">
        <Logo className="size-8 shrink-0" />
        <AnimatePresence mode="wait">
          <motion.h1
            key={currentModule}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="text-xl font-semibold text-foreground"
          >
            {moduleNames[currentModule]}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Action Group + Profile */}
      <div className="flex items-center gap-1">
        <ActionGroup />
        <ProfileButton onLogout={onLogout} />
      </div>
    </header>
  )
}
