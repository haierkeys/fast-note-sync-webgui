import { FileText, Trash2, RefreshCw, Search, X, Calendar, Clock, SortDesc, SortAsc, Paperclip, Image, Music, Video, FileCode, RotateCcw, ChevronLeft, ChevronRight, Folder as FolderIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useFileHandle } from "@/components/api-handle/file-handle";
import React, { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { File as FileDTO } from "@/lib/types/file";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { Folder } from "@/lib/types/folder";
import { format } from "date-fns";

import { FilePreview } from "./file-preview";


type SortBy = "mtime" | "ctime" | "path";
type SortOrder = "desc" | "asc";
type ViewMode = "flat" | "folder";

interface FileListProps {
    vault: string;
    vaults?: VaultType[];
    onVaultChange?: (vault: string) => void;
    isRecycle?: boolean;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    searchKeyword: string;
    setSearchKeyword: (keyword: string) => void;
    currentPath: string;
    setCurrentPath: (path: string) => void;
    currentPathHash: string;
    setCurrentPathHash: (hash: string) => void;
    pathHashMap: Record<string, string>;
    setPathHashMap: (map: Record<string, string>) => void;
    onCanvasOpen?: (file: { path: string; pathHash: string }) => void;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function FileList({ vault, vaults, onVaultChange, isRecycle = false, page, setPage, pageSize, setPageSize, searchKeyword, setSearchKeyword, currentPath, setCurrentPath, currentPathHash, setCurrentPathHash, pathHashMap, setPathHashMap, onCanvasOpen }: FileListProps) {
    const { t } = useTranslation();
    const { handleFileList, handleDeleteFile, handleRestoreFile, getRawFileUrl, handleFolderFiles, handleFolderList, handlePermanentDeleteFile, handleClearFileRecycle } = useFileHandle();
    const { openConfirmDialog } = useConfirmDialog();
    const [files, setFiles] = useState<FileDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalRows, setTotalRows] = useState(0);
    const [debouncedKeyword, setDebouncedKeyword] = useState(searchKeyword);
    const [sortBy, setSortBy] = useState<SortBy>("mtime");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [batchRestoreProgress, setBatchRestoreProgress] = useState<{ current: number; total: number } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("folder");
    const [folders, setFolders] = useState<Folder[]>([]);
    const fileRequestIdRef = useRef(0);
    const { trashType, setModule } = useAppStore();

    // 预览相关状态
    const [previewFile, setPreviewFile] = useState<FileDTO | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");

    // Debounce search keyword
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedKeyword(searchKeyword);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    const fetchFiles = (currentPage: number = page, currentPageSize: number = pageSize, keyword: string = debouncedKeyword) => {
        const requestId = ++fileRequestIdRef.current;

        setLoading(true);

        if (viewMode === "folder" && !isRecycle) {
            handleFolderList(vault, currentPath, currentPathHash, (folderData) => {
                if (requestId !== fileRequestIdRef.current) return;

                setFolders(folderData || []);
                handleFolderFiles(vault, currentPath, currentPathHash, currentPage, currentPageSize, sortBy, sortOrder, (fileData) => {
                    if (requestId !== fileRequestIdRef.current) return;

                    setFiles(fileData?.list || []);
                    setTotalRows(fileData?.pager?.totalRows || 0);
                    setLoading(false);
                });
            });
        } else {
            handleFileList(vault, currentPage, currentPageSize, isRecycle, keyword, sortBy, sortOrder, (data) => {
                if (requestId !== fileRequestIdRef.current) return;

                setFiles(data?.list || []);
                setTotalRows(data?.pager?.totalRows || 0);
                setLoading(false);
            });
        }
    };

    useEffect(() => {
        fetchFiles(page, pageSize, debouncedKeyword);
        setSelectedPaths(new Set());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vault, page, pageSize, debouncedKeyword, isRecycle, sortBy, sortOrder, viewMode, currentPath]);

    // 当搜索内容、目录路径或浏览模式变化时，重置页码到第1页
    useEffect(() => {
        if (debouncedKeyword) {
            setViewMode("flat");
        }
    }, [debouncedKeyword, currentPath, viewMode, setPage]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= Math.ceil(totalRows / pageSize)) {
            setPage(newPage);
        }
    };

    const onDelete = (e: React.MouseEvent, file: FileDTO) => {
        e.stopPropagation();
        openConfirmDialog(t("ui.file.deleteFileConfirm", { title: file.path }), "confirm", () => {
            handleDeleteFile(vault, file.path, file.pathHash, () => {
                fetchFiles();
            });
        });
    };

    const onRestore = (e: React.MouseEvent, file: FileDTO) => {
        e.stopPropagation();
        if (!file.contentHash) return;
        openConfirmDialog(t("ui.file.restoreFileConfirm", { title: file.path }), "confirm", () => {
            handleRestoreFile(vault, file.path, file.pathHash, () => {
                fetchFiles();
            });
        });
    };

    const onPermanentDelete = (e: React.MouseEvent, file: FileDTO) => {
        e.stopPropagation();
        openConfirmDialog(t("ui.file.permanentDeleteConfirm", { title: file.path }), "confirm", () => {
            handlePermanentDeleteFile(vault, file.path, file.pathHash, () => {
                fetchFiles();
            });
        });
    };

    const toggleSelectAll = () => {
        const restorableFiles = files.filter(f => f.contentHash);
        if (selectedPaths.size === restorableFiles.length && restorableFiles.length > 0) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(restorableFiles.map(f => f.pathHash)));
        }
    };

    const toggleSelect = (file: FileDTO) => {
        if (!file.contentHash) return;

        const newSelected = new Set(selectedPaths);

        if (newSelected.has(file.pathHash)) {
            newSelected.delete(file.pathHash);
        } else {
            newSelected.add(file.pathHash);
        }

        setSelectedPaths(newSelected);
    };

    const toggleSelectWithEvent = (event: React.MouseEvent, file: FileDTO) => {
        event.stopPropagation();
        toggleSelect(file);
    };

    const onBatchRestore = () => {
        if (selectedPaths.size === 0) return;

        const selectedFiles = files.filter(f => selectedPaths.has(f.pathHash) && f.contentHash);
        if (selectedFiles.length === 0) return;

        openConfirmDialog(t("ui.file.batchRestoreConfirm", { count: selectedFiles.length }), "confirm", async () => {
            setLoading(true);
            const total = selectedFiles.length;

            try {
                for (let i = 0; i < selectedFiles.length; i++) {
                    setBatchRestoreProgress({ current: i + 1, total });
                    await Promise.race([
                        new Promise<void>((resolve) => {
                            handleRestoreFile(vault, selectedFiles[i].path, selectedFiles[i].pathHash, resolve);
                        }),
                        new Promise<void>((resolve) => setTimeout(resolve, 30000)),
                    ]);
                }
            } finally {
                setBatchRestoreProgress(null);
                setSelectedPaths(new Set());
                fetchFiles();
            }
        });
    };

    const onBatchPermanentDelete = () => {
        if (selectedPaths.size === 0) return;

        const selectedFiles = files.filter(f => selectedPaths.has(f.pathHash));
        if (selectedFiles.length === 0) return;

        openConfirmDialog(t("ui.common.batchPermanentDeleteConfirm", { count: selectedFiles.length }), "confirm", async () => {
            setLoading(true);
            const total = selectedFiles.length;

            try {
                for (let i = 0; i < selectedFiles.length; i++) {
                    setBatchRestoreProgress({ current: i + 1, total });
                    await Promise.race([
                        new Promise<void>((resolve) => {
                            handlePermanentDeleteFile(vault, selectedFiles[i].path, selectedFiles[i].pathHash, resolve);
                        }),
                        new Promise<void>((resolve) => setTimeout(resolve, 30000)),
                    ]);
                }
            } finally {
                setBatchRestoreProgress(null);
                setSelectedPaths(new Set());
                fetchFiles();
            }
        });
    };

    const onClearRecycleBin = () => {
        openConfirmDialog(t("ui.file.clearRecycleConfirm"), "confirm", () => {
            handleClearFileRecycle(vault, () => {
                fetchFiles();
            });
        });
    };

    /**
     * 处理文件点击 (预览或下载)
     */
    const handleItemClick = (file: FileDTO) => {
        // .canvas 文件直接在 FileManager 中打开 CanvasViewer
        if (file.path.endsWith(".canvas") && onCanvasOpen) {
            onCanvasOpen({ path: file.path, pathHash: file.pathHash });
            return;
        }

        let url = getRawFileUrl(vault, file.path, file.pathHash?.toString());
        if (isRecycle) {
            url += (url.includes("?") ? "&" : "?") + "isRecycle=1";
        }
        setPreviewFile(file);
        setPreviewUrl(url);
    };

    /**
     * 根据文件后缀获取对应的图标
     */
    const getFileIcon = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase() || '';

        // 图片类型
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
            return <Image className="h-5 w-5" />;
        }
        // PDF 类型
        if (ext === 'pdf') {
            return <FileText className="h-5 w-5" />;
        }
        // 音频类型
        if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
            return <Music className="h-5 w-5" />;
        }
        // 视频类型
        if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) {
            return <Video className="h-5 w-5" />;
        }
        // 脚本/代码类型
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'sh', 'bat', 'go', 'css', 'html', 'json', 'c', 'cpp', 'rs', 'php'].includes(ext)) {
            return <FileCode className="h-5 w-5" />;
        }

        // 默认类型
        return <Paperclip className="h-5 w-5" />;
    };

    const totalPages = Math.ceil(totalRows / pageSize);

    return (
        <div className="w-full flex flex-col space-y-4">
            {/* 工具栏 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
                {/* 左侧：仓库选择 */}
                <div className="flex items-center gap-3">
                    {vaults && onVaultChange && (
                        <Select value={vault} onValueChange={onVaultChange}>
                            <SelectTrigger className="w-auto min-w-45 rounded-xl">
                                <SelectValue placeholder={t("ui.common.selectVault")} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {vaults.map((v) => (
                                    <SelectItem key={v.id} value={v.vault} className="rounded-xl">
                                        {v.vault}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* 右侧：搜索和操作 */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                placeholder={t("ui.file.searchPlaceholder")}
                                className="pl-9 pr-8 rounded-xl"
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                            />
                            {searchKeyword && (
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setSearchKeyword("")}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={t("ui.common.refresh")}
                            onClick={() => fetchFiles()}
                            disabled={loading}
                            className="rounded-xl shrink-0"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* 面包屑导航 - 仅在目录模式下显示 */}
            {viewMode === "folder" && !isRecycle && currentPath && (
                <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <button
                        className="hover:text-primary transition-colors flex items-center"
                        onClick={() => {
                            setCurrentPath("");
                            setCurrentPathHash("");
                            setPage(1);
                        }}
                    >
                        {vault}
                    </button>
                    {currentPath.split("/").filter(Boolean).map((part, index, arr) => (
                        <React.Fragment key={`breadcrumb-${index}`}>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                            <button
                                className={`transition-colors ${index === arr.length - 1 ? "text-foreground font-medium pointer-events-none" : "hover:text-primary"}`}
                                onClick={() => {
                                    const path = arr.slice(0, index + 1).join("/");
                                    setCurrentPath(path);
                                    setCurrentPathHash(pathHashMap[path] || "");
                                    setPage(1);
                                }}
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* 第二行工具栏：平铺/目录切换 (非回收站模式) */}
            {!isRecycle && (
                <div className="flex flex-wrap items-center gap-4 py-2 px-2 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center h-8 rounded-lg border border-border overflow-hidden bg-background shadow-sm">
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors ${viewMode === 'folder' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                    setSearchKeyword("");
                                    setDebouncedKeyword("");
                                    setViewMode("folder");
                                }}
                            >
                                {t("ui.note.viewFolder")}
                            </button>
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors border-l border-border ${viewMode === 'flat' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => setViewMode("flat")}
                            >
                                {t("ui.note.viewFlat")}
                            </button>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                            {totalRows} {t("ui.file.file")}
                        </span>
                    </div>

                    {/* 排序选择 */}
                    <div className="flex items-center h-8 rounded-xl border border-border overflow-hidden bg-background shadow-sm ml-auto">
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors ${sortBy === "mtime" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("mtime")}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            {t("ui.note.sortByMtime")}
                        </button>
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors border-l border-border ${sortBy === "ctime" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("ctime")}
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            {t("ui.note.sortByCtime")}
                        </button>
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors border-l border-border ${sortBy === "path" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("path")}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            {t("ui.note.sortByPath")}
                        </button>
                        <Tooltip content={sortOrder === "desc" ? t("ui.note.sortDesc") : t("ui.note.sortAsc")} side="top" delay={200}>
                            <button
                                className="px-2.5 h-full text-xs flex items-center transition-colors border-l border-border hover:bg-muted"
                                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                            >
                                {sortOrder === "desc" ? (
                                    <SortDesc className="h-3.5 w-3.5" />
                                ) : (
                                    <SortAsc className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                </div>
            )}

            {/* 第二行工具栏：仅在回收站模式下显示 */}
            {isRecycle && (
                <div className="flex flex-wrap items-center gap-4 py-2 px-2 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex items-center gap-3">
                        {/* 页面切换开关 */}
                        <div className="flex items-center h-8 rounded-lg border border-border overflow-hidden bg-background shadow-sm">
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors ${trashType === 'notes' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => setModule("trash", "notes")}
                            >
                                {t("ui.note.note")}
                            </button>
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors border-l border-border ${trashType === 'files' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => setModule("trash", "files")}
                            >
                                {t("ui.file.file")}
                            </button>
                        </div>

                        {/* 数量统计 */}
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                            {totalRows} {t("ui.nav.menuTrash")}{t("ui.file.file")}
                        </span>
                        {files.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClearRecycleBin}
                                className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                {t("ui.common.clear")}
                            </Button>
                        )}
                    </div>


                    {/* 批量操作控制 */}
                    {files.length > 0 && (
                        <div className="flex items-center gap-3 pl-4 border-l border-border/60">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="select-all"
                                    checked={files.filter(f => f.contentHash).length > 0 && selectedPaths.size === files.filter(f => f.contentHash).length}
                                    onCheckedChange={toggleSelectAll}
                                    className="rounded-md"
                                />
                                <label htmlFor="select-all" className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                    {t("ui.common.selectAll")}
                                </label>
                            </div>

                            {selectedPaths.size > 0 && (
                                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                                    <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                                        {t("ui.file.selectedCount", { count: selectedPaths.size })}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onBatchRestore}
                                        disabled={!files.some(f => selectedPaths.has(f.pathHash) && f.contentHash)}
                                        className="h-8 rounded-lg text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300 shadow-sm"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        {t("ui.file.batchRestore")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onBatchPermanentDelete}
                                        className="h-8 rounded-lg text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/40 shadow-sm"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        {t("ui.common.batchPermanentDelete")}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 排序选择 */}
                    <div className="flex items-center h-8 rounded-xl border border-border overflow-hidden bg-background shadow-sm ml-auto">
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors ${sortBy === "mtime" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("mtime")}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            {t("ui.note.sortByMtime")}
                        </button>
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors border-l border-border ${sortBy === "ctime" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("ctime")}
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            {t("ui.note.sortByCtime")}
                        </button>
                        <button
                            className={`px-3 h-full text-xs flex items-center gap-1.5 transition-colors border-l border-border ${sortBy === "path" ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                            onClick={() => setSortBy("path")}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            {t("ui.note.sortByPath")}
                        </button>
                        <Tooltip content={sortOrder === "desc" ? t("ui.note.sortDesc") : t("ui.note.sortAsc")} side="top" delay={200}>
                            <button
                                className="px-2.5 h-full text-xs flex items-center transition-colors border-l border-border hover:bg-muted"
                                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                            >
                                {sortOrder === "desc" ? (
                                    <SortDesc className="h-3.5 w-3.5" />
                                ) : (
                                    <SortAsc className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                </div>
            )}

            {/* 附件列表 */}
            {loading ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    {batchRestoreProgress
                        ? `${batchRestoreProgress.current} / ${batchRestoreProgress.total}`
                        : t("ui.common.loading")}
                </div>
            ) : (!Array.isArray(files) || files.length === 0) && (!Array.isArray(folders) || folders.length === 0 || viewMode === "flat") ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    {t("ui.file.noFiles")}
                </div>
            ) : (
                <div className="-mx-2 px-2">
                    <div className="grid grid-cols-1 gap-3 py-1">
                        {/* 目录列表 */}
                        {viewMode === "folder" && !isRecycle && Array.isArray(folders) && folders.map((folder) => (
                            <article
                                key={`folder-${folder.pathHash}`}
                                className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
                                onClick={() => {
                                    setPathHashMap({ ...pathHashMap, [folder.path]: folder.pathHash });
                                    setCurrentPath(folder.path);
                                    setCurrentPathHash(folder.pathHash);
                                    setPage(1);
                                }}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                                            <FolderIcon className="h-5 w-5 fill-current opacity-70" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-card-foreground truncate">
                                                {folder.path.split("/").pop()}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                <Tooltip content={t("ui.common.createdAt")} side="top" delay={300}>
                                                    <span className="hidden sm:flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(folder.ctime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                                <Tooltip content={t("ui.common.updatedAt")} side="top" delay={300}>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {format(new Date(folder.mtime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                </div>
                            </article>
                        ))}

                        {/* 附件列表 */}
                        {Array.isArray(files) && files.map((file) => (
                            <article
                                key={`file-${file.pathHash}`}
                                className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer"
                                onClick={() => handleItemClick(file)}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    {/* 左侧：图标和内容 */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        {isRecycle && (
                                            <div
                                                className={`flex items-center self-center ${!file.contentHash ? "opacity-30" : ""}`}
                                                onClick={(event) => toggleSelectWithEvent(event, file)}
                                            >
                                                <Checkbox
                                                    checked={selectedPaths.has(file.pathHash)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onCheckedChange={() => {
                                                        if (!loading && file.contentHash) {
                                                            toggleSelect(file);
                                                        }
                                                    }}
                                                    disabled={!file.contentHash}
                                                    className="rounded-md"
                                                />
                                            </div>
                                        )}
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                            {getFileIcon(file.path)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-card-foreground truncate">
                                                {(viewMode === "folder" && !isRecycle ? file.path.split("/").pop() : file.path)}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    {formatFileSize(file.size)}
                                                </span>
                                                <Tooltip content={t("ui.common.createdAt")} side="top" delay={300}>
                                                    <span className="hidden sm:flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(file.ctime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                                <Tooltip content={t("ui.common.updatedAt")} side="top" delay={300}>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {format(new Date(file.mtime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 右侧：操作按钮 */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!isRecycle && (
                                            <Tooltip content={t("ui.common.delete")} side="top" delay={200}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => onDelete(e, file)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                        {isRecycle && (
                                            <>
                                                <Tooltip content={t("ui.common.restore")} side="top" delay={200}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={!file.contentHash}
                                                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-green-600"
                                                        onClick={(e) => onRestore(e, file)}
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip content={t("ui.common.permanentDelete")} side="top" delay={200}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => onPermanentDelete(e, file)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </Tooltip>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            {/* 分页控制 */}
            {files.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 pt-2 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{t("ui.common.of")} {totalRows} {t("ui.file.results")}</span>
                        <Select value={pageSize.toString()} onValueChange={(val) => {
                            const newSize = parseInt(val);
                            setPageSize(newSize);
                            setPage(1);
                        }}>
                            <SelectTrigger className="h-8 w-25 rounded-xl">
                                <SelectValue placeholder={pageSize.toString()} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {[10, 20, 50, 100].map((size) => (
                                    <SelectItem key={size} value={size.toString()} className="rounded-xl">
                                        {size} {t("ui.common.perPage")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1 || loading}
                            className="rounded-xl"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {t("ui.common.previous")}
                        </Button>
                        <span className="text-sm font-medium px-2">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === totalPages || loading}
                            className="rounded-xl"
                        >
                            {t("ui.common.next")}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* 预览组件 */}
            {previewFile && (
                <FilePreview
                    key={previewUrl}
                    file={previewFile}
                    url={previewUrl}
                    onClose={() => {
                        setPreviewFile(null);
                        setPreviewUrl("");
                    }}
                />
            )}
        </div>
    );
}
