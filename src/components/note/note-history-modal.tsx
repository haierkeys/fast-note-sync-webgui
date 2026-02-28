import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, History, FileText, Apple, Laptop, Chrome, Smartphone, Copy, Check, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { NoteHistory, NoteHistoryDetail } from "@/lib/types/note";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { format } from "date-fns";


// 专业品牌图标组件
const WindowsIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 2V11.7H24V0L10.5 2zm0 19.9l13.5 2V12.3H10.5v9.6z" />
    </svg>
);

const AndroidIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.523 15.3414C17.0709 15.3414 16.7042 14.9747 16.7042 14.5226C16.7042 14.0705 17.0709 13.7038 17.523 13.7038C17.9751 13.7038 18.3418 14.0705 18.3418 14.5226C18.3418 14.9747 17.9751 15.3414 17.523 15.3414ZM6.47702 15.3414C6.02492 15.3414 5.65823 14.9747 5.65823 14.5226C5.65823 14.0705 6.02492 13.7038 6.47702 13.7038C6.92911 13.7038 7.29581 14.0705 7.29581 14.5226C7.29581 14.9747 6.92911 15.3414 6.47702 15.3414ZM17.8465 10.925L19.4975 8.06544C19.648 7.80481 19.5588 7.47196 19.2982 7.32145C19.0375 7.17094 18.7047 7.26017 18.5542 7.52081L16.8529 10.4677C15.4269 9.81534 13.8052 9.42997 12 9.42997C10.1948 9.42997 8.57307 9.81534 7.14713 10.4677L5.44577 7.52081C5.29527 7.26017 4.96245 7.17094 4.70181 7.32145C4.44116 7.47196 4.35194 7.80481 4.50244 8.06544L6.15347 10.925C3.06456 12.6015 1 15.7725 1 19.4673H23C23 15.7725 20.9354 12.6015 17.8465 10.925Z" />
    </svg>
);


interface NoteHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    vault: string;
    notePath: string;
    pathHash?: string;
    isRecycle?: boolean;
    onRestoreSuccess?: () => void;
}

