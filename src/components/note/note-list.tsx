import { FileText, Trash2, RefreshCw, Plus, Calendar, Clock, ChevronLeft, ChevronRight, History, Search, X, SortDesc, SortAsc, RotateCcw, Eye, Pencil, Folder as FolderIcon, ChevronDown, Regex, FolderSearch } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { Checkbox } from "@/components/ui/checkbox";
import React, { useState, useEffect } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { Folder } from "@/lib/types/folder";
import { Note } from "@/lib/types/note";
import { format } from "date-fns";


type SearchMode = "path" | "content" | "regex";
type SortBy = "mtime" | "ctime" | "path";
type SortOrder = "desc" | "asc";
type ViewMode = "flat" | "folder";

interface NoteListProps {
    vault: string;
    vaults?: VaultType[];
    onVaultChange?: (vault: string) => void;
    onSelectNote: (note: Note, previewMode?: boolean) => void;
    onCreateNote: () => void;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    onViewHistory: (note: Note) => void;
    isRecycle?: boolean;
    searchKeyword: string;
    setSearchKeyword: (keyword: string) => void;
    currentPath: string;
    setCurrentPath: (path: string) => void;
    currentPathHash: string;
    setCurrentPathHash: (hash: string) => void;
    pathHashMap: Record<string, string>;
    setPathHashMap: (map: Record<string, string>) => void;
}

