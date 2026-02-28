import { Database, FileText, ArchiveX, Settings, DatabaseBackup, GitPullRequestArrow, Paperclip, Layers, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { useAppStore, type ModuleId } from "@/stores/app-store";
import { NavItem } from "@/components/navigation/NavItem";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


interface FloatingNavProps {
  isAdmin: boolean
  className?: string
}

/**
 * FloatingNav - 悬浮导航栏
 *
 * - 移动端：固定在底部中央
 * - 桌面端：sticky 定位，与内容卡片顶部对齐
 * - 圆角胶囊形状 (rounded-2xl)
 * - 毛玻璃背景
 * - 动画指示器
 */
export function FloatingNav({ isAdmin, className }: FloatingNavProps) {
  const { t } = useTranslation()
  const { currentModule, setModule, versionInfo } = useAppStore()
  const isMobile = useMobile()
  const scrollRef = useRef<HTMLElement>(null)

  // 垂直滚动状态 (桌面端)
  const [showTopArrow, setShowTopArrow] = useState(false)
  const [showBottomArrow, setShowBottomArrow] = useState(false)

  // 水平滚动状态 (移动端/窄屏)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = scrollRef.current

    // 检测垂直滚动
    setShowTopArrow(scrollTop > 5)
    setShowBottomArrow(scrollHeight - scrollTop - clientHeight > 5)

    // 检测水平滚动
    setShowLeftArrow(scrollLeft > 5)
    setShowRightArrow(scrollWidth - scrollLeft - clientWidth > 5)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // 初始检查
    checkScroll()

    // 监听滚动
    el.addEventListener("scroll", checkScroll)
    // 监听窗口缩放可能导致高度/宽度变化
    window.addEventListener("resize", checkScroll)

    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)

    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  const navItems: Array<{
    id: ModuleId
    icon: typeof Database
    labelKey: string
    adminOnly?: boolean
  }> = [
      { id: "dashboard", icon: Layers, labelKey: "ui.nav.menuDashboard" },
      { id: "vaults", icon: Database, labelKey: "ui.nav.menuVaults" },
      { id: "notes", icon: FileText, labelKey: "ui.nav.menuNotes" },
      { id: "files", icon: Paperclip, labelKey: "ui.nav.menuFiles" },
      { id: "trash", icon: ArchiveX, labelKey: "ui.nav.menuTrash" },
      { id: "sync", icon: DatabaseBackup, labelKey: "ui.nav.menuSync" },
      { id: "git", icon: GitPullRequestArrow, labelKey: "ui.nav.menuGit" },
    ]

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className={cn(
      // 移动端：fixed 定位，限制最大宽度（预留左右各 1.5rem 边距）并居中
      "fixed bottom-1 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-3rem)] w-auto",
      // 桌面端：相对定位
      "md:relative md:bottom-auto md:left-auto md:translate-x-0 md:pt-6 md:pb-10 md:pl-4 md:max-w-none group/nav",
      className
    )}>
      {/* 垂直滚动提示箭头 (仅桌面端显示) */}
      <AnimatePresence>
        {!isMobile && showTopArrow && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{
              y: { repeat: Infinity, duration: 1.5, ease: "easeInOut", repeatType: "reverse" }
            }}
            className="hidden md:flex absolute top-4 left-[25px] z-10 text-primary pointer-events-none w-[44px] justify-center"
          >
            <ChevronUp className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 水平滚动提示箭头 (仅移动端/窄屏显示) */}
      <AnimatePresence>
        {isMobile && showLeftArrow && (
          <motion.div
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            transition={{
              x: { repeat: Infinity, duration: 1.5, ease: "easeInOut", repeatType: "reverse" }
            }}
            className="flex md:hidden absolute left-[-4px] top-1/2 -translate-y-1/2 z-10 text-primary pointer-events-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.nav
        ref={scrollRef}
        aria-label={t("ui.nav.mainNavigation")}
        className={cn(
          // 移动端：水平排列，启用横向滚动并隐藏滚动条
          "flex items-center gap-1 p-2 overflow-x-auto no-scrollbar",
          // 桌面端：垂直排列，支持纵向滚动
          "md:flex-col md:gap-1 md:p-2 md:overflow-y-auto md:max-h-[calc(100vh-6rem)] no-scrollbar",
          // 样式
          "bg-sidebar text-sidebar-foreground border border-sidebar-border rounded-lg",
          "custom-shadow backdrop-blur-sm relative"
        )}
        initial={{ opacity: 0, scale: 0.9, x: 0 }}
        animate={isMobile ? {
          opacity: 1,
          scale: 1,
          x: [0, -30, 10, 0]
        } : {
          opacity: 1,
          scale: 1,
          x: 0
        }}
        transition={isMobile ? {
          opacity: { duration: 0.3 },
          scale: { duration: 0.3 },
          x: { duration: 1.2, times: [0, 0.4, 0.7, 1], ease: "easeInOut" }
        } : {
          duration: 0.3
        }}
      >
        {visibleItems.map((item) => (
          <Fragment key={item.id}>
            <NavItem
              icon={item.icon}
              label={t(item.labelKey)}
              isActive={currentModule === item.id}
              onClick={() => setModule(item.id)}
              tooltipSide="right"
              showDot={item.id === 'settings' && !!versionInfo?.versionIsNew}
            />
            {/* 在看板和笔记仓库之间添加分隔线（仅桌面端） */}
            {item.id === 'dashboard' && (
              <div className="hidden md:block w-8 h-px bg-border/50 my-1 flex-shrink-0" />
            )}
          </Fragment>
        ))}

        {/* 系统设置 - 始终在最下方 */}
        {isAdmin && (
          <Fragment key="settings-group">
            {/* 在设置上方添加分隔线（仅桌面端） */}
            <div className="hidden md:block w-8 h-px bg-border/50 my-1 flex-shrink-0" />
            <NavItem
              key="settings"
              icon={Settings}
              label={t("ui.nav.menuSettings")}
              isActive={currentModule === 'settings'}
              onClick={() => setModule('settings')}
              tooltipSide="right"
              showDot={!!versionInfo?.versionIsNew}
            />
          </Fragment>
        )}
      </motion.nav>

      <AnimatePresence>
        {isMobile && showRightArrow && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{
              x: { repeat: Infinity, duration: 1.5, ease: "easeInOut", repeatType: "reverse" }
            }}
            className="flex md:hidden absolute right-[-4px] top-1/2 -translate-y-1/2 z-10 text-primary pointer-events-none"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isMobile && showBottomArrow && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{
              y: { repeat: Infinity, duration: 1.5, ease: "easeInOut", repeatType: "reverse" }
            }}
            className="hidden md:flex absolute bottom-2 left-[25px] z-10 text-primary pointer-events-none w-[44px] justify-center"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

