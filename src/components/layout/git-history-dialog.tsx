import { ChevronLeft, ChevronRight, Loader2, GitCommitHorizontal, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGitHandle } from "@/components/api-handle/git-handle";
import { useEffect, useState, useCallback, useRef } from "react";
import { GitSyncHistoryDTO } from "@/lib/types/git";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";


interface GitHistoryDialogProps {
    /** 传入时按该配置 ID 过滤；不传则展示所有配置的历史 */
    configId?: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Git 同步历史记录对话框
 */
export function GitHistoryDialog({ configId, open, onOpenChange }: GitHistoryDialogProps) {
    const { t } = useTranslation();
    const { handleGitSyncHistories } = useGitHandle();
    const [history, setHistory] = useState<GitSyncHistoryDTO[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const pageSize = 10;
    const historyRequestIdRef = useRef(0);

    const loadHistory = useCallback(async (currentPage: number) => {
        const requestId = ++historyRequestIdRef.current;
        setIsLoading(true);
        await handleGitSyncHistories(currentPage, pageSize, configId, (data) => {
            if (requestId !== historyRequestIdRef.current) {
                return;
            }
            setHistory(data.list);
            setTotal(data.total);
        });
        if (requestId === historyRequestIdRef.current) {
            setIsLoading(false);
        }
    }, [configId, handleGitSyncHistories]);

    useEffect(() => {
        if (open) {
            setPage(1);
            loadHistory(1);
            return;
        }

        historyRequestIdRef.current += 1;
        setIsLoading(false);
    }, [open, loadHistory]);

    useEffect(() => {
        return () => {
            historyRequestIdRef.current += 1;
        };
    }, []);

    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    /** 计算提交耗时，返回格式如 "3s" "1m 23s" "-" */
    const calcDuration = (start: string, end: string): string => {
        if (!start || !end) return "-";
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (isNaN(ms) || ms < 0) return "-";
        const s = Math.round(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    const getStatusIcon = (status: number) => {
        if (status === 1) return <Clock className="h-3 w-3 animate-pulse text-orange-500" />;
        if (status === 2) return <CheckCircle2 className="h-3 w-3 text-green-500" />;
        if (status === 3) return <AlertCircle className="h-3 w-3 text-destructive" />;
        return <Clock className="h-3 w-3 opacity-40" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <GitCommitHorizontal className="h-5 w-5 text-primary" />
                        {configId !== undefined
                            ? `${t("ui.git.history.title")} #${configId}`
                            : t("ui.git.history.title")}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto border rounded-xl bg-card/50">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-12">ID</TableHead>
                                {configId === undefined && (
                                    <TableHead className="w-16">{t("ui.git.history.configId")}</TableHead>
                                )}
                                <TableHead className="w-40">{t("ui.git.history.startTime")}</TableHead>
                                <TableHead className="w-24">{t("ui.git.history.duration")}</TableHead>
                                <TableHead className="w-24">{t("ui.git.history.status")}</TableHead>
                                <TableHead>{t("ui.git.history.message")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={configId === undefined ? 6 : 5} className="h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                                            <span className="text-xs">{t("ui.common.loading")}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : history.length > 0 ? (
                                history.map((item) => (
                                    <TableRow key={item.id} className="text-xs hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-mono text-muted-foreground">{item.id}</TableCell>
                                        {configId === undefined && (
                                            <TableCell className="font-mono text-muted-foreground">#{item.configId}</TableCell>
                                        )}
                                        <TableCell className="font-mono text-muted-foreground">{item.startTime || "-"}</TableCell>
                                        <TableCell className="font-mono text-muted-foreground">{calcDuration(item.startTime, item.endTime)}</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium",
                                                item.status === 2 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                    item.status === 3 ? "bg-destructive/10 text-destructive dark:bg-destructive/20" :
                                                        item.status === 1 ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
                                                            "bg-muted text-muted-foreground"
                                            )}>
                                                {getStatusIcon(item.status)}
                                                {t(`ui.git.status.${item.status}`)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-65 truncate opacity-80" title={item.message}>
                                            {item.message || "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={configId === undefined ? 6 : 5} className="h-48 text-center text-muted-foreground">
                                        {t("ui.git.history.noData")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {(totalPages > 1 || (total === -1 && (history.length === pageSize || page > 1))) && (
                    <div className="flex items-center justify-between mt-4 px-1">
                        <div className="text-xs text-muted-foreground">
                            {total > 0 && `${t("ui.common.total")} ${total} ${t("ui.common.items")}`}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                    const newPage = page - 1;
                                    setPage(newPage);
                                    loadHistory(newPage);
                                }}
                                disabled={page <= 1 || isLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-medium px-2">
                                {total > 0 ? `${page} / ${totalPages}` : `${t("ui.common.page")} ${page}`}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                    const newPage = page + 1;
                                    setPage(newPage);
                                    loadHistory(newPage);
                                }}
                                disabled={(total > 0 ? page >= totalPages : history.length < pageSize) || isLoading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
