import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { GitBranch, UserPlus, HardDrive, Trash2, Clock, Shield, Loader2, Type, Lock, Save, Settings, HelpCircle, Github, Send, RefreshCw, Cpu, Download } from "lucide-react";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getBrowserLang } from "@/i18n/utils";
import env from "@/env.ts";

import { VersionOverview } from "./version-overview";
import { SupportList } from "./support-list";
import { Overview } from "./overview";


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
}

interface NgrokConfig {
    enabled: boolean
    authToken: string
    domain: string
}

interface CloudflareConfig {
    enabled: boolean
    token: string
    logEnabled: boolean
}

export function SystemSettings({ onBack, isDashboard = false }: { onBack?: () => void, isDashboard?: boolean }) {
    const { t } = useTranslation()
    const [config, setConfig] = useState<SystemConfig | null>(null)
    const [ngrokConfig, setNgrokConfig] = useState<NgrokConfig | null>(null)
    const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingNgrok, setSavingNgrok] = useState(false)
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

    const updateNgrokConfig = useCallback((updates: Partial<NgrokConfig>) => {
        setNgrokConfig(prev => prev ? { ...prev, ...updates } : null)
    }, [])

    const updateCloudflareConfig = useCallback((updates: Partial<CloudflareConfig>) => {
        setCloudflareConfig(prev => prev ? { ...prev, ...updates } : null)
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
        setSaving(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    Lang: getBrowserLang(),
                },
                body: JSON.stringify(config),
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
                toast.success(t("ui.settings.saveSuccess"))
            } else {
                toast.error(res.message || t("ui.settings.saveFailed"))
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNgrok = async () => {
        if (!ngrokConfig) return
        setSavingNgrok(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config/ngrok"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    Lang: getBrowserLang(),
                },
                body: JSON.stringify(ngrokConfig),
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
                toast.success(t("ui.settings.saveSuccess"))
            } else {
                toast.error(res.message || t("ui.settings.saveFailed"))
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSavingNgrok(false)
        }
    }

    const handleSaveCloudflare = async () => {
        if (!cloudflareConfig) return
        if (!hasTestedCloudflared) {
            toast.error(t("ui.settings.cloudflaredTestRequired"))
            return
        }
        setSavingCloudflare(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/config/cloudflare"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    Lang: getBrowserLang(),
                },
                body: JSON.stringify(cloudflareConfig),
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
                toast.success(t("ui.settings.saveSuccess"))
            } else {
                toast.error(res.message || t("ui.settings.saveFailed"))
            }
        } catch {
            toast.error(t("ui.settings.saveFailed"))
        } finally {
            setSavingCloudflare(false)
        }
    }

    const handleTestCloudflared = async () => {
        setIsTestingCloudflared(true)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/cloudflared_tunnel_download"), {
                headers: { "Authorization": `Bearer ${token}`, Lang: getBrowserLang() },
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
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
        setShowRestartConfirm(false)
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/admin/restart"), {
                headers: { "Authorization": `Bearer ${token}`, Lang: getBrowserLang() },
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
                toast.success(t("api.system.restart.success"))
                setOverviewRefreshKey(prev => prev + 1)
            } else {
                toast.error(res.message || t("api.system.restart.error"))
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
                headers: { "Authorization": `Bearer ${token}`, Lang: getBrowserLang() },
            })
            const res = await response.json()
            if (res.code === 0 || (res.code < 100 && res.code > 0)) {
                toast.success(t("ui.system.manualGCSuccess"))
                setOverviewRefreshKey(prev => prev + 1)
            } else {
                toast.error(res.message || t("api.system.gc.error"))
            }
        } catch {
            toast.error(t("api.system.gc.error"))
        } finally {
            setIsGCing(false)
        }
    }

    useEffect(() => {
        const fetchConfig = async () => {
            if (isDashboard) {
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                const headers = { "Authorization": `Bearer ${token}`, Lang: getBrowserLang() }

                const [configRes, ngrokRes, cloudflareRes] = await Promise.all([
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config"), { headers }).then(res => res.json()),
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config/ngrok"), { headers }).then(res => res.json()),
                    fetch(addCacheBuster(env.API_URL + "/api/admin/config/cloudflare"), { headers }).then(res => res.json())
                ])

                if (configRes.code === 0 || (configRes.code < 100 && configRes.code > 0)) {
                    setConfig(configRes.data)
                } else {
                    toast.error(configRes.message || t("ui.common.error"))
                    if (!config) onBack?.()
                }

                if (ngrokRes.code === 0 || (ngrokRes.code < 100 && ngrokRes.code > 0)) {
                    setNgrokConfig(ngrokRes.data)
                }

                if (cloudflareRes.code === 0 || (cloudflareRes.code < 100 && cloudflareRes.code > 0)) {
                    setCloudflareConfig(cloudflareRes.data)
                }
            } catch {
                toast.error(t("ui.common.error"))
                if (!config) onBack?.()
            } finally {
                setLoading(false)
            }
        }
        fetchConfig()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onBack, t, token, isDashboard])

    if (loading) return <div className="p-8 text-center">{t("ui.common.loading")}</div>
    if (!config && !isDashboard) return <div className="p-8 text-center text-destructive">{t("ui.common.error")}</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4">
            {/* 左列 */}
            <div className="flex flex-col gap-4">
                {/* 版本信息 */}
                <VersionOverview showUpgrade={!isDashboard} />
                {/* 服务器系统信息 */}
                {!isDashboard && (
                    <Overview refreshKey={overviewRefreshKey}>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Settings className="h-5 w-5 text-muted-foreground" />
                                <span className="text-sm font-medium">{t("ui.common.actions")}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
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

                {/* 界面设置卡片 */}
                {config && !isDashboard && (
                    <>
                        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
                            <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                <Type className="h-5 w-5" />
                                {t("ui.settings.fontConfig")}
                            </h2>

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
                        </div>

                        {/* 中继网关卡片 */}
                        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                    <HardDrive className="h-5 w-5" />
                                    {t("ui.settings.tunnelGatewayConfig")}
                                </h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.tunnelGatewayDesc") }} />
                            </div>

                            {/* Ngrok 配置 */}
                            {ngrokConfig && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-md font-semibold text-primary">Ngrok</h3>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line" dangerouslySetInnerHTML={{ __html: t("ui.settings.ngrokDesc") }} />
                                    </div>
                                    <div className="space-y-3 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="ngrokEnabled" checked={ngrokConfig.enabled} onCheckedChange={(checked) => updateNgrokConfig({ enabled: !!checked })} />
                                                <Label htmlFor="ngrokEnabled" className="text-sm cursor-pointer">{t("ui.common.isEnabled")}</Label>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-sm font-medium">Token</Label>
                                            <Input value={ngrokConfig.authToken} onChange={(e) => updateNgrokConfig({ authToken: e.target.value })} placeholder="e.g. 2Rk9..." className="rounded-xl" />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-sm font-medium">{t("ui.settings.customDomain")}</Label>
                                            <Input value={ngrokConfig.domain} onChange={(e) => updateNgrokConfig({ domain: e.target.value })} placeholder="e.g. static.yourdomain.com" className="rounded-xl" />
                                            <p className="text-xs text-muted-foreground pt-1">
                                                {t("ui.settings.customDomainDesc")}
                                            </p>
                                        </div>

                                        <div className="pt-2">
                                            <Button onClick={handleSaveNgrok} disabled={savingNgrok} className="rounded-xl">
                                                {savingNgrok ? (
                                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                                ) : (
                                                    <><Save className="h-4 w-4 mr-2" />{t("ui.settings.saveNgrok")}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {ngrokConfig && cloudflareConfig && <div className="border-t border-border" />}

                            {/* Cloudflare 配置 */}
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
                                            <p className="text-xs text-muted-foreground pl-6">
                                                {t("ui.settings.cloudflareLogDesc")}
                                            </p>
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
                        </div>
                    </>
                )}
            </div>

            {/* 右列 */}
            <div className="flex flex-col gap-4">
                {isDashboard ? (
                    /* 概况页右侧支持列表 Box */
                    <div className="rounded-xl border border-border bg-card p-4 custom-shadow">
                        <SupportList />
                    </div>
                ) : config ? (
                    <>
                        {/* 安全设置卡片 */}
                        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
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
                                    <UserPlus className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-sm font-medium">{t("ui.settings.registerIsEnable")}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="registerIsEnable" checked={config.registerIsEnable} onCheckedChange={(checked) => updateConfig({ registerIsEnable: !!checked })} />
                                    <Label htmlFor="registerIsEnable" className="text-sm">{config.registerIsEnable ? t("ui.common.isEnabled") : t("ui.common.close")}</Label>
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
                        </div>

                        {/* 分享令牌配置卡片群 */}
                        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
                            <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                {t("ui.settings.systemConfig")}
                            </h2>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-muted-foreground" />
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
                        </div>

                        {/* 笔记关联配置卡片 */}
                        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
                            <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                <GitBranch className="h-5 w-5" />
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
                        </div>

                    </>
                ) : null}
            </div>
        </div>
    )
}

export default SystemSettings
