import { Server, RefreshCw, Loader2, Activity, Cpu, AlertCircle } from "lucide-react";
import { useSystemInfo } from "@/components/api-handle/use-system-info";
import { formatFileSize } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";


export function Overview({ refreshKey, children }: { refreshKey?: number, children?: React.ReactNode }) {
    const { t } = useTranslation()
    const { systemInfo, isLoading: systemLoading, refresh: refreshSystemInfo } = useSystemInfo()

    useEffect(() => {
        if (refreshKey) {
            refreshSystemInfo()
        }
    }, [refreshKey, refreshSystemInfo])

    if (systemLoading && !systemInfo) {
        return (
            <div className="flex items-center justify-center p-12 bg-card rounded-xl border border-border">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">{t("ui.common.loading")}</span>
            </div>
        )
    }

    if (!systemInfo) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border space-y-2">
                <AlertCircle className="h-8 w-8 text-destructive opacity-50" />
                <div className="text-sm text-destructive">{t("ui.common.error")}</div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 custom-shadow">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {t("ui.system.serviceInfo")}
                </h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refreshSystemInfo()}
                    disabled={systemLoading}
                    className="h-8 w-8 rounded-full hover:bg-muted"
                >
                    <RefreshCw className={`h-4 w-4 ${systemLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="space-y-8">
                {/* Service Runtime Info */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Activity className="h-4 w-4" />
                        {t("ui.system.runtimeInfo")}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-xs">
                        <div className="text-muted-foreground">{t("ui.system.goVersion")} / {t("ui.system.goroutines")} / {t("ui.system.numGc")}</div>
                        <div className="sm:text-right font-medium text-[11px] sm:text-xs">
                            {systemInfo.host.os}/{systemInfo.host.arch}
                            <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                            <span className="font-mono">{systemInfo.runtimeStatus.numGoroutine}</span>
                            <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                            <span className="font-mono">{systemInfo.runtimeStatus.numGc}</span>
                        </div>

                        <div className="text-muted-foreground">{t("ui.system.startTime")} / {t("ui.system.serviceUptime")}</div>
                        <div className="sm:text-right text-[11px] font-medium">
                            <span>{(() => {
                                const date = new Date(systemInfo.startTime);
                                const formatted = date.toLocaleString();
                                const offset = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' })
                                    .formatToParts(date)
                                    .find(p => p.type === 'timeZoneName')?.value || "";
                                return `${formatted} (${offset})`;
                            })()}</span>
                            <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                            <span className="text-muted-foreground">
                                {Math.floor(systemInfo.uptime / 3600)}h{Math.floor((systemInfo.uptime % 3600) / 60)}m{Math.floor(systemInfo.uptime % 60)}s
                            </span>
                        </div>

                        <div className="col-span-2 space-y-2 mt-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{t("ui.system.heapMemory")}</span>
                                <span className="font-medium">
                                    {formatFileSize(systemInfo.runtimeStatus.memAlloc)} / {formatFileSize(systemInfo.runtimeStatus.memSys)}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-700 ease-out"
                                    style={{ width: `${Math.min(100, (systemInfo.runtimeStatus.memAlloc / systemInfo.runtimeStatus.memSys) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border/50" />

                {/* System Hardware Info */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Cpu className="h-4 w-4" />
                        {t("ui.system.hostInfo")}
                    </div>

                    {/* Host Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-xs">
                        <div className="text-muted-foreground">{t("ui.system.systemTime")}</div>
                        <div className="sm:text-right font-medium">{(() => {
                            const date = new Date(systemInfo.host.currentTime);
                            const formatted = date.toLocaleString();
                            const offset = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' })
                                .formatToParts(date)
                                .find(p => p.type === 'timeZoneName')?.value || "";
                            return `${formatted} (${offset})`;
                        })()}</div>

                        <div className="text-muted-foreground">{t("ui.system.os")} / {t("ui.system.kernelVersion")}</div>
                        <div className="sm:text-right font-medium text-[10px] sm:text-xs truncate" title={`${systemInfo.host.osPretty} (${systemInfo.host.kernelVersion})`}>
                            {systemInfo.host.osPretty}
                            <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                            <span className="font-mono">{systemInfo.host.kernelVersion}</span>
                        </div>
                    </div>

                    {/* CPU Details */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 text-xs">
                            <div className="text-muted-foreground">{t("ui.system.modelName")}</div>
                            <div className="font-medium truncate sm:text-right" title={systemInfo.cpu.modelName}>{systemInfo.cpu.modelName}</div>

                            <div className="text-muted-foreground">{t("ui.system.physicalCores")} / {t("ui.system.cpuLoad")}</div>
                            <div className="sm:text-right font-medium">
                                {systemInfo.cpu.logicalCores}/{systemInfo.cpu.physicalCores}
                                <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                                {systemInfo.cpu.loadAvg.load1.toFixed(2)} {systemInfo.cpu.loadAvg.load5.toFixed(2)} {systemInfo.cpu.loadAvg.load15.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Memory Details */}
                    <div className="space-y-2.5">
                        <div className="space-y-2">
                            <div className="flex flex-wrap justify-between text-xs">
                                <span className="text-muted-foreground">{t("ui.system.memoryUsage")} / {t("ui.system.usedMemory")} / {t("ui.system.totalMemory")}</span>
                                <span className="font-medium">
                                    <span className="font-semibold">{systemInfo.memory.usedPercent.toFixed(1)}%</span>
                                    <span className="text-muted-foreground mx-1.5 opacity-50">|</span>
                                    {formatFileSize(systemInfo.memory.used)} / {formatFileSize(systemInfo.memory.total)}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                                <div
                                    className={`h-full transition-all duration-700 ease-out fill-mode-forwards ${systemInfo.memory.usedPercent > 85 ? 'bg-destructive' : systemInfo.memory.usedPercent > 65 ? 'bg-orange-500' : 'bg-primary'}`}
                                    style={{ width: `${systemInfo.memory.usedPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {children && (
                <>
                    <div className="border-t border-border/50" />
                    {children}
                </>
            )}
        </div>
    )
}
