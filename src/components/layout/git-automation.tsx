import { GitBranch, GitPullRequestArrow, History, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, ShieldCheck, Pencil, Trash2, Play, Eraser, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { GitHistoryDialog } from "@/components/layout/git-history-dialog";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { GitSyncConfigDTO, GitSyncHistoryDTO } from "@/lib/types/git";
import { GitConfigForm } from "@/components/layout/git-config-form";
import { useGitHandle } from "@/components/api-handle/git-handle";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { cn } from "@/lib/utils";


/**
 * Git 自动化管理组件
 */
export function GitAutomation() {
    const { t } = useTranslation();
    const { openConfirmDialog } = useConfirmDialog();
    const { handleGitSyncList, handleGitSyncDelete, handleGitSyncExecute, handleGitSyncClean, handleGitSyncHistories } = useGitHandle();
    const { handleVaultList } = useVaultHandle();

    const [configs, setConfigs] = useState<GitSyncConfigDTO[]>([]);
    const [vaults, setVaults] = useState<VaultType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // 右侧全局历史记录
    const [globalHistories, setGlobalHistories] = useState<GitSyncHistoryDTO[]>([]);
    const [globalHistoryTotal, setGlobalHistoryTotal] = useState(0);
    const [globalHistoryPage, setGlobalHistoryPage] = useState(1);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const globalHistoryPageSize = 10;

    // 配置历史记录对话框
    const [dialogConfigId, setDialogConfigId] = useState<number | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const loadConfigs = useCallback(async () => {
        try {
            await handleGitSyncList((data) => {
                setConfigs(data);
            });
        } catch (error) {
            console.error("Git config load error:", error);
        }
    }, [handleGitSyncList]);

    const loadVaults = useCallback(async () => {
        try {
            await handleVaultList((data) => {
                setVaults(data);
            });
        } catch (error) {
            console.error("Vault list load error:", error);
        }
    }, [handleVaultList]);

    const reloadData = useCallback(async () => {
        setIsLoading(true);
        try {
            await Promise.all([loadConfigs(), loadVaults()]);
        } finally {
            setIsLoading(false);
        }
    }, [loadConfigs, loadVaults]);

    const loadGlobalHistory = useCallback(async (page: number) => {
        setIsHistoryLoading(true);
        await handleGitSyncHistories(page, globalHistoryPageSize, undefined, (data) => {
            setGlobalHistories(data.list);
            setGlobalHistoryTotal(data.total);
        });
        setIsHistoryLoading(false);
    }, [handleGitSyncHistories]);

    useEffect(() => {
        reloadData();
        loadGlobalHistory(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (id: number) => {
        openConfirmDialog(t("ui.git.delete.confirm"), "confirm", async () => {
            await handleGitSyncDelete(id, reloadData);
        });
    };

    const handleExecute = async (id: number) => {
        await handleGitSyncExecute(id, () => {
            setTimeout(() => {
                reloadData();
                loadGlobalHistory(1);
            }, 1000);
        });
    };

    const handleClean = (id: number) => {
        openConfirmDialog(t("ui.git.clean.confirm"), "confirm", async () => {
            await handleGitSyncClean(id, reloadData);
        });
    };

    const openConfigHistory = (configId: number) => {
        setDialogConfigId(configId);
        setIsDialogOpen(true);
    };

    const globalTotalPages = globalHistoryTotal > 0 ? Math.ceil(globalHistoryTotal / globalHistoryPageSize) : 1;

    // 通过 configId 查找对应的笔记仓库名称
    const getVaultName = (configId: number): string => {
        return configs.find(c => c.id === configId)?.vault ?? `#${configId}`;
    };

    /** 计算提交耗时，返回格式如 "3s" "1m 23s" "-" */
    const calcDuration = (start: string, end: string): string => {
        if (!start || !end) return "-";
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (isNaN(ms) || ms < 0) return "-";
        const s = Math.round(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    const getSafeHttpUrl = (url?: string | null): string | null => {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? url : null;
        } catch {
            return null;
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4 items-start">
            {/* 左侧栏 - Git 仓库配置 */}
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <GitPullRequestArrow className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{t("ui.git.config")}</h2>
                                <p className="text-xs text-muted-foreground">{t("ui.git.configDesc")}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={reloadData}
                                disabled={isLoading}
                                className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary"
                            >
                                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            </Button>
                            <Button onClick={() => setIsAdding(true)} className="rounded-xl">
                                <Plus className="h-4 w-4 mr-2" />
                                {t("ui.common.add")}
                            </Button>
                        </div>
                    </div>

                    {isAdding && (
                        <div className="p-4 border border-primary/20 rounded-xl bg-primary/5 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.git.addConfig")}</h3>
                            </div>
                            <GitConfigForm
                                vaults={vaults}
                                onSubmit={() => { setIsAdding(false); reloadData(); }}
                                onCancel={() => setIsAdding(false)}
                            />
                        </div>
                    )}

                    {editingId !== null && (
                        <div className="p-4 border border-primary/20 rounded-xl bg-primary/5 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.git.editConfig")}</h3>
                            </div>
                            <GitConfigForm
                                vaults={vaults}
                                config={configs.find(c => c.id === editingId)}
                                onSubmit={() => { setEditingId(null); reloadData(); }}
                                onCancel={() => setEditingId(null)}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {isLoading && configs.length === 0 ? (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-50" />
                                <p className="text-sm">{t("ui.git.loading")}</p>
                            </div>
                        ) : configs.length > 0 ? (
                            configs.map((config) => (
                                <div
                                    key={config.id}
                                    className={cn(
                                        "group flex flex-col p-4 transition-all duration-200 border rounded-xl bg-background hover:bg-accent/30",
                                        config.isEnabled
                                            ? "border-l-4 border-l-orange-500 shadow-sm"
                                            : "border-l-4 border-l-muted border-y-border border-r-border"
                                    )}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <ShieldCheck className={cn("h-5 w-5 shrink-0", config.isEnabled ? "text-orange-500" : "text-muted-foreground")} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[12px] px-1.5 py-0.5 bg-muted rounded font-mono text-muted-foreground">#{config.id}</span>
                                                    <span className="font-bold">{config.vault}</span>
                                                    <span className="text-[12px] px-1.5 py-0.5 bg-accent rounded font-mono text-muted-foreground">
                                                        {config.branch}
                                                    </span>
                                                </div>
                                                {(() => {
                                                    const safeRepoUrl = getSafeHttpUrl(config.repoUrl);
                                                    return safeRepoUrl ? (
                                                        <a href={safeRepoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary font-mono truncate max-w-[200px] sm:max-w-[300px] block hover:underline">
                                                            {config.repoUrl}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-[300px] block">
                                                            {config.repoUrl}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-green-600 rounded-lg"
                                                onClick={() => handleExecute(config.id)}
                                                title={t("ui.git.execute.title")}
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                                onClick={() => openConfigHistory(config.id)}
                                                title={t("ui.git.history.title")}
                                            >
                                                <History className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-orange-500 rounded-lg"
                                                onClick={() => handleClean(config.id)}
                                                title={t("ui.git.clean.title")}
                                            >
                                                <Eraser className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-orange-500 rounded-lg"
                                                onClick={() => setEditingId(config.id)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                onClick={() => handleDelete(config.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                                        <div className="flex items-center gap-x-2 gap-y-1 text-muted-foreground flex-wrap">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t("ui.git.lastCommit")}: {config.lastSyncTime || t("ui.git.neverRun")}</span>
                                            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{t("ui.git.checkTime")}: {config.updatedAt || t("ui.git.neverRun")}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0">
                                            {config.lastStatus === 1 ? (
                                                <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                                            ) : config.lastStatus === 2 ? (
                                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            ) : config.lastStatus === 3 ? (
                                                <AlertCircle className="h-3 w-3 text-destructive" />
                                            ) : (
                                                <Clock className="h-3 w-3 opacity-30" />
                                            )}
                                            <span className={cn(
                                                config.lastStatus === 2 && "text-green-600",
                                                config.lastStatus === 3 && "text-destructive"
                                            )}>
                                                {t(`ui.git.status.${config.lastStatus ?? 0}`)}
                                            </span>
                                        </div>
                                    </div>
                                    {config.lastMessage && config.lastStatus === 3 && (
                                        <p className="mt-2 p-2 bg-destructive/5 text-destructive border border-destructive/10 rounded-md text-[10px] leading-relaxed">
                                            {config.lastMessage}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                <GitBranch className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm opacity-70 font-medium">{t("ui.git.noConfig")}</p>
                                <Button variant="link" size="sm" onClick={() => setIsAdding(true)} className="mt-2">
                                    {t("ui.git.addFirst")}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 右侧栏 - 自动化提交记录 */}
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <History className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{t("ui.git.history")}</h2>
                                <p className="text-xs text-muted-foreground">{t("ui.git.historyDesc")}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setGlobalHistoryPage(1); loadGlobalHistory(1); }}
                            disabled={isHistoryLoading}
                            className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary"
                        >
                            <RefreshCw className={cn("h-4 w-4", isHistoryLoading && "animate-spin")} />
                        </Button>
                    </div>

                    {/* 历史记录列表 */}
                    <div className="flex flex-col gap-2">
                        {isHistoryLoading && globalHistories.length === 0 ? (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-50" />
                                <p className="text-sm">{t("ui.common.loading")}</p>
                            </div>
                        ) : globalHistories.length > 0 ? (
                            <>
                                <div className="space-y-1.5">
                                    {globalHistories.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/60 bg-background hover:bg-accent/30 transition-colors text-sm"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {item.status === 1 ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
                                                ) : item.status === 2 ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                                ) : item.status === 3 ? (
                                                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                                ) : (
                                                    <Clock className="h-4 w-4 opacity-30 shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-muted-foreground text-xs">#{item.configId}</span>
                                                        <span className="font-medium text-foreground/80">{getVaultName(item.configId)}</span>
                                                        <span className={cn(
                                                            "font-medium",
                                                            item.status === 2 && "text-green-600 dark:text-green-400",
                                                            item.status === 3 && "text-destructive"
                                                        )}>
                                                            {t(`ui.git.status.${item.status}`)}
                                                        </span>
                                                    </div>
                                                    {item.message && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-65" title={item.message}>
                                                            {item.message}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0 ml-2 gap-0.5">
                                                <span className="text-xs text-muted-foreground font-mono">{item.startTime}</span>
                                                <span className="text-xs text-primary/70 font-mono">{calcDuration(item.startTime, item.endTime)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 分页 */}
                                {(globalTotalPages > 1 || (globalHistoryTotal === -1 && (globalHistories.length === globalHistoryPageSize || globalHistoryPage > 1))) && (
                                    <div className="flex items-center justify-between mt-2 px-1">
                                        <span className="text-[10px] text-muted-foreground">
                                            {globalHistoryTotal > 0 && `${t("ui.common.total")} ${globalHistoryTotal} ${t("ui.common.items")}`}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                    const p = globalHistoryPage - 1;
                                                    setGlobalHistoryPage(p);
                                                    loadGlobalHistory(p);
                                                }}
                                                disabled={globalHistoryPage <= 1 || isHistoryLoading}
                                            >
                                                <ChevronLeft className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-medium px-1">
                                                {globalHistoryTotal > 0 ? `${globalHistoryPage} / ${globalTotalPages}` : `P${globalHistoryPage}`}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => {
                                                    const p = globalHistoryPage + 1;
                                                    setGlobalHistoryPage(p);
                                                    loadGlobalHistory(p);
                                                }}
                                                disabled={(globalHistoryTotal > 0 ? globalHistoryPage >= globalTotalPages : globalHistories.length < globalHistoryPageSize) || isHistoryLoading}
                                            >
                                                <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                <History className="h-12 w-12 mb-3 opacity-10" />
                                <p className="text-sm font-medium opacity-60">{t("ui.git.history.noData")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 按配置 ID 查看历史的对话框 */}
            <GitHistoryDialog
                configId={dialogConfigId}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </div>
    );
}
