import { useVaultHandle } from "@/components/api-handle/vault-handle";

// 获取主滚动容器 / Get the main scroll container
const getMainEl = () => document.querySelector('main') as HTMLElement | null;
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { hashCode } from "@/lib/utils/hash";
import type { ShareFilterType, ViewModeType } from "@/components/note/note-list";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Note } from "@/lib/types/note";
import type { Folder as FolderDTO } from "@/lib/types/folder";
import { Database, FileText, FolderTree } from "lucide-react";

import { useNoteHandle } from "@/components/api-handle/note-handle";
import { toast } from "@/components/common/Toast";
import { NoteHistoryModal } from "./note-history-modal";
import { NoteEditor } from "./note-editor";
import { CanvasViewer } from "./canvas-viewer";
import { NoteList } from "./note-list";
import { NoteTreeSidebar } from "./note-tree-sidebar";
import { useAppStore } from "@/stores/app-store";
import { TocProvider } from "@/components/context/toc-context";
import { useMobile } from "@/hooks/use-mobile";


// 工具函数：将笔记内的相对路径解析为 vault 绝对路径（纯函数，无 hook 依赖）
function resolveNotePath(target: string, currentNotePath?: string): string {
    let normalized = target.replace(/#.*$/, '').replace(/\.md$/i, '').trim();
    if (!normalized) return '';

    if (normalized.startsWith('./')) {
        normalized = normalized.slice(2);
    }
    if (normalized.startsWith('../') && currentNotePath) {
        const dir = currentNotePath.includes('/')
            ? currentNotePath.substring(0, currentNotePath.lastIndexOf('/'))
            : '';
        const parts = dir ? dir.split('/') : [];
        while (normalized.startsWith('../')) {
            if (parts.length > 0) parts.pop();
            normalized = normalized.slice(3);
        }
        normalized = [...parts, normalized].filter(Boolean).join('/');
    }

    return normalized;
}

interface NoteManagerProps {
    vault: string;
    onVaultChange?: (vault: string) => void;
    onNavigateToVaults?: () => void;
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    isRecycle?: boolean;
}

export function NoteManager({
    vault,
    onVaultChange,
    onNavigateToVaults,
    isMaximized = false,
    onToggleMaximize,
    isRecycle = false
}: NoteManagerProps) {
    const { t } = useTranslation();
    const isMobile = useMobile();
    const [view, setView] = useState<"list" | "editor">("list");
    const [selectedNote, setSelectedNote] = useState<Note | undefined>(undefined);
    const [initialPreviewMode, setInitialPreviewMode] = useState(false);
    const [vaults, setVaults] = useState<VaultType[]>([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedNoteForHistory, setSelectedNoteForHistory] = useState<Note | null>(null);
    const vaultsLoaded = useRef(false);
    const scrollPositionRef = useRef<number>(0);

    // Lifted state for pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        const saved = localStorage.getItem(isRecycle ? "trashPageSize" : "notePageSize");
        return saved ? parseInt(saved, 10) : 10;
    });
    const [searchKeyword, setSearchKeyword] = useState("");

    // Global state for folder navigation (survives editor unmount and syncs with URL)
    const currentPath = useAppStore(state => state.currentPath);
    const currentPathHash = useAppStore(state => state.currentPathHash);
    const setCurrentPath = useAppStore(state => state.setCurrentPath);
    const setCurrentPathHash = useAppStore(state => state.setCurrentPathHash);
    const [pathHashMap, setPathHashMap] = useState<Record<string, string>>({});

    // Lifted share filter state (survives editor unmount)
    const [shareFilter, setShareFilter] = useState<ShareFilterType>(null);

    // Lifted view mode state (survives editor unmount)
    const [viewMode, setViewMode] = useState<ViewModeType>(() => {
        if (isRecycle) return "flat";
        const saved = localStorage.getItem("noteViewMode");
        return (saved as ViewModeType) || "folder";
    });

    const isWorkspaceMode = viewMode === "workspace" && !isRecycle && !isMobile;

    useEffect(() => {
        if (!isRecycle) {
            localStorage.setItem("noteViewMode", viewMode);
        }
    }, [viewMode, isRecycle]);

    useEffect(() => {
        if ((isMobile || isRecycle) && viewMode === "workspace") {
            setViewMode("folder");
        }
    }, [isMobile, isRecycle, viewMode]);

    useEffect(() => {
        localStorage.setItem(isRecycle ? "trashPageSize" : "notePageSize", pageSize.toString());
    }, [pageSize, isRecycle]);

    const { handleVaultList } = useVaultHandle();

    useEffect(() => {
        let isMounted = true;

        const loadVaults = async () => {
            try {
                await handleVaultList((data) => {
                    if (!isMounted) return;
                    setVaults(data);
                });
            } catch (error: unknown) {
                if (!isMounted) return;
                toast.error(error instanceof Error ? error.message : String(error));
                setVaults([]);
            } finally {
                if (isMounted) {
                    vaultsLoaded.current = true;
                }
            }
        };

        void loadVaults();

        return () => {
            isMounted = false;
        };
    }, [handleVaultList]);

    // Reset page and folder navigation state when vault changes
    useEffect(() => {
        setPage(1);
        setCurrentPath("");
        setCurrentPathHash("");
        setPathHashMap({});
        setShareFilter(null);
        setSelectedNote(undefined);
        setInitialPreviewMode(false);
        setView("list");
    }, [vault, setCurrentPath, setCurrentPathHash]);

    // NoteList 始终挂载，在浏览器绘制前同步恢复滚动位置
    // NoteList is always mounted; restore scroll synchronously before browser paint
    useLayoutEffect(() => {
        if (view === "list" && scrollPositionRef.current > 0) {
            getMainEl()?.scrollTo({ top: scrollPositionRef.current });
        }
    }, [view]);

    const { handleNoteList } = useNoteHandle();

    const handleSelectNote = useCallback((note: Note, previewMode: boolean = false) => {
        // 进入编辑器前保存列表滚动位置 / Save list scroll position before entering editor
        scrollPositionRef.current = getMainEl()?.scrollTop ?? 0;
        setSelectedNote(note);
        setInitialPreviewMode(previewMode);
        setView("editor");
    }, []);

    const handleSelectWorkspaceNote = useCallback((note: Note, previewMode: boolean = true) => {
        const folder = note.path.includes("/") ? note.path.substring(0, note.path.lastIndexOf("/")) : "";
        setCurrentPath(folder);
        setCurrentPathHash(pathHashMap[folder] || (folder ? hashCode(folder) : ""));
        setSelectedNote(note);
        setInitialPreviewMode(previewMode);
        setView("list");
    }, [pathHashMap, setCurrentPath, setCurrentPathHash]);

    const handleWorkspaceFoldersLoaded = useCallback((folders: FolderDTO[]) => {
        setPathHashMap(prev => {
            let changed = false;
            const next = { ...prev };

            for (const folder of folders) {
                if (next[folder.path] !== folder.pathHash) {
                    next[folder.path] = folder.pathHash;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, []);

    const handleWikiLinkClick = useCallback((target: string, currentNotePath?: string) => {
        // 1. 解析路径（去锚点、去 .md、解析相对路径）
        const resolvedTarget = resolveNotePath(target, currentNotePath);
        if (!resolvedTarget) return;

        // 2. API 搜索
        handleNoteList(vault, 1, 50, resolvedTarget, false, "path", false, "mtime", "desc", (data) => {
            if (!data?.list?.length) {
                toast.info(t("ui.note.wikiLinkNotFound", { target: resolvedTarget }));
                return;
            }

            // 3. 精确匹配
            const match = data.list.find(n => {
                const notePath = n.path.replace(/\.md$/i, '');
                return notePath === resolvedTarget
                    || notePath.endsWith('/' + resolvedTarget);
            });

            if (match) {
                const folder = match.path.includes('/') ? match.path.substring(0, match.path.lastIndexOf('/')) : '';
                setCurrentPath(folder);
                setCurrentPathHash(pathHashMap[folder] || (folder ? hashCode(folder) : ""));
                if (isWorkspaceMode) {
                    handleSelectWorkspaceNote(match, true);
                } else {
                    handleSelectNote(match, true);
                }
            } else {
                toast.info(t("ui.note.wikiLinkNotFound", { target: resolvedTarget }));
            }
        });
    }, [vault, handleNoteList, handleSelectNote, handleSelectWorkspaceNote, isWorkspaceMode, t, pathHashMap, setCurrentPath, setCurrentPathHash]);

    // 从 URL 参数中读取 notePath（新标签页打开 MD 链接时）
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const notePathParam = params.get('notePath');
        const fromNotePath = params.get('fromNotePath') || '';

        if (notePathParam && vault) {
            params.delete('notePath');
            params.delete('fromNotePath');
            const search = params.toString().replace(/=(?=&|$)/g, '');
            window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));

            const resolvedTarget = resolveNotePath(notePathParam, fromNotePath);
            if (!resolvedTarget) return;

            handleNoteList(vault, 1, 50, resolvedTarget, false, "path", false, "mtime", "desc", (data) => {
                if (!data?.list?.length) return;
                const match = data.list.find(n => {
                    const notePath = n.path.replace(/\.md$/i, '');
                    return notePath === resolvedTarget || notePath.endsWith('/' + resolvedTarget);
                });
                if (match) {
                    const folder = match.path.includes('/') ? match.path.substring(0, match.path.lastIndexOf('/')) : '';
                    setCurrentPath(folder);
                    setCurrentPathHash(pathHashMap[folder] || (folder ? hashCode(folder) : ""));
                    if (isWorkspaceMode) {
                        handleSelectWorkspaceNote(match, true);
                    } else {
                        handleSelectNote(match, true);
                    }
                }
            });
        }
    }, [vault, handleNoteList, handleSelectNote, handleSelectWorkspaceNote, isWorkspaceMode, setCurrentPath, setCurrentPathHash, pathHashMap]);

    const handleCreateNote = () => {
        setSelectedNote(undefined);
        setInitialPreviewMode(false);
        setView("editor");
    };

    const handleBack = () => {
        setView("list");
        setSelectedNote(undefined);
        setPage(1);
    };

    const handleWorkspaceBack = () => {
        setSelectedNote(undefined);
        setInitialPreviewMode(true);
    };

    const handleNavigateToFolder = (folderPath: string) => {
        setCurrentPath(folderPath);
        setCurrentPathHash(pathHashMap[folderPath] || "");
        setPage(1);
        if (!isWorkspaceMode) {
            setView("list");
            setSelectedNote(undefined);
        }
    };

    const handleSaveSuccess = (newPath: string, newPathHash: string) => {
        // 只有新建笔记时才更新 selectedNote
        // 已有笔记保存时不更新，避免触发重新加载
        if (!selectedNote) {
            // 新建笔记保存成功后，创建一个临时的 note 对象
            setSelectedNote({
                id: Date.now(), // 临时 id
                path: newPath,
                pathHash: newPathHash,
                mtime: Date.now(),
                ctime: Date.now(),
                version: 0,
            } as Note);
        }
        // 已有笔记保存时，不更新 selectedNote，保持编辑器状态
    };

    const handleViewHistory = (note: Note) => {
        setSelectedNoteForHistory(note);
        setHistoryModalOpen(true);
    };

    // 历史版本恢复成功后的回调
    const handleHistoryRestoreSuccess = () => {
        // 如果当前正在编辑被恢复的笔记，需要刷新编辑器
        if (selectedNote && selectedNoteForHistory && selectedNote.pathHash === selectedNoteForHistory.pathHash) {
            // 通过重新设置 selectedNote 触发编辑器重新加载
            setSelectedNote({ ...selectedNote, version: (selectedNote.version || 0) + 1 });
        }
    };

    // 检查是否有仓库（只在加载完成后显示空状态）
    if (vaultsLoaded.current && vaults.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center justify-center">
                <Database className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t("ui.note.noVaults")}
                </h3>
                <p className="text-muted-foreground mb-6 text-center">
                    {t("ui.note.createVaultFirst")}
                </p>
                <Button
                    onClick={() => {
                        if (onNavigateToVaults) {
                            onNavigateToVaults();
                        }
                    }}
                    className="rounded-xl"
                >
                    {t("ui.note.goToVaultManagement")}
                </Button>
            </div>
        );
    }

    return (
        <>
            {/* NoteList 始终挂载，editor 视图时用 hidden 隐藏 */}
            {/* NoteList is always mounted; hidden attribute hides it in editor view */}
            <div hidden={view === "editor" || isWorkspaceMode}>
                <NoteList
                    vault={vault}
                    vaults={vaults}
                    onVaultChange={onVaultChange}
                    onSelectNote={handleSelectNote}
                    onCreateNote={handleCreateNote}
                    page={page}
                    setPage={setPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    searchKeyword={searchKeyword}
                    setSearchKeyword={setSearchKeyword}
                    onViewHistory={handleViewHistory}
                    isRecycle={isRecycle}
                    currentPath={currentPath}
                    setCurrentPath={setCurrentPath}
                    currentPathHash={currentPathHash}
                    setCurrentPathHash={setCurrentPathHash}
                    pathHashMap={pathHashMap}
                    setPathHashMap={setPathHashMap}
                    shareFilter={shareFilter}
                    setShareFilter={setShareFilter}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
            </div>

            {isWorkspaceMode && (
                <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-3">
                            {vaults && onVaultChange && (
                                <Select value={vault} onValueChange={onVaultChange}>
                                    <SelectTrigger className="h-8 w-auto min-w-45 rounded-xl bg-background">
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
                            <div className="flex h-8 items-center overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                                <button
                                    className="h-full px-4 text-xs font-medium transition-colors hover:bg-muted"
                                    onClick={() => setViewMode("folder")}
                                >
                                    {t("ui.note.viewFolder")}
                                </button>
                                <button
                                    className="h-full border-l border-border px-4 text-xs font-medium transition-colors hover:bg-muted"
                                    onClick={() => setViewMode("flat")}
                                >
                                    {t("ui.note.viewFlatNotes")}
                                </button>
                                <button
                                    className="h-full border-l border-border px-4 text-xs font-medium transition-colors hover:bg-muted"
                                    onClick={() => setViewMode("flat-file")}
                                >
                                    {t("ui.note.viewFlatFiles")}
                                </button>
                                <button
                                    className="inline-flex h-full items-center gap-1.5 border-l border-border bg-primary px-4 text-xs font-medium text-primary-foreground"
                                    onClick={() => setViewMode("workspace")}
                                >
                                    <FolderTree className="h-3.5 w-3.5" />
                                    {t("ui.note.viewWorkspace")}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 gap-4">
                        <NoteTreeSidebar
                            key={vault}
                            vault={vault}
                            selectedPathHash={selectedNote?.pathHash}
                            onSelectNote={handleSelectWorkspaceNote}
                            onFoldersLoaded={handleWorkspaceFoldersLoaded}
                        />
                        <div className="min-w-0 flex-1">
                            {selectedNote ? (
                                selectedNote.path?.endsWith(".canvas") ? (
                                    <CanvasViewer
                                        vault={vault}
                                        note={selectedNote}
                                        onBack={handleWorkspaceBack}
                                        onWikiLinkClick={handleWikiLinkClick}
                                    />
                                ) : (
                                    <TocProvider>
                                        <NoteEditor
                                            vault={vault}
                                            note={selectedNote}
                                            onBack={handleWorkspaceBack}
                                            onNavigateToFolder={handleNavigateToFolder}
                                            onSaveSuccess={handleSaveSuccess}
                                            onViewHistory={() => selectedNote && handleViewHistory(selectedNote)}
                                            isMaximized={isMaximized}
                                            onToggleMaximize={onToggleMaximize}
                                            isRecycle={isRecycle}
                                            initialPreviewMode={initialPreviewMode}
                                            onWikiLinkClick={handleWikiLinkClick}
                                            defaultFolderPath={currentPath}
                                        />
                                    </TocProvider>
                                )
                            ) : (
                                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                                    <FileText className="mb-3 h-12 w-12 text-muted-foreground/40" />
                                    <div className="text-sm font-medium text-foreground">{t("ui.note.selectNoteFromTree")}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* editor 视图时渲染 NoteEditor 或 CanvasViewer */}
            {/* Render NoteEditor or CanvasViewer only in editor view */}
            {view === "editor" && (
                selectedNote?.path?.endsWith(".canvas") ? (
                    <CanvasViewer
                        vault={vault}
                        note={selectedNote}
                        onBack={handleBack}
                        onWikiLinkClick={handleWikiLinkClick}
                    />
                ) : (
                    <TocProvider>
                        <NoteEditor
                            vault={vault}
                            note={selectedNote}
                            onBack={handleBack}
                            onNavigateToFolder={handleNavigateToFolder}
                            onSaveSuccess={handleSaveSuccess}
                            onViewHistory={() => selectedNote && handleViewHistory(selectedNote)}
                            isMaximized={isMaximized}
                            onToggleMaximize={onToggleMaximize}
                            isRecycle={isRecycle}
                            initialPreviewMode={initialPreviewMode}
                            onWikiLinkClick={handleWikiLinkClick}
                            defaultFolderPath={currentPath}
                        />
                    </TocProvider>
                )
            )}

            {selectedNoteForHistory && (
                <NoteHistoryModal
                    isOpen={historyModalOpen}
                    onClose={() => {
                        setHistoryModalOpen(false);
                        setSelectedNoteForHistory(null);
                    }}
                    vault={vault}
                    notePath={selectedNoteForHistory.path}
                    pathHash={selectedNoteForHistory.pathHash}
                    isRecycle={isRecycle}
                    onRestoreSuccess={handleHistoryRestoreSuccess}
                />
            )}
        </>
    );
}