export function NoteHistoryModal({ isOpen, onClose, vault, notePath, pathHash, isRecycle = false, onRestoreSuccess }: NoteHistoryModalProps) {
    const { t } = useTranslation();
    const { handleNoteHistoryList, handleNoteHistoryDetail, handleRestoreFromHistory } = useNoteHandle();
    const [historyList, setHistoryList] = useState<NoteHistory[]>([]);
    const [page, setPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<NoteHistoryDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDiffOnly, setShowDiffOnly] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const pageSize = 5;

    const fetchHistoryList = (currentPage: number) => {
        setLoading(true);
        handleNoteHistoryList(vault, notePath, pathHash, currentPage, pageSize, isRecycle, (data) => {
            if (data) {
                setHistoryList(data.list || []);
                if (data.pager) {
                    setTotalRows(data.pager.totalRows || 0);
                }
            } else {
                setHistoryList([]);
                setTotalRows(0);
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistoryList(page);
            setSelectedHistory(null);
            setShowOriginal(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, page, vault, notePath]);

    const handleViewDetail = (id: number) => {
        setDetailLoading(true);
        setCopied(false);
        handleNoteHistoryDetail(vault, id, (data) => {
            setSelectedHistory(data);
            setDetailLoading(false);
        });
    };

    // 处理恢复到历史版本
    const handleRestore = () => {
        if (!selectedHistory) return;
        setRestoring(true);
        handleRestoreFromHistory(vault, selectedHistory.id, () => {
            setRestoring(false);
            setRestoreConfirmOpen(false);
            onClose();
            onRestoreSuccess?.();
        });
        // 如果请求失败，也需要重置状态
        setTimeout(() => setRestoring(false), 5000);
    };

    const renderDiffs = (diffs: { Type: number, Text: string }[]) => {
        if (!diffs || !Array.isArray(diffs)) return null;

        // 1. 将 diff 段拆分为按行排列的结构，同时计算行号
        let newLineCounter = 0;
        const processedLines: { lineNum: string; segments: { Type: number, Text: string }[] }[] = [];
        let currentLineSegments: { Type: number, Text: string }[] = [];

        const commitLine = () => {
            // 判断当前行是否包含有效内容（非纯删除行）
            const isPureDelete = currentLineSegments.every(s => s.Type === -1);
            let displayNum = "-";
            if (!isPureDelete) {
                newLineCounter++;
                displayNum = newLineCounter.toString();
            }
            processedLines.push({ lineNum: displayNum, segments: [...currentLineSegments] });
            currentLineSegments = [];
        };

        diffs.forEach(d => {
            if (!d || d.Text === null || d.Text === undefined) return;
            const textContent = String(d.Text);
            const parts = textContent.split("\n");
            parts.forEach((part, i) => {
                currentLineSegments.push({ Type: d.Type, Text: part });
                if (i < parts.length - 1) {
                    commitLine();
                }
            });
        });
        if (currentLineSegments.length > 0) {
            commitLine();
        }

        // 2. 过滤逻辑：如果开启了“只看差异”，仅保留包含修改内容 (Type != 0) 的行
        const displayLines = showDiffOnly
            ? processedLines.filter(line => line.segments && line.segments.some(segment => segment.Type !== 0))
            : processedLines;

        return (
            <div className="diff-content overflow-auto max-h-[500px] p-6 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[13px] leading-7 shadow-inner text-slate-700 select-text selection:bg-blue-100 selection:text-blue-900">
                <div className="diff-line-row flex items-start group h-7">
                    <div className="line-number w-10 shrink-0 text-right pr-3 select-none text-transparent font-mono text-[11px] border-r border-transparent mr-3 leading-7">
                        -
                    </div>
                    <div className="line-content flex-1 py-0 text-slate-300 font-mono text-[11px] select-text cursor-text min-h-[28px] leading-7 h-7">
                        {notePath}
                    </div>
                </div>
                {displayLines.length === 0 ? (
                    <div className="text-center py-4 opacity-50 italic">{t("ui.history.noHistory")}</div>
                ) : (
                    displayLines.map((line, lineIndex) => {
                        const hasVisibleText = line.segments.some((segment) => String(segment.Text ?? "").length > 0);
                        return (
                            <div key={`diff-line-${lineIndex}`} className="diff-line-row flex items-start group h-7">
                                <div className="line-number w-10 shrink-0 text-right pr-3 select-none text-slate-300 font-mono text-[11px] border-r border-slate-100 mr-3 group-hover:text-slate-400 transition-colors leading-7">
                                    {line.lineNum}
                                </div>
                                <div className="line-content flex-1 py-0 min-h-[28px] leading-7 h-7">
                                    {hasVisibleText
                                        ? line.segments.map((segment, segmentIndex) => {
                                            const key = `segment-${lineIndex}-${segmentIndex}`;
                                            const text = String(segment.Text ?? "");
                                            if (segment.Type === 1) {
                                                return (
                                                    <ins key={key} className="bg-green-100 text-green-900 no-underline px-0.5 rounded-sm border-b border-green-300 font-bold">
                                                        {text}
                                                    </ins>
                                                );
                                            }
                                            if (segment.Type === -1) {
                                                return (
                                                    <del key={key} className="bg-red-100 text-red-900 line-through decoration-red-400 px-0.5 rounded-sm opacity-70">
                                                        {text}
                                                    </del>
                                                );
                                            }
                                            return <span key={key}>{text}</span>;
                                        })
                                        : "\u00A0"}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        );
    };

    const renderClientIcon = (clientName: string = "") => {
        const name = String(clientName || "").toLowerCase();

        if (name.includes("web")) {
            return <Chrome className="h-4 w-4 text-[#4285F4] shrink-0" />;
        } else if (name.includes("mac") || name.includes("apple")) {
            return <Apple className="h-4 w-4 text-[#555555] shrink-0" />;
        } else if (name.includes("win")) {
            return <WindowsIcon className="h-3.5 w-3.5 text-[#0078D4] shrink-0 translate-y-[1px]" />;
        } else if (name.includes("ios") || name.includes("iphone") || name.includes("ipad")) {
            return <Smartphone className="h-4 w-4 text-[#555555] shrink-0" />;
        } else if (name.includes("android")) {
            return <AndroidIcon className="h-4 w-4 text-[#3DDC84] shrink-0" />;
        }

        return <Laptop className="h-4 w-4 text-slate-400 shrink-0" />;
    };

    const renderOriginalContent = (content: string) => {
        if (!content) return null;

        // Normalize line endings and trim trailing newline
        const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\n$/, "");
        const lines = normalizedContent.split("\n");

        return (
            <div className="diff-content overflow-auto max-h-[500px] p-6 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[13px] leading-7 shadow-inner text-slate-700 select-text selection:bg-blue-100 selection:text-blue-900">
                <div className="diff-line-row flex items-start group h-7">
                    <div className="line-number w-10 shrink-0 text-right pr-3 select-none text-transparent font-mono text-[11px] border-r border-transparent mr-3 leading-7">
                        -
                    </div>
                    <div className="line-content flex-1 py-0 text-slate-300 font-mono text-[11px] select-text cursor-text min-h-[28px] leading-7 h-7">
                        {notePath}
                    </div>
                </div>
                {lines.map((line, index) => (
                    <div key={`original-line-${index}`} className="diff-line-row flex items-start group h-7">
                        <div className="line-number w-10 shrink-0 text-right pr-3 select-none text-slate-300 font-mono text-[11px] border-r border-slate-100 mr-3 group-hover:text-slate-400 transition-colors leading-7">
                            {index + 1}
                        </div>
                        <div className="line-content flex-1 py-0 min-h-[28px] leading-7 h-7">{line || "\u00A0"}</div>
                    </div>
                ))}
            </div>
        );
    };

    const totalPages = Math.ceil((totalRows || 0) / pageSize);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-auto max-h-[85vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-lg sm:rounded-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-normal overflow-hidden text-sm sm:text-base">
                        <History className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
                        <span className="hidden sm:inline shrink-0 text-muted-foreground">{t("ui.history.title")}:</span>
                        <span className="truncate text-foreground font-medium">{String(notePath || "").replace(/\.md$/, "")}</span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("ui.history.description")}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto py-2 sm:py-4 custom-scrollbar">
                    <div className="space-y-4 sm:space-y-6">
                        {/* 列表部分 - 移动端使用卡片布局 */}
                        <div className="border rounded-md overflow-hidden">
                            {/* 桌面端表格 */}
                            <div className="hidden sm:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">{t("ui.history.versionLabel")}</TableHead>
                                            <TableHead>{t("ui.history.clientSource")}</TableHead>
                                            <TableHead>{t("ui.common.updatedAt")}</TableHead>
                                            <TableHead className="text-right pr-7">{t("ui.common.viewDetail")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("ui.history.loading")}</TableCell>
                                            </TableRow>
                                        ) : !Array.isArray(historyList) || Array.isArray(historyList) && historyList.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("ui.history.noHistory")}</TableCell>
                                            </TableRow>
                                        ) : (
                                            historyList.filter(item => item !== null).map((item) => (
                                                <TableRow key={item.id} className={`hover:bg-muted/50 transition-colors ${selectedHistory?.id === item.id ? "bg-blue-50" : ""}`}>
                                                    <TableCell className="font-mono">v{item.version}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <span>{item.clientName || "Unknown"}</span>
                                                            {renderClientIcon(item.clientName)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {item.createdAt ? format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss") : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(item.id)}>
                                                            {t("ui.common.view")}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* 移动端卡片列表 */}
                            <div className="sm:hidden divide-y">
                                {loading ? (
                                    <div className="text-center py-8 text-muted-foreground">{t("ui.history.loading")}</div>
                                ) : !Array.isArray(historyList) || historyList.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">{t("ui.history.noHistory")}</div>
                                ) : (
                                    historyList.filter(item => item !== null).map((item) => (
                                        <div
                                            key={item.id}
                                            className={`p-3 ${selectedHistory?.id === item.id ? "bg-blue-50" : ""}`}
                                            onClick={() => handleViewDetail(item.id)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-mono font-medium">v{item.version}</span>
                                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                    {renderClientIcon(item.clientName)}
                                                    <span>{item.clientName || "Unknown"}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {item.createdAt ? format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss") : "-"}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 分页 */}
                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2">
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {t("ui.history.count", { count: totalRows })}
                                </p>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || loading}
                                        className="h-8 px-2 sm:px-3"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        <span className="hidden sm:inline ml-1">{t("ui.common.previous")}</span>
                                    </Button>
                                    <span className="text-xs sm:text-sm font-medium">
                                        {page} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || loading}
                                        className="h-8 px-2 sm:px-3"
                                    >
                                        <span className="hidden sm:inline mr-1">{t("ui.common.next")}</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 详情部分 */}
                        {selectedHistory && (
                            <div className="mt-4 sm:mt-6 border-t pt-4 sm:pt-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <h3 className="text-base sm:text-lg font-semibold flex items-baseline gap-2">
                                        <FileText className="h-4 w-4 self-center" />
                                        <span>{t("ui.history.diffDetails", { version: selectedHistory.version })}</span>
                                        <div className="flex items-baseline gap-2 ml-2 text-[10px] font-normal uppercase tracking-wider">
                                            <span className="px-1.5 py-0 rounded bg-green-100 text-muted-foreground/60 border border-green-200/50 leading-tight">
                                                {t("ui.history.diffLegendAdd")}
                                            </span>
                                            <span className="px-1.5 py-0 rounded bg-red-100 text-muted-foreground/60 border border-red-200/50 leading-tight">
                                                {t("ui.history.diffLegendDel")}
                                            </span>
                                        </div>
                                    </h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* 恢复到此版本按钮 */}
                                        {!isRecycle && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setRestoreConfirmOpen(true)}
                                                className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                {t("ui.history.restoreToVersion")}
                                            </Button>
                                        )}
                                        <div className="flex items-center space-x-2 bg-slate-100 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                            <Checkbox
                                                id="showDiffOnly"
                                                checked={showDiffOnly}
                                                onCheckedChange={(checked) => {
                                                    const val = !!checked;
                                                    setShowDiffOnly(val);
                                                    if (val) setShowOriginal(false);
                                                }}
                                            />
                                            <Label
                                                htmlFor="showDiffOnly"
                                                className="text-xs sm:text-sm font-medium leading-none cursor-pointer text-slate-700"
                                            >
                                                {t("ui.history.showDiffOnly")}
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 bg-slate-100 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                            <Checkbox
                                                id="showOriginalContent"
                                                checked={showOriginal}
                                                onCheckedChange={(checked) => {
                                                    const val = !!checked;
                                                    setShowOriginal(val);
                                                    if (val) setShowDiffOnly(false);
                                                }}
                                            />
                                            <Label
                                                htmlFor="showOriginalContent"
                                                className="text-xs sm:text-sm font-medium leading-none cursor-pointer text-slate-700"
                                            >
                                                {t("ui.history.showOriginalContent")}
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                                {detailLoading ? (
                                    <div className="py-8 text-center text-muted-foreground">{t("loadingHistory")}</div>
                                ) : showOriginal ? (
                                    <div className="relative group">
                                        {renderOriginalContent(selectedHistory.content)}
                                        <Button
                                            variant="secondary"
                                            size={copied ? "sm" : "icon"}
                                            className={`absolute top-2 right-2 h-8 ${copied ? "w-auto px-3" : "w-8"} transition-all shadow-sm bg-white/80 hover:bg-white backdrop-blur-sm border border-slate-200 z-10 flex items-center gap-1`}
                                            onClick={() => {
                                                if (selectedHistory.content) {
                                                    navigator.clipboard.writeText(selectedHistory.content);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }
                                            }}
                                            title={t("ui.note.copyNote")}
                                        >
                                            {copied ? (
                                                <div className="flex items-center gap-1 text-green-600 animate-in fade-in zoom-in duration-200">
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span className="text-xs font-medium">
                                                        {t("ui.common.copied")}
                                                    </span>
                                                </div>
                                            ) : (
                                                <Copy className="h-4 w-4 text-slate-500" />
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    renderDiffs(selectedHistory.diffs)
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>

            {/* 恢复确认对话框 */}
            <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("ui.history.restoreConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("ui.history.restoreConfirmDesc", { version: selectedHistory?.version })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={restoring}>{t("ui.common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} disabled={restoring}>
                            {restoring ? t("ui.common.restoring") : t("ui.common.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