export function NoteList({ vault, vaults, onVaultChange, onSelectNote, onCreateNote, page, setPage, pageSize, setPageSize, onViewHistory, isRecycle = false, searchKeyword, setSearchKeyword, currentPath, setCurrentPath, currentPathHash, setCurrentPathHash, pathHashMap, setPathHashMap }: NoteListProps) {
    const { t } = useTranslation();
    const { handleNoteList, handleDeleteNote, handleRestoreNote, handleFolderList, handleFolderNotes } = useNoteHandle();
    const { openConfirmDialog } = useConfirmDialog();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalRows, setTotalRows] = useState(0);
    const [debouncedKeyword, setDebouncedKeyword] = useState(searchKeyword);
    const [searchMode, setSearchMode] = useState<SearchMode>("path");
    const [regexError, setRegexError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortBy>("mtime");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<ViewMode>("folder");
    const [folders, setFolders] = useState<Folder[]>([]);
    const { trashType, setModule } = useAppStore();

    // Debounce search keyword
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedKeyword(searchKeyword);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    // 验证正则表达式
    useEffect(() => {
        if (searchMode === "regex" && searchKeyword) {
            try {
                new RegExp(searchKeyword);
                setRegexError(null);
            } catch {
                setRegexError(t("ui.note.invalidRegex"));
            }
        } else {
            setRegexError(null);
        }
    }, [searchKeyword, searchMode, t]);

    const fetchNotes = (currentPage: number = page, currentPageSize: number = pageSize, keyword: string = debouncedKeyword) => {
        // 如果是正则模式且有错误，不发起请求
        if (searchMode === "regex" && regexError) return;

        setLoading(true);

        if (viewMode === "folder" && !isRecycle) {
            // 目录模式工作流：1. 加载子目录 2. 加载当前目录下的笔记
            handleFolderList(vault, currentPath, currentPathHash, (folderData) => {
                setFolders(folderData || []);
                handleFolderNotes(vault, currentPath, currentPathHash, currentPage, currentPageSize, sortBy, sortOrder, (noteData) => {
                    setNotes(noteData?.list || []);
                    setTotalRows(noteData?.pager?.totalRows || 0);
                    setLoading(false);
                });
            });
        } else {
            // 平铺模式或回收站
            handleNoteList(vault, currentPage, currentPageSize, keyword, isRecycle, searchMode, false, sortBy, sortOrder, (data) => {
                let filteredList = data?.list || [];

                // 前端正则过滤（因为后端使用 LIKE 作为后备）
                if (searchMode === "regex" && keyword && filteredList.length > 0) {
                    try {
                        const regex = new RegExp(keyword, "i");
                        filteredList = filteredList.filter(note => regex.test(note.path));
                    } catch {
                        // 正则无效时不过滤
                    }
                }

                setNotes(filteredList);
                setTotalRows(data?.pager?.totalRows || 0);
                setLoading(false);
            });
        }
    };

    useEffect(() => {
        fetchNotes(page, pageSize, debouncedKeyword);
        setSelectedPaths(new Set()); // 清空选中
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vault, page, pageSize, debouncedKeyword, isRecycle, searchMode, sortBy, sortOrder, viewMode, currentPath]);

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

    const onDelete = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        const title = note.path.replace(/\.md$/, "");
        openConfirmDialog(t("ui.note.deleteNoteConfirm", { title }), "confirm", () => {
            handleDeleteNote(vault, note.path, note.pathHash, () => {
                fetchNotes();
            });
        });
    };

    const onRestore = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        const title = note.path.replace(/\.md$/, "");
        openConfirmDialog(t("ui.note.restoreNoteConfirm", { title }), "confirm", () => {
            handleRestoreNote(vault, note.path, note.pathHash, () => {
                fetchNotes();
            });
        });
    };

    const toggleSelectAll = () => {
        if (selectedPaths.size === notes.length && notes.length > 0) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(notes.map(n => n.pathHash)));
        }
    };

    const toggleSelect = (e: React.MouseEvent, pathHash: string) => {
        e.stopPropagation();
        const newSelected = new Set(selectedPaths);
        if (newSelected.has(pathHash)) {
            newSelected.delete(pathHash);
        } else {
            newSelected.add(pathHash);
        }
        setSelectedPaths(newSelected);
    };

    const onBatchRestore = () => {
        if (selectedPaths.size === 0) return;

        openConfirmDialog(t("ui.file.batchRestoreConfirm", { count: selectedPaths.size }), "confirm", async () => {
            setLoading(true);
            const selectedNotes = notes.filter(n => selectedPaths.has(n.pathHash));

            // 循环处理恢复
            for (const note of selectedNotes) {
                await new Promise<void>((resolve) => {
                    handleRestoreNote(vault, note.path, note.pathHash, () => {
                        resolve();
                    });
                });
            }

            setSelectedPaths(new Set());
            fetchNotes();
        });
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
                                <SelectValue placeholder="Select Vault" />
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
                        <div className="relative flex-1 sm:w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                placeholder={t("ui.note.searchPlaceholder")}
                                className={`pl-9 pr-14 rounded-xl ${regexError ? "border-destructive" : ""}`}
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                {searchKeyword && (
                                    <button
                                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => setSearchKeyword("")}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors">
                                            {searchMode === "path" && <FolderSearch className="h-3.5 w-3.5" />}
                                            {searchMode === "content" && <FileText className="h-3.5 w-3.5" />}
                                            {searchMode === "regex" && <Regex className="h-3.5 w-3.5" />}
                                            <ChevronDown className="h-3 w-3" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl min-w-32">
                                        <DropdownMenuItem
                                            onClick={() => setSearchMode("path")}
                                            className={`rounded-lg flex items-center justify-between ${searchMode === "path" ? "bg-accent" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FolderSearch className="h-4 w-4" />
                                                <span>{t("ui.note.searchPath")}</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setSearchMode("content")}
                                            className={`rounded-lg flex items-center justify-between ${searchMode === "content" ? "bg-accent" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                <span>{t("ui.note.searchContentMode")}</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setSearchMode("regex")}
                                            className={`rounded-lg flex items-center justify-between ${searchMode === "regex" ? "bg-accent" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Regex className="h-4 w-4" />
                                                <span>{t("ui.note.searchRegex")}</span>
                                            </div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchNotes()}
                            disabled={loading}
                            className="rounded-xl shrink-0"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {!isRecycle && (
                            <Button onClick={onCreateNote} className="rounded-xl shrink-0">
                                <Plus className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">{t("ui.note.newNote")}</span>
                            </Button>
                        )}
                    </div>
                    {regexError && (
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-xs text-destructive">{regexError}</span>
                        </div>
                    )}
                </div>
            </div>

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
                            {totalRows} {t("ui.note.note")}
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
                                className={`px-2.5 h-full text-xs flex items-center transition-colors border-l border-border hover:bg-muted`}
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
                            {totalRows} {t("ui.nav.menuTrash")}{t("ui.note.note")}
                        </span>
                    </div>


                    {/* 批量操作控制 */}
                    {notes.length > 0 && (
                        <div className="flex items-center gap-3 pl-4 border-l border-border/60">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="select-all"
                                    checked={selectedPaths.size === notes.length && notes.length > 0}
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
                                        className="h-8 rounded-lg text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300 shadow-sm"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        {t("ui.file.batchRestore")}
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
                                className={`px-2.5 h-full text-xs flex items-center transition-colors border-l border-border hover:bg-muted`}
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

            {/* 笔记及目录列表 */}
            {loading ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    {t("ui.common.loading")}
                </div>
            ) : (!Array.isArray(notes) || notes.length === 0) && (!Array.isArray(folders) || folders.length === 0 || viewMode === "flat") ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    {t("ui.note.noNotes")}
                </div>
            ) : (
                <div className="-mx-2 px-2">
                    <div className="grid grid-cols-1 gap-3 py-1">
                        {/* 目录列表 */}
                        {viewMode === "folder" && !isRecycle && folders.map((folder) => (
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

                        {/* 笔记列表 */}
                        {Array.isArray(notes) && notes.map((note) => (
                            <article
                                key={`note-${note.pathHash}`}
                                className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
                                onClick={() => onSelectNote(note, true)}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    {/* 左侧：图标和内容 */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        {isRecycle && (
                                            <div
                                                className="flex items-center self-center"
                                                onClick={(e) => toggleSelect(e, note.pathHash)}
                                            >
                                                <Checkbox
                                                    checked={selectedPaths.has(note.pathHash)}
                                                    className="rounded-md"
                                                />
                                            </div>
                                        )}
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                            <FileText className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-card-foreground truncate">
                                                {(viewMode === "folder" && !isRecycle ? note.path.split("/").pop() : note.path)?.replace(/\.md$/, "")}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                <Tooltip content={t("ui.common.createdAt")} side="top" delay={300}>
                                                    <span className="hidden sm:flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(note.ctime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                                <Tooltip content={t("ui.common.updatedAt")} side="top" delay={300}>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {format(new Date(note.mtime), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                </Tooltip>
                                                {note.version > 0 && (
                                                    <Tooltip content={t("ui.history.title")} side="top" delay={300}>
                                                        <span className="flex items-center gap-1">
                                                            <History className="h-3.5 w-3.5" />
                                                            v{note.version}
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 右侧：操作按钮 */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Tooltip content={t("ui.note.viewNote")} side="top" delay={200}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectNote(note, true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content={t("ui.note.editNote")} side="top" delay={200}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-blue-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectNote(note, false);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content={t("ui.history.title")} side="top" delay={200}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-purple-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewHistory(note);
                                                }}
                                            >
                                                <History className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        {!isRecycle && (
                                            <Tooltip content={t("ui.common.delete")} side="top" delay={200}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => onDelete(e, note)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                        {isRecycle && (
                                            <Tooltip content={t("ui.common.restore")} side="top" delay={200}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-green-600"
                                                    onClick={(e) => onRestore(e, note)}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            {/* 分页控制 */}
            {notes.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 pt-2 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{t("ui.common.of")} {totalRows} {t("ui.note.results")}</span>
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
        </div>
    );
}
