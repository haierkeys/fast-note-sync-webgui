import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { GitBranch, UserPlus, HardDrive, Trash2, Clock, Shield, Loader2, Type, Lock, Save, HelpCircle, Github, Send, RefreshCw, Cpu, Download, Globe, Database, ChevronLeft, ChevronRight, SlidersHorizontal, BookOpen, Share2, Zap, Router, Eye, EyeOff, Plus, Sliders, Cog } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { useState, useEffect, useCallback, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import env from "@/env.ts";

const restartPollTimer = { current: null as number | null };
const restartPollCancelled = { current: false };

import { VersionOverview } from "./version-overview";
import { WSClientList } from "./ws-client-list";
import { SupportList } from "./support-list";
import { Overview } from "./overview";
import { UserManagment } from "./user-managment";
import { SourceProbePanel } from "./source-probe-panel";


interface SystemConfig {
    fontSet: string
    authTokenKey: string
    tokenExpiry: string
    shareTokenKey: string
    shareTokenExpiry: string
    registerIsEnable: boolean
    fileChunkSize: string
    softDeleteRetentionTime: string
    uploadSessionTimeout: string
    historyKeepVersions: number
    historySaveDelay: string
    adminUid: number
    pullSource: string
    pullReleaseChannel: string
    webguiLoginTokenExpiry: string
    webguiLoginTokenBindIp: boolean
    customResponseHeaders?: Record<string, string>
    defaultPageSize: number
    maxPageSize: number
    defaultContextTimeout: number
    tempPath: string
    isReturnSussess: boolean
    syncLogRetentionTime: string
    downloadSessionTimeout: string
    workerPoolMaxWorkers: number
    workerPoolQueueSize: number
    writeQueueCapacity: number
    writeQueueTimeout: string
    writeQueueIdleTime: string
    wsReadMaxPayloadSize: string
    wsWriteMaxPayloadSize: string
    wsParallelEnabled: boolean
    wsParallelGolimit: number
    wsCheckUtf8Enabled: boolean
    wsCompressionEnabled: boolean
    wsCompressionLevel: number
    wsCompressionThreshold: number
    ftsBleveEnabled: boolean
    ftsBleveStoreRaw: boolean
    gitName: string
    gitEmail: string
}

interface CloudflareConfig {
    enabled: boolean
    token: string
    logEnabled: boolean
}

interface UserDatabaseConfig {
    type: string
    host?: string
    port?: number
    userName?: string
    password?: string
    name?: string
    schema?: string
    sslMode?: string
    maxIdleConns?: number
    maxOpenConns?: number
    connMaxLifetime?: string
    connMaxIdleTime?: string
    maxWriteConcurrency?: number
}

export function SystemSettings({ onBack, isDashboard = false, isAdmin = false }: { onBack?: () => void, isDashboard?: boolean, isAdmin?: boolean }) {
    const { t } = useTranslation()
    const [config, setConfig] = useState<SystemConfig | null>(null)
    const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingCloudflare, setSavingCloudflare] = useState(false)
    const [isRestarting, setIsRestarting] = useState(false)
    const [isGCing, setIsGCing] = useState(false)
    const [showRestartConfirm, setShowRestartConfirm] = useState(false)
    const [showGCConfirm, setShowGCConfirm] = useState(false)
    const [overviewRefreshKey, setOverviewRefreshKey] = useState(0)
    const [isTestingCloudflared, setIsTestingCloudflared] = useState(false)
    const [hasTestedCloudflared, setHasTestedCloudflared] = useState(false)
    const [showDownloadError, setShowDownloadError] = useState(false)
    const [downloadErrorMessage, setDownloadErrorMessage] = useState("")
    const [userDbConfig, setUserDbConfig] = useState<UserDatabaseConfig | null>(null)
    const [savingUserDb, setSavingUserDb] = useState(false)
    const [isTestingUserDb, setIsTestingUserDb] = useState(false)
    const [hasTestedUserDb, setHasTestedUserDb] = useState(false)
    const [showDbPassword, setShowDbPassword] = useState(false)
    const [activeTab, setActiveTab] = useState("font")
    const [headersList, setHeadersList] = useState<{ id: string; key: string; value: string }[]>([])

    const addHeaderRow = () => {
        setHeadersList(prev => [
            ...prev,
            { id: `header-${Date.now()}-${Math.random()}`, key: "", value: "" }
        ])
    }

    const removeHeaderRow = (id: string) => {
        setHeadersList(prev => prev.filter(item => item.id !== id))
    }

    const updateHeaderRow = (id: string, key: string, value: string) => {
        setHeadersList(prev => prev.map(item => item.id === id ? { ...item, key, value } : item))
    }

    const token = localStorage.getItem("token")

    const parseDurationToSeconds = (duration: string): number | null => {
        if (!duration) return null
        const match = duration.match(/^(\d+)(s|m|h|d)$/)
        if (!match) return null
        const value = parseInt(match[1])
        const unit = match[2]
        switch (unit) {
            case 's': return value
            case 'm': return value * 60
            case 'h': return value * 3600
            case 'd': return value * 86400
            default: return null
        }
    }

    const updateConfig = useCallback((updates: Partial<SystemConfig>) => {
        setConfig(prev => prev ? { ...prev, ...updates } : null)
    }, [])


    const updateCloudflareConfig = useCallback((updates: Partial<CloudflareConfig>) => {
        setCloudflareConfig(prev => prev ? { ...prev, ...updates } : null)
    }, [])

    const updateUserDbConfig = useCallback((updates: Partial<UserDatabaseConfig>) => {
        setUserDbConfig(prev => prev ? { ...prev, ...updates } : null)
        setHasTestedUserDb(false)
    }, [])

    const handleSaveConfig = async () => {
        if (!config) return
        if (config.historyKeepVersions < 100) {
            toast.error(t("ui.settings.historyKeepVersionsMinError"))
            return
        }
        if (config.historySaveDelay) {
            const seconds = parseDurationToSeconds(config.historySaveDelay)
            if (seconds === null) {
                toast.error(t("ui.settings.historySaveDelayFormatError"))
                return
            }
            if (seconds < 10) {
                toast.error(t("ui.settings.historySaveDelayMinError"))
                return
            }
        }
        if (config.syncLogRetentionTime) {
            if (parseDurationToSeconds(config.syncLogRetentionTime) === null) {
                toast.error(t("ui.settings.durationFormatError", { field: t("ui.settings.syncLogRetentionTime") }))
                return
            }
        }
        if (config.downloadSessionTimeout) {
            if (parseDurationToSeconds(config.downloadSessionTimeout) === null) {
                toast.error(t("ui.settings.durationFormatError", { field: t("ui.settings.downloadSessionTimeout") }))
                return
            }
        }
        if (config.writeQueueTimeout) {
            if (parseDurationToSeconds(config.writeQueueTimeout) === null) {
                toast.error(t("ui.settings.durationFormatError", { field: t("ui.settings.writeQueueTimeout") }))
                return
            }
        }
        if (config.writeQueueIdleTime) {
            if (parseDurationToSeconds(config.writeQueueIdleTime) === null) {
                toast.error(t("ui.settings.durationFormatError", { field: t("ui.settings.writeQueueIdleTime") }))
                return
            }
        }
        // Convert headersList back to customResponseHeaders
        const customResponseHeaders: Record<string, string> = {}
        for (const item of headersList) {
            const trimmedKey = item.key.trim()
            if (trimmedKey) {
                customResponseHeaders[trimmedKey] = item.value
            }
        }
        
        const configToSave = {
            ...config,
            customResponseHeaders
        }

        setSaving(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config"), {
                method: "POST",
                headers: buildApiHeaders({ token }),
                body: JSON.stringify(configToSave),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.settings.saveSuccess"))
                setConfig(prev => prev ? { ...prev, customResponseHeaders } : null)
            } else {
                toast.error(`${res.message || t("ui.settings.saveFailed")}${res.details ? `\n${res.details}` : ""}`)
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSaving(false)
        }
    }


    const handleSaveCloudflare = async () => {
        if (!cloudflareConfig) return
        if (cloudflareConfig.enabled && !hasTestedCloudflared) {
            toast.error(t("ui.settings.cloudflaredTestRequired"))
            return
        }
        setSavingCloudflare(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config/cloudflare"), {
                method: "POST",
                headers: buildApiHeaders({ token }),
                body: JSON.stringify(cloudflareConfig),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.settings.saveSuccess"))
            } else {
                toast.error(`${res.message || t("ui.settings.saveFailed")}${res.details ? `\n${res.details}` : ""}`)
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSavingCloudflare(false)
        }
    }

    const handleSaveUserDb = async () => {
        if (!userDbConfig) return
        if (!hasTestedUserDb) {
            toast.error(t("ui.settings.testRequiredBeforeSave"))
            return
        }
        setSavingUserDb(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config/user_database"), {
                method: "POST",
                headers: buildApiHeaders({ token }),
                body: JSON.stringify(userDbConfig),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.settings.saveSuccess"))
            } else {
                toast.error(`${res.message || t("ui.settings.saveFailed")}${res.details ? `\n${res.details}` : ""}`)
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSavingUserDb(false)
        }
    }

    const handleTestUserDb = async () => {
        if (!userDbConfig) return
        setIsTestingUserDb(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config/user_database/test"), {
                method: "POST",
                headers: buildApiHeaders({ token }),
                body: JSON.stringify(userDbConfig),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.settings.testSuccess"))
                setHasTestedUserDb(true)
            } else {
                toast.error(`${res.message || t("ui.settings.testFailed")}${res.details ? `\n${res.details}` : ""}`)
                setHasTestedUserDb(false)
            }
        } catch {
            toast.error(t("ui.settings.testFailed"))
            setHasTestedUserDb(false)
        } finally {
            setIsTestingUserDb(false)
        }
    }

    const handleTestCloudflared = async () => {
        setIsTestingCloudflared(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/cloudflared_tunnel_download"), {
                headers: buildApiHeaders({
                    token,
                    includeDomain: false,
                    includeContentType: false,
                }),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.settings.downloadSuccess"))
                setHasTestedCloudflared(true)
            } else {
                setDownloadErrorMessage(`${res.message ? res.message : t("ui.settings.downloadFailed")}${res.details ? `\n\n${res.details}` : ""}`)
                setShowDownloadError(true)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            setDownloadErrorMessage(`${t("ui.settings.downloadFailed")}${errorMessage ? `\n\n${errorMessage}` : ""}`)
            setShowDownloadError(true)
        } finally {
            setIsTestingCloudflared(false)
        }
    }

    const handleRestart = async () => {
        setIsRestarting(true)
        restartPollCancelled.current = false
        if (restartPollTimer.current !== null) {
            window.clearTimeout(restartPollTimer.current)
            restartPollTimer.current = null
        }
        setShowRestartConfirm(false)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/restart"), {
                headers: buildApiHeaders({
                    token,
                    includeDomain: false,
                    includeContentType: false,
                }),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("api.system.restart.success"))
                setOverviewRefreshKey(prev => prev + 1)
            } else {
                toast.error(`${res.message || t("api.system.restart.error")}${res.details ? `\n${res.details}` : ""}`)
            }
        } catch {
            toast.error(t("api.system.restart.error"))
        } finally {
            setIsRestarting(false)
        }
    }

    const handleGC = async () => {
        setIsGCing(true)
        setShowGCConfirm(false)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/gc"), {
                headers: buildApiHeaders({
                    token,
                    includeDomain: false,
                    includeContentType: false,
                }),
            })
            const res = await response.json()
            if (res.code > 0 && res.code < 200 && res.status !== false) {
                toast.success(t("ui.system.manualGCSuccess"))
                setOverviewRefreshKey(prev => prev + 1)
            } else {
                toast.error(`${res.message || t("api.system.gc.error")}${res.details ? `\n${res.details}` : ""}`)
            }
        } catch {
            toast.error(t("api.system.gc.error"))
        } finally {
            setIsGCing(false)
        }
    }

    useEffect(() => {
        let isActive = true

        const fetchConfig = async () => {
            if (isDashboard) {
                if (isActive) setLoading(false)
                return
            }

            if (isActive) setLoading(true)
            try {
                const [configResponse, cloudflareResponse, userDbResponse] = await Promise.all([
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config"), { headers: buildApiHeaders({ token, includeDomain: false, includeContentType: false }) }),
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config/cloudflare"), { headers: buildApiHeaders({ token, includeDomain: false, includeContentType: false }) }),
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config/user_database"), { headers: buildApiHeaders({ token, includeDomain: false, includeContentType: false }) })
                ])

                if (!isActive) return

                const [configRes, cloudflareRes, userDbRes] = await Promise.all([
                    configResponse.json(),
                    cloudflareResponse.json(),
                    userDbResponse.json()
                ])

                if (!isActive) return

                if (configRes.code > 0 && configRes.code < 200 && configRes.status !== false) {
                    setConfig(configRes.data)
                    const initialHeaders = Object.entries(configRes.data.customResponseHeaders || {}).map(([k, v], idx) => ({
                        id: `header-${idx}-${Date.now()}`,
                        key: k,
                        value: v as string
                    }))
                    setHeadersList(initialHeaders)
                } else {
                    toast.error(configRes.message || t("ui.common.error"))
                    if (!config) onBack?.()
                }

                if (cloudflareRes.code > 0 && cloudflareRes.code < 200 && cloudflareRes.status !== false) {
                    setCloudflareConfig(cloudflareRes.data)
                    if (cloudflareRes.data.enabled) {
                        setHasTestedCloudflared(true)
                    }
                }

                if (userDbRes.code > 0 && userDbRes.code < 200 && userDbRes.status !== false) {
                    setUserDbConfig(userDbRes.data)
                    setHasTestedUserDb(true)
                }
            } catch (err: unknown) {
                if (!isActive) return
                console.warn("SystemSettings fetch error:", err)
                toast.error(t("ui.common.error"))
                if (!config) onBack?.()
            } finally {
                if (isActive) {
                    setLoading(false)
                }
            }
        }
        fetchConfig()

        return () => {
            isActive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onBack, t, token, isDashboard])

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [showLeftScroll, setShowLeftScroll] = useState(false)
    const [showRightScroll, setShowRightScroll] = useState(false)

    const handleScroll = useCallback(() => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
            setShowLeftScroll(scrollLeft > 0)
            setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1)
        }
    }, [])

    useEffect(() => {
        // 当 config 加载后，TabsList 才会渲染，所以此时需要手动触发一次初始检查
        handleScroll()

        const currentContainer = scrollContainerRef.current
        if (currentContainer) {
            // 使用 ResizeObserver 监听容器尺寸变化，确保在内容分发或字体加载后依然准确
            const resizeObserver = new ResizeObserver(() => {
                handleScroll()
            })
            resizeObserver.observe(currentContainer)
            
            window.addEventListener('resize', handleScroll)
            return () => {
                resizeObserver.disconnect()
                window.removeEventListener('resize', handleScroll)
            }
        }
    }, [handleScroll, config])

    useEffect(() => {
        if (!scrollContainerRef.current) return
        // 查找当前激活的 Tab 触发器
        const activeElement = scrollContainerRef.current.querySelector('[data-state="active"]') as HTMLElement
        if (activeElement) {
            activeElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest"
            })
        }
    }, [activeTab])

    // 鼠标拖动滚动逻辑支持
    const isDragging = useRef(false)
    const startX = useRef(0)
    const scrollLeftStart = useRef(0)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return
        isDragging.current = true
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft
        scrollLeftStart.current = scrollContainerRef.current.scrollLeft
    }, [])

    const handleMouseLeave = useCallback(() => {
        isDragging.current = false
    }, [])

    const handleMouseUp = useCallback(() => {
        isDragging.current = false
    }, [])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return
        e.preventDefault()
        const x = e.pageX - scrollContainerRef.current.offsetLeft
        const walk = (x - startX.current) * 1.5 // 滚动系数
        scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk
    }, [])

    if (loading) return <div className="p-8 text-center">{t("ui.common.loading")}</div>
    if (!config && !isDashboard) return <div className="p-8 text-center text-destructive">{t("ui.common.error")}</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4">
            {/* 左列 */}
            <div className="flex flex-col gap-4">
                {/* 版本信息 */}
                <VersionOverview showUpgrade={!isDashboard} />
                {/* UserManagment */}
                {!isDashboard && isAdmin && config && <UserManagment adminUid={config.adminUid} />}
                {/* 服务器系统信息 */}
                {!isDashboard && (
                    <Overview refreshKey={overviewRefreshKey}>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowRestartConfirm(true)}
                                        disabled={isRestarting}
                                        className="rounded-xl border-destructive/20 hover:border-destructive/50 hover:bg-destructive/10 text-destructive"
                                    >
                                        {isRestarting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                        )}
                                        {t("ui.system.restartService")}
                                    </Button>
                                    <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("ui.system.restartService")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("ui.system.restartServiceConfirm")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="rounded-xl">{t("ui.common.cancel")}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleRestart}
                                                className="rounded-xl bg-destructive hover:bg-destructive/90"
                                            >
                                                {t("ui.common.confirm")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog open={showGCConfirm} onOpenChange={setShowGCConfirm}>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowGCConfirm(true)}
                                        disabled={isGCing}
                                        className="rounded-xl"
                                    >
                                        {isGCing ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Cpu className="h-4 w-4 mr-2" />
                                        )}
                                        {t("ui.system.manualGC")}
                                    </Button>
                                    <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("ui.system.manualGC")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("ui.system.manualGCConfirm")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="rounded-xl">{t("ui.common.cancel")}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleGC}
                                                className="rounded-xl"
                                            >
                                                {t("ui.common.confirm")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </Overview>
                )}

                {/* 看板模式下的 在线客户端 列表 */}
                {isDashboard && isAdmin && (
                    <WSClientList />
                )}

                {/* 看板模式下的 帮助与建议 Box */}
                {isDashboard && (
                    <div className="rounded-xl border border-border bg-card p-6 space-y-4 custom-shadow">
                        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                            <HelpCircle className="h-5 w-5" />
                            {t("ui.common.helpAndSupport")}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a
                                href="https://github.com/haierkeys/fast-note-sync-service/issues/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-primary/5 border border-border/50 hover:border-primary/20 transition-all group"
                            >
                                <div className="p-2 rounded-lg bg-background border border-border group-hover:border-primary/20 transition-colors">
                                    <Github className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{t("ui.common.githubIssue")}</p>
                                    <p className="text-xs text-muted-foreground truncate">{t("ui.common.githubIssueDesc")}</p>
                                </div>
                            </a>
                            <a
                                href="https://t.me/obsidian_users"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-primary/5 border border-border/50 hover:border-primary/20 transition-all group"
                            >
                                <div className="p-2 rounded-lg bg-background border border-border group-hover:border-primary/20 transition-colors">
                                    <Send className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{t("ui.common.telegramGroup")}</p>
                                    <p className="text-xs text-muted-foreground truncate">{t("ui.common.telegramGroupDesc")}</p>
                                </div>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* 右列：Tabs 设置区域 */}
            <div className="flex flex-col gap-4">
                {isDashboard ? (
                    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 custom-shadow">
                        <SupportList />
                    </div>
                ) : config ? (
                    <div className="rounded-xl border border-border bg-card custom-shadow overflow-hidden flex flex-col">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="bg-muted/60 h-12 relative overflow-hidden group/tabs">
                                {showLeftScroll && (
                                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-muted/60 to-transparent z-20 pointer-events-none flex items-center justify-start">
                                        <ChevronLeft className="h-4 w-4 text-muted-foreground ml-1" />
                                    </div>
                                )}
                                {/* 底层全局边框线 */}
                                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border/60 z-0" />
                                
                                <TabsList 
                                    ref={scrollContainerRef} 
                                    onScroll={handleScroll}
                                    onMouseDown={handleMouseDown}
                                    onMouseLeave={handleMouseLeave}
                                    onMouseUp={handleMouseUp}
                                    onMouseMove={handleMouseMove}
                                    className="w-full h-12 flex flex-nowrap justify-start items-stretch overflow-x-auto bg-transparent p-0 gap-0 no-scrollbar relative z-10 cursor-grab active:cursor-grabbing select-none transition-shadow"
                                >
                                    <TabsTrigger value="font" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                                        {t("ui.settings.fontConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="notes" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        {t("ui.settings.noteRelatedConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="security" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <Shield className="h-4 w-4 mr-2" />
                                        {t("ui.settings.securityConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="share" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <Share2 className="h-4 w-4 mr-2" />
                                        {t("ui.settings.systemConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="database" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <Database className="h-4 w-4 mr-2" />
                                        {t("ui.settings.userDatabaseConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="tunnel" className="flex-none px-6 h-12 rounded-none border-y-transparent border-x-transparent border-r border-r-border/30 bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <Router className="h-4 w-4 mr-2" />
                                        {t("ui.settings.tunnelGatewayConfig")}
                                    </TabsTrigger>
                                    <TabsTrigger value="advanced" className="flex-none px-6 h-12 rounded-none border-y-transparent border-r-transparent border-l-transparent bg-transparent data-[state=active]:bg-card transition-all font-medium text-muted-foreground data-[state=active]:text-primary">
                                        <Cog className="h-4 w-4 mr-2" />
                                        {t("ui.settings.advancedConfig")}
                                    </TabsTrigger>
                                </TabsList>
                                {showRightScroll && (
                                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-muted/60 to-transparent z-20 pointer-events-none flex items-center justify-end">
                                        <ChevronRight className="h-4 w-4 text-muted-foreground mr-1" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1">
                                {/* 常规设置 */}
                                <TabsContent value="font" className="p-6 space-y-5 mt-0 outline-none">
                                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                        <SlidersHorizontal className="h-5 w-5" />
                                        {t("ui.settings.fontConfig")}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Globe className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.pullSource")}</span>
                                        </div>
                                        <Select
                                            value={config.pullSource || "auto"}
                                            onValueChange={(value) => updateConfig({ pullSource: value })}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder={t("ui.settings.pullSource")} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="auto">{t("ui.settings.pullSource.auto")}</SelectItem>
                                                <SelectItem value="github">{t("ui.settings.pullSource.github")}</SelectItem>
                                                <SelectItem value="cnb">{t("ui.settings.pullSource.cnb")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">{t("ui.settings.pullSourceDesc")}</p>
                                        <SourceProbePanel
                                            token={token}
                                            mode={config.pullSource || "auto"}
                                            onApply={(recommended) => updateConfig({ pullSource: recommended })}
                                        />
                                    </div>

                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-3">
                                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.pullReleaseChannel")}</span>
                                        </div>
                                        <Select
                                            value={config.pullReleaseChannel || "stable"}
                                            onValueChange={(value) => updateConfig({ pullReleaseChannel: value })}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder={t("ui.settings.pullReleaseChannel")} />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="stable">{t("ui.settings.pullReleaseChannel.stable")}</SelectItem>
                                                <SelectItem value="beta">{t("ui.settings.pullReleaseChannel.beta")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">{t("ui.settings.pullReleaseChannelDesc")}</p>
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Type className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.fontSet")}</span>
                                        </div>
                                        <Input value={config.fontSet} onChange={(e) => updateConfig({ fontSet: e.target.value })} placeholder="e.g. /static/fonts/font.css" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.fontSetDesc") }} />
                                    </div>
                                    <div className="pt-2">
                                        <Button onClick={handleSaveConfig} disabled={saving} className="rounded-xl">
                                            {saving ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                            ) : (
                                                <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="notes" className="p-6 space-y-5 mt-0 outline-none">
                                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                        <BookOpen className="h-5 w-5" />
                                        {t("ui.settings.noteRelatedConfig")}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <HardDrive className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.fileChunkSize")}</span>
                                        </div>
                                        <Input value={config.fileChunkSize} onChange={(e) => updateConfig({ fileChunkSize: e.target.value })} placeholder="e.g. 1MB, 512KB" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.fileChunkSizeDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Trash2 className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.softDeleteRetentionTime")}</span>
                                        </div>
                                        <Input value={config.softDeleteRetentionTime} onChange={(e) => updateConfig({ softDeleteRetentionTime: e.target.value })} placeholder="e.g. 30d, 24h" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.softDeleteRetentionTimeDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.uploadSessionTimeout")}</span>
                                        </div>
                                        <Input value={config.uploadSessionTimeout} onChange={(e) => updateConfig({ uploadSessionTimeout: e.target.value })} placeholder="e.g. 1h, 30m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.uploadSessionTimeoutDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.downloadSessionTimeout")}</span>
                                        </div>
                                        <Input value={config.downloadSessionTimeout || ""} onChange={(e) => updateConfig({ downloadSessionTimeout: e.target.value })} placeholder="e.g. 1h, 30m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.downloadSessionTimeoutDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.historyKeepVersions")}</span>
                                        </div>
                                        <Input type="number" min="100" value={config.historyKeepVersions} onChange={(e) => updateConfig({ historyKeepVersions: parseInt(e.target.value) || 100 })} placeholder="e.g. 100" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.historyKeepVersionsDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.historySaveDelay")}</span>
                                        </div>
                                        <Input value={config.historySaveDelay} onChange={(e) => updateConfig({ historySaveDelay: e.target.value })} placeholder="e.g. 10s, 1m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.historySaveDelayDesc") }} />
                                    </div>
                                    <div className="pt-2">
                                        <Button onClick={handleSaveConfig} disabled={saving} className="rounded-xl">
                                            {saving ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                            ) : (
                                                <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="security" className="p-6 space-y-5 mt-0 outline-none">
                                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                        <Lock className="h-5 w-5" />
                                        {t("ui.settings.securityConfig")}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Lock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.authTokenKey")}</span>
                                        </div>
                                        <Input value={config.authTokenKey} onChange={(e) => updateConfig({ authTokenKey: e.target.value })} placeholder="e.g. token" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.authTokenKeyDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.tokenExpiry")}</span>
                                        </div>
                                        <Input value={config.tokenExpiry} onChange={(e) => updateConfig({ tokenExpiry: e.target.value })} placeholder="e.g. 365d, 24h, 30m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.tokenExpiryDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.webguiLoginTokenExpiry")}</span>
                                        </div>
                                        <Input value={config.webguiLoginTokenExpiry} onChange={(e) => updateConfig({ webguiLoginTokenExpiry: e.target.value })} placeholder="e.g. 7d, 24h, 30m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.webguiLoginTokenExpiryDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Shield className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.webguiLoginTokenBindIp")}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="webguiLoginTokenBindIp" checked={config.webguiLoginTokenBindIp} onCheckedChange={(checked) => updateConfig({ webguiLoginTokenBindIp: !!checked })} />
                                            <Label htmlFor="webguiLoginTokenBindIp" className="text-sm cursor-pointer">{t("ui.common.isEnabled")}</Label>
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.webguiLoginTokenBindIpDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <UserPlus className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.registerIsEnable")}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="registerIsEnable" checked={config.registerIsEnable} onCheckedChange={(checked) => updateConfig({ registerIsEnable: !!checked })} />
                                            <Label htmlFor="registerIsEnable" className="text-sm cursor-pointer">{t("ui.common.isEnabled")}</Label>
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.registerIsEnableDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Shield className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.adminUid")}</span>
                                        </div>
                                        <Input type="number" value={config.adminUid} onChange={(e) => updateConfig({ adminUid: parseInt(e.target.value) || 0 })} placeholder="e.g. 1" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.adminUidDesc") }} />
                                    </div>
                                    <div className="pt-2">
                                        <Button onClick={handleSaveConfig} disabled={saving} className="rounded-xl">
                                            {saving ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                            ) : (
                                                <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="share" className="p-6 space-y-5 mt-0 outline-none">
                                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                        <Share2 className="h-5 w-5" />
                                        {t("ui.settings.systemConfig")}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Share2 className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.shareTokenKey")}</span>
                                        </div>
                                        <Input value={config.shareTokenKey} onChange={(e) => updateConfig({ shareTokenKey: e.target.value })} placeholder="e.g. fns" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.shareTokenKeyDesc") }} />
                                    </div>
                                    <div className="border-t border-border" />
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.shareTokenExpiry")}</span>
                                        </div>
                                        <Input value={config.shareTokenExpiry} onChange={(e) => updateConfig({ shareTokenExpiry: e.target.value })} placeholder="e.g. 30d, 24h, 30m" className="rounded-xl" />
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.shareTokenExpiryDesc") }} />
                                    </div>
                                    <div className="pt-2">
                                        <Button onClick={handleSaveConfig} disabled={saving} className="rounded-xl">
                                            {saving ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                            ) : (
                                                <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="database" className="p-6 space-y-5 mt-0 outline-none">
                                    {userDbConfig && (
                                        <div className="space-y-5">
                                            <div className="flex flex-col gap-1">
                                                <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                                    <Database className="h-5 w-5" />
                                                    {t("ui.settings.userDatabaseConfig")}
                                                </h2>
                                                <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t("ui.settings.userDatabaseDesc") }} />
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <HardDrive className="h-5 w-5 text-muted-foreground" />
                                                        <span className="text-sm font-medium">{t("ui.settings.databaseType")}</span>
                                                    </div>
                                                    <Select
                                                        value={userDbConfig.type || "sqlite"}
                                                        onValueChange={(value) => updateUserDbConfig({ type: value === "sqlite" ? "" : value })}
                                                    >
                                                        <SelectTrigger className="rounded-xl">
                                                            <SelectValue placeholder={t("ui.settings.databaseType")} />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="sqlite">{t("ui.settings.databaseType.sqlite")}</SelectItem>
                                                            <SelectItem value="postgres">{t("ui.settings.databaseType.postgres")}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {userDbConfig.type === 'postgres' && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-border pt-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseHost")}</Label>
                                                            <Input value={userDbConfig.host} onChange={(e) => updateUserDbConfig({ host: e.target.value })} placeholder="127.0.0.1" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databasePort")}</Label>
                                                            <Input type="number" value={userDbConfig.port} onChange={(e) => updateUserDbConfig({ port: parseInt(e.target.value) || 5432 })} placeholder="5432" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseUser")}</Label>
                                                            <Input value={userDbConfig.userName} onChange={(e) => updateUserDbConfig({ userName: e.target.value })} placeholder="root" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databasePassword")}</Label>
                                                            <div className="relative">
                                                                <Input
                                                                    type={showDbPassword ? "text" : "password"}
                                                                    value={userDbConfig.password}
                                                                    onChange={(e) => updateUserDbConfig({ password: e.target.value })}
                                                                    placeholder="••••••••"
                                                                    className="rounded-xl pr-10"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                                                    onClick={() => setShowDbPassword(!showDbPassword)}
                                                                >
                                                                    {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseName")}</Label>
                                                            <Input value={userDbConfig.name} onChange={(e) => updateUserDbConfig({ name: e.target.value })} placeholder="fast_note" className="rounded-xl" />
                                                        </div>
                                                        {userDbConfig.type === 'postgres' && (
                                                            <>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseSchema")}</Label>
                                                                    <Input value={userDbConfig.schema} onChange={(e) => updateUserDbConfig({ schema: e.target.value })} placeholder="public" className="rounded-xl" />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseSslMode")}</Label>
                                                                    <Select
                                                                        value={userDbConfig.sslMode || "disable"}
                                                                        onValueChange={(value) => updateUserDbConfig({ sslMode: value })}
                                                                    >
                                                                        <SelectTrigger className="rounded-xl">
                                                                            <SelectValue placeholder="SSL Mode" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="disable">disable</SelectItem>
                                                                            <SelectItem value="require">require</SelectItem>
                                                                            <SelectItem value="verify-ca">verify-ca</SelectItem>
                                                                            <SelectItem value="verify-full">verify-full</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </>
                                                        )}
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseMaxIdleConns")}</Label>
                                                            <Input type="number" value={userDbConfig.maxIdleConns} onChange={(e) => updateUserDbConfig({ maxIdleConns: parseInt(e.target.value) || 0 })} placeholder="10" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseMaxOpenConns")}</Label>
                                                            <Input type="number" value={userDbConfig.maxOpenConns} onChange={(e) => updateUserDbConfig({ maxOpenConns: parseInt(e.target.value) || 0 })} placeholder="100" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseConnMaxLifetime")}</Label>
                                                            <Input value={userDbConfig.connMaxLifetime} onChange={(e) => updateUserDbConfig({ connMaxLifetime: e.target.value })} placeholder="30m" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseConnMaxIdleTime")}</Label>
                                                            <Input value={userDbConfig.connMaxIdleTime} onChange={(e) => updateUserDbConfig({ connMaxIdleTime: e.target.value })} placeholder="10m" className="rounded-xl" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.databaseMaxWriteConcurrency")}</Label>
                                                            <Input type="number" value={userDbConfig.maxWriteConcurrency} onChange={(e) => updateUserDbConfig({ maxWriteConcurrency: parseInt(e.target.value) || 0 })} placeholder="100" className="rounded-xl" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                                    <Button onClick={handleTestUserDb} disabled={isTestingUserDb} variant="outline" className="rounded-xl">
                                                        {isTestingUserDb ? (
                                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                                        ) : (
                                                            <><Zap className="h-4 w-4 mr-2" />{t("ui.settings.testConnection")}</>
                                                        )}
                                                    </Button>
                                                    <Button onClick={handleSaveUserDb} disabled={savingUserDb || !hasTestedUserDb} className="rounded-xl">
                                                        {savingUserDb ? (
                                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                                        ) : (
                                                            <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                                        )}
                                                    </Button>
                                                    {!hasTestedUserDb && !isTestingUserDb && (
                                                        <span className="text-xs text-muted-foreground animate-pulse">{t("ui.settings.testRequiredBeforeSave")}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="tunnel" className="p-6 space-y-5 mt-0 outline-none">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                            <Router className="h-5 w-5" />
                                            {t("ui.settings.tunnelGatewayConfig")}
                                        </h2>
                                        <p className="text-sm text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.tunnelGatewayDesc") }} />
                                    </div>

                                    {cloudflareConfig && (
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <h3 className="text-md font-semibold text-primary">Cloudflare Tunnel</h3>
                                                <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.cloudflareDesc") }} />
                                            </div>
                                            <div className="space-y-3 pl-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="cfEnabled" checked={cloudflareConfig.enabled} onCheckedChange={(checked) => updateCloudflareConfig({ enabled: !!checked })} />
                                                        <Label htmlFor="cfEnabled" className="text-sm cursor-pointer">{t("ui.common.isEnabled")}</Label>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-sm font-medium">Token</Label>
                                                    <Input value={cloudflareConfig.token} onChange={(e) => updateCloudflareConfig({ token: e.target.value })} placeholder="e.g. eyJh..." className="rounded-xl" />
                                                </div>
                                                <div className="flex flex-col gap-1 pt-1">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="cfLogEnabled" checked={cloudflareConfig.logEnabled} onCheckedChange={(checked) => updateCloudflareConfig({ logEnabled: !!checked })} />
                                                        <Label htmlFor="cfLogEnabled" className="text-sm cursor-pointer">{t("ui.settings.enableLog")}</Label>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground pl-6">{t("ui.settings.cloudflareLogDesc")}</p>
                                                </div>
                                                <div className="flex items-center gap-3 pt-2">
                                                    <Button onClick={handleSaveCloudflare} disabled={savingCloudflare} className="rounded-xl">
                                                        {savingCloudflare ? (
                                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                                        ) : (
                                                            <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveCloudflare")}</>
                                                        )}
                                                    </Button>
                                                    <Button onClick={handleTestCloudflared} disabled={isTestingCloudflared} className="rounded-xl" variant="outline">
                                                        {isTestingCloudflared ? (
                                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.common.downloading")}</>
                                                        ) : (
                                                            <><Download className="h-4 w-4 mr-2" />{t("ui.settings.downloadCloudflared")}</>
                                                        )}
                                                    </Button>
                                                    <AlertDialog open={showDownloadError} onOpenChange={setShowDownloadError}>
                                                        <AlertDialogContent className="rounded-2xl max-w-2xl w-[90vw]">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                                                    <Shield className="h-5 w-5" />
                                                                    {t("ui.settings.downloadFailed")}
                                                                 </AlertDialogTitle>
                                                                 <AlertDialogDescription className="whitespace-pre-wrap break-all mt-2 font-mono text-xs bg-muted/50 p-4 rounded-xl border border-border/50 max-h-60 overflow-y-auto">
                                                                     {downloadErrorMessage}
                                                                 </AlertDialogDescription>
                                                             </AlertDialogHeader>
                                                             <AlertDialogFooter>
                                                                 <AlertDialogCancel className="rounded-xl w-full sm:w-auto">{t("ui.common.confirm")}</AlertDialogCancel>
                                                             </AlertDialogFooter>
                                                         </AlertDialogContent>
                                                     </AlertDialog>
                                                 </div>
                                             </div>
                                         </div>
                                     )}
                                 </TabsContent>

                                <TabsContent value="advanced" className="p-6 space-y-5 mt-0 outline-none">
                                    <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                        <Cog className="h-5 w-5" />
                                        {t("ui.settings.advancedConfig")}
                                    </h2>

                                    {/* 自定义Header头 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{t("ui.settings.customResponseHeaders")}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {headersList.map((item) => (
                                                <div key={item.id} className="flex gap-2 items-center animate-in fade-in duration-200">
                                                    <Input
                                                        value={item.key}
                                                        onChange={(e) => updateHeaderRow(item.id, e.target.value, item.value)}
                                                        placeholder={t("ui.settings.headerNamePlaceholder")}
                                                        className="rounded-xl flex-1"
                                                    />
                                                    <span className="text-muted-foreground">:</span>
                                                    <Input
                                                        value={item.value}
                                                        onChange={(e) => updateHeaderRow(item.id, item.key, e.target.value)}
                                                        placeholder={t("ui.settings.headerValuePlaceholder")}
                                                        className="rounded-xl flex-1"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        type="button"
                                                        onClick={() => removeHeaderRow(item.id)}
                                                        className="rounded-xl text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                type="button"
                                                onClick={addHeaderRow}
                                                className="rounded-xl mt-1"
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t("ui.settings.addHeader")}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.customResponseHeadersDesc") }} />
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* Git 提交设置 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <GitBranch className="h-4 w-4" />
                                            {t("ui.settings.gitSettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.gitName")}</Label>
                                                <Input value={config.gitName || ""} onChange={(e) => updateConfig({ gitName: e.target.value })} placeholder="e.g. FNS Service" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.gitNameDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.gitEmail")}</Label>
                                                <Input value={config.gitEmail || ""} onChange={(e) => updateConfig({ gitEmail: e.target.value })} placeholder="e.g. fns@email.com" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.gitEmailDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* 应用基础设置 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <Sliders className="h-4 w-4" />
                                            {t("ui.settings.appSettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.defaultPageSize")}</Label>
                                                <Input type="number" value={config.defaultPageSize || 10} onChange={(e) => updateConfig({ defaultPageSize: parseInt(e.target.value) || 10 })} placeholder="e.g. 10" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.defaultPageSizeDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.maxPageSize")}</Label>
                                                <Input type="number" value={config.maxPageSize || 100} onChange={(e) => updateConfig({ maxPageSize: parseInt(e.target.value) || 100 })} placeholder="e.g. 100" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.maxPageSizeDesc")}</p>
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.defaultContextTimeout")}</Label>
                                                <Input type="number" value={config.defaultContextTimeout || 60} onChange={(e) => updateConfig({ defaultContextTimeout: parseInt(e.target.value) || 60 })} placeholder="e.g. 60" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.defaultContextTimeoutDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* 存储与日志 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <HardDrive className="h-4 w-4" />
                                            {t("ui.settings.logAndStorageSettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.tempPath")}</Label>
                                                <Input value={config.tempPath || ""} onChange={(e) => updateConfig({ tempPath: e.target.value })} placeholder="e.g. storage/temp" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.tempPathDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.syncLogRetentionTime")}</Label>
                                                <Input value={config.syncLogRetentionTime || ""} onChange={(e) => updateConfig({ syncLogRetentionTime: e.target.value })} placeholder="e.g. 30d, 7d" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.syncLogRetentionTimeDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* 并发与队列 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t("ui.settings.concurrencySettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.workerPoolMaxWorkers")}</Label>
                                                <Input type="number" value={config.workerPoolMaxWorkers || 100} onChange={(e) => updateConfig({ workerPoolMaxWorkers: parseInt(e.target.value) || 100 })} placeholder="e.g. 100" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.workerPoolMaxWorkersDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.workerPoolQueueSize")}</Label>
                                                <Input type="number" value={config.workerPoolQueueSize || 1000} onChange={(e) => updateConfig({ workerPoolQueueSize: parseInt(e.target.value) || 1000 })} placeholder="e.g. 1000" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.workerPoolQueueSizeDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.writeQueueCapacity")}</Label>
                                                <Input type="number" value={config.writeQueueCapacity || 1000} onChange={(e) => updateConfig({ writeQueueCapacity: parseInt(e.target.value) || 1000 })} placeholder="e.g. 1000" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.writeQueueCapacityDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.writeQueueTimeout")}</Label>
                                                <Input value={config.writeQueueTimeout || ""} onChange={(e) => updateConfig({ writeQueueTimeout: e.target.value })} placeholder="e.g. 30s, 1m" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.writeQueueTimeoutDesc")}</p>
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.writeQueueIdleTime")}</Label>
                                                <Input value={config.writeQueueIdleTime || ""} onChange={(e) => updateConfig({ writeQueueIdleTime: e.target.value })} placeholder="e.g. 10m, 1h" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.writeQueueIdleTimeDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* WebSocket 传输 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <Router className="h-4 w-4" />
                                            {t("ui.settings.websocketSettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.wsReadMaxPayloadSize")}</Label>
                                                <Input value={config.wsReadMaxPayloadSize || ""} onChange={(e) => updateConfig({ wsReadMaxPayloadSize: e.target.value })} placeholder="e.g. 128MB" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.wsReadMaxPayloadSizeDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.wsWriteMaxPayloadSize")}</Label>
                                                <Input value={config.wsWriteMaxPayloadSize || ""} onChange={(e) => updateConfig({ wsWriteMaxPayloadSize: e.target.value })} placeholder="e.g. 128MB" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.wsWriteMaxPayloadSizeDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.wsCompressionLevel")}</Label>
                                                <Input type="number" min="1" max="9" value={config.wsCompressionLevel || 1} onChange={(e) => updateConfig({ wsCompressionLevel: parseInt(e.target.value) || 1 })} placeholder="e.g. 1" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.wsCompressionLevelDesc")}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.wsCompressionThreshold")}</Label>
                                                <Input type="number" value={config.wsCompressionThreshold || 512} onChange={(e) => updateConfig({ wsCompressionThreshold: parseInt(e.target.value) || 512 })} placeholder="e.g. 512" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.wsCompressionThresholdDesc")}</p>
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label className="text-xs text-muted-foreground ml-1">{t("ui.settings.wsParallelGolimit")}</Label>
                                                <Input type="number" value={config.wsParallelGolimit || 5} onChange={(e) => updateConfig({ wsParallelGolimit: parseInt(e.target.value) || 5 })} placeholder="e.g. 5" className="rounded-xl" />
                                                <p className="text-[10px] text-muted-foreground ml-1">{t("ui.settings.wsParallelGolimitDesc")}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="wsParallelEnabled" checked={config.wsParallelEnabled} onCheckedChange={(checked) => updateConfig({ wsParallelEnabled: !!checked })} />
                                                    <Label htmlFor="wsParallelEnabled" className="text-sm cursor-pointer">{t("ui.settings.wsParallelEnabled")}</Label>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground ml-6">{t("ui.settings.wsParallelEnabledDesc")}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="wsCheckUtf8Enabled" checked={config.wsCheckUtf8Enabled} onCheckedChange={(checked) => updateConfig({ wsCheckUtf8Enabled: !!checked })} />
                                                    <Label htmlFor="wsCheckUtf8Enabled" className="text-sm cursor-pointer">{t("ui.settings.wsCheckUtf8Enabled")}</Label>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground ml-6">{t("ui.settings.wsCheckUtf8EnabledDesc")}</p>
                                            </div>
                                            <div className="space-y-1 sm:col-span-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="wsCompressionEnabled" checked={config.wsCompressionEnabled} onCheckedChange={(checked) => updateConfig({ wsCompressionEnabled: !!checked })} />
                                                    <Label htmlFor="wsCompressionEnabled" className="text-sm cursor-pointer">{t("ui.settings.wsCompressionEnabled")}</Label>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground ml-6">{t("ui.settings.wsCompressionEnabledDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border" />

                                    {/* 全文搜索 (Bleve FTS) */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                            <Database className="h-4 w-4" />
                                            {t("ui.settings.ftsSettings")}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="ftsBleveEnabled" checked={config.ftsBleveEnabled} onCheckedChange={(checked) => updateConfig({ ftsBleveEnabled: !!checked })} />
                                                    <Label htmlFor="ftsBleveEnabled" className="text-sm cursor-pointer">{t("ui.settings.ftsBleveEnabled")}</Label>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground ml-6">{t("ui.settings.ftsBleveEnabledDesc")}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="ftsBleveStoreRaw" checked={config.ftsBleveStoreRaw} onCheckedChange={(checked) => updateConfig({ ftsBleveStoreRaw: !!checked })} />
                                                    <Label htmlFor="ftsBleveStoreRaw" className="text-sm cursor-pointer">{t("ui.settings.ftsBleveStoreRaw")}</Label>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground ml-6">{t("ui.settings.ftsBleveStoreRawDesc")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <Button onClick={handleSaveConfig} disabled={saving} className="rounded-xl">
                                            {saving ? (
                                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                            ) : (
                                                <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveSettings")}</>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                ) : null}

            </div>
        </div>
    )
}

export default SystemSettings
