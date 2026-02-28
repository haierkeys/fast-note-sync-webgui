import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Note } from "@/lib/types/note";
import { Database } from "lucide-react";

import { useNoteHandle } from "@/components/api-handle/note-handle";
import { toast } from "@/components/common/Toast";
import { NoteHistoryModal } from "./note-history-modal";
import { NoteEditor } from "./note-editor";
import { NoteList } from "./note-list";


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
    const [view, setView] = useState<"list" | "editor">("list");
    const [selectedNote, setSelectedNote] = useState<Note | undefined>(undefined);
    const [initialPreviewMode, setInitialPreviewMode] = useState(false);
    const [vaults, setVaults] = useState<VaultType[]>([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedNoteForHistory, setSelectedNoteForHistory] = useState<Note | null>(null);
    const vaultsLoaded = useRef(false);

    // Lifted state for pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        const saved = localStorage.getItem("notePageSize");
        return saved ? parseInt(saved, 10) : 10;
    });
    const [searchKeyword, setSearchKeyword] = useState("");

    // Lifted state for folder navigation (survives editor unmount)
    const [currentPath, setCurrentPath] = useState("");
    const [currentPathHash, setCurrentPathHash] = useState("");
    const [pathHashMap, setPathHashMap] = useState<Record<string, string>>({});

    useEffect(() => {
        localStorage.setItem("notePageSize", pageSize.toString());
    }, [pageSize]);

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
    }, [vault]);

    const { handleNoteList } = useNoteHandle();

    const handleSelectNote = useCallback((note: Note, previewMode: boolean = false) => {
        setSelectedNote(note);
        setInitialPreviewMode(previewMode);
        setView("editor");
    }, []);

    const handleWikiLinkClick = useCallback((target: string) => {
        // 1. 去锚点、去 .md
        const normalizedTarget = target.replace(/#.*$/, '').replace(/\.md$/i, '').trim();
        if (!normalizedTarget) return;

        // 2. API 搜索
        handleNoteList(vault, 1, 50, normalizedTarget, false, "path", false, "mtime", "desc", (data) => {
            if (!data?.list?.length) {
                toast.info(t("ui.note.wikiLinkNotFound", { target: normalizedTarget }));
                return;
            }

            // 3. 精确匹配
            const match = data.list.find(n => {
                const notePath = n.path.replace(/\.md$/i, '');
                return notePath === normalizedTarget
                    || notePath.endsWith('/' + normalizedTarget);
            });

            if (match) {
                handleSelectNote(match, true);
            } else {
                toast.info(t("ui.note.wikiLinkNotFound", { target: normalizedTarget }));
            }
        });
    }, [vault, handleNoteList, handleSelectNote, t]);

    const handleCreateNote = () => {
        setSelectedNote(undefined);
        setInitialPreviewMode(false);
        setView("editor");
    };

    const handleBack = () => {
        setView("list");
        setSelectedNote(undefined);
    };

    const handleNavigateToFolder = (folderPath: string) => {
        setCurrentPath(folderPath);
        setCurrentPathHash(pathHashMap[folderPath] || "");
        setPage(1);
        setView("list");
        setSelectedNote(undefined);
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

    let content;
    if (view === "editor") {
        content = (
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
            />
        );
    } else {
        content = (
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
            />
        );
    }

    return (
        <>
            {content}
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
