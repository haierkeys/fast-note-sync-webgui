import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, Info, ExternalLink, Copy } from "lucide-react";
import { useStorageHandle } from "@/components/api-handle/storage-handle";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { BackupHistory, BackupType } from "@/lib/types/backup";
import { mapError } from "@/lib/utils/error-mapper";
import { toast } from "@/components/common/Toast";
import { useEffect, useState, useCallback, useRef } from "react";
import { StorageConfig } from "@/lib/types/storage";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";


interface BackupHistoryDialogProps {
    configId: number;
    configType?: BackupType;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BackupHistoryDialog({ configId, configType, open, onOpenChange }: BackupHistoryDialogProps) {
    const { t } = useTranslation();
    const { handleBackupHistory } = useBackupHandle();
    const { handleStorageList } = useStorageHandle();
    const [history, setHistory] = useState<BackupHistory[]>([]);
    const [storages, setStorages] = useState<StorageConfig[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const pageSize = 5;
    const historyRequestIdRef = useRef(0);
    const storageRequestIdRef = useRef(0);

    const loadHistory = useCallback(async (currentPage: number) => {
        const requestId = ++historyRequestIdRef.current;
        setIsLoading(true);
        await handleBackupHistory(currentPage, pageSize, configId, (data) => {
            if (requestId !== historyRequestIdRef.current) {
                return;
            }
            setHistory(data.list);
            setTotal(data.total);
        });
        if (requestId === historyRequestIdRef.current) {
            setIsLoading(false);
        }
    }, [configId, handleBackupHistory]);

    useEffect(() => {
        if (open) {
            const storageRequestId = ++storageRequestIdRef.current;
            handleStorageList((data) => {
                if (storageRequestId !== storageRequestIdRef.current) {
                    return;
                }
                setStorages(data);
            });
            setPage(1);
            loadHistory(1);
            return;
        }

        historyRequestIdRef.current += 1;
        storageRequestIdRef.current += 1;
        setIsLoading(false);
    }, [open, loadHistory, handleStorageList]);

    useEffect(() => {
        return () => {
            historyRequestIdRef.current += 1;
            storageRequestIdRef.current += 1;
        };
    }, []);

    const getStorageType = (storageId: number) => {
        const storage = storages.find(s => Number(s.id) === storageId);
        return storage ? storage.type : "-";
    };

    const getFileUrl = (storageId: number, filePath: string) => {
        const storage = storages.find(s => Number(s.id) === storageId);
        if (!storage || !storage.accessUrlPrefix) return null;

        let url = storage.accessUrlPrefix.endsWith('/') ? storage.accessUrlPrefix.slice(0, -1) : storage.accessUrlPrefix;
        if (storage.customPath) {
            let cp = storage.customPath.startsWith('/') ? storage.customPath.substring(1) : storage.customPath;
            cp = cp.endsWith('/') ? cp.slice(0, -1) : cp;
            if (cp) url += '/' + cp;
        }
        let fp = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        url += '/' + fp;
        return url;
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

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        {t("ui.backup.history.title")}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto border rounded-xl bg-card/50">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[180px]">{t("ui.backup.history.startTime")}</TableHead>
                                <TableHead>{t("ui.backup.history.storage")}</TableHead>
                                <TableHead>{t("ui.backup.history.status")}</TableHead>
                                <TableHead>
                                    {configType === "sync"
                                        ? t("ui.backup.history.syncStats")
                                        : t("ui.backup.history.backupStats")}
                                </TableHead>
                                <TableHead>{t("ui.backup.history.backupFile")}</TableHead>
                                <TableHead className="max-w-[200px]">{t("ui.backup.history.message")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                                            <span className="text-xs">{t("ui.common.loading")}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : history.length > 0 ? (
                                history.map((item) => (
                                    <TableRow key={item.id} className="text-xs hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-mono text-muted-foreground">{item.startTime}</TableCell>
                                        <TableCell>
                                            {getStorageType(item.storageId) !== "-"
                                                ? `#${item.storageId} ${t(`ui.storage.storageType.${getStorageType(item.storageId)}`)}`
                                                : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full font-medium inline-block",
                                                item.status === 2 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                    item.status === 3 ? "bg-destructive/10 text-destructive dark:bg-destructive/20" :
                                                        item.status === 5 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                                            "bg-muted text-muted-foreground"
                                            )}>
                                                {t(`ui.backup.status.${item.status}`)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{formatFileSize(item.fileSize)}</span>
                                                <span className="text-muted-foreground opacity-70 text-[10px]">{item.fileCount || 0} {t("ui.backup.fileCountUnit")}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate">
                                            {item.type !== 'sync' && item.filePath ? (
                                                (() => {
                                                    const url = getFileUrl(item.storageId, item.filePath);
                                                    const safeUrl = getSafeHttpUrl(url);
                                                    const fileName = item.filePath.split('/').pop() || item.filePath;
                                                    return safeUrl ? (
                                                        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-blue-500 hover:underline flex items-center gap-1 transition-colors" title={item.filePath}>
                                                            <span className="truncate">{fileName}</span>
                                                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                                                        </a>
                                                    ) : (
                                                        <span title={item.filePath} className="truncate inline-block max-w-full">{fileName}</span>
                                                    );
                                                })()
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[250px]">
                                            {(() => {
                                                if (!item.message) return <span className="opacity-70">-</span>;
                                                const errorKey = item.status === 3 ? mapError(item.message) : null;
                                                if (errorKey) {
                                                    return (
                                                        <div className="flex items-center gap-1">
                                                            <span className="truncate text-destructive/90" title={item.message}>
                                                                {t(errorKey)}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(item.message!).then(
                                                                        () => toast.success(t("ui.common.copied")),
                                                                        () => toast.error(t("ui.common.error"))
                                                                    );
                                                                }}
                                                                title={t("ui.backup.history.copyError")}
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    );
                                                }
                                                if (item.status === 3) {
                                                    return (
                                                        <div className="flex items-center gap-1">
                                                            <span className="truncate opacity-70" title={item.message}>
                                                                {item.message}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(item.message!).then(
                                                                        () => toast.success(t("ui.common.copied")),
                                                                        () => toast.error(t("ui.common.error"))
                                                                    );
                                                                }}
                                                                title={t("ui.backup.history.copyError")}
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    );
                                                }
                                                return <span className="truncate opacity-70" title={item.message}>{item.message}</span>;
                                            })()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        {t("ui.backup.history.noData")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {(totalPages > 1 || (total === -1 && (history.length === pageSize || page > 1))) && (
                    <div className="flex items-center justify-between mt-4 px-1">
                        <div className="text-xs text-muted-foreground">
                            {total !== -1 && `${t("ui.common.total")} ${total} ${t("ui.common.items")}`}
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
                                {total !== -1 ? `${page} / ${totalPages}` : `${t("ui.common.page")} ${page}`}
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
                                disabled={(total !== -1 ? page >= totalPages : history.length < pageSize) || isLoading}
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
