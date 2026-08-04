import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Paperclip, RefreshCw, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFileHandle } from "@/components/api-handle/file-handle";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { cn } from "@/lib/utils";
import type { File as FileDTO, FileListResponse } from "@/lib/types/file";
import type { Folder as FolderDTO } from "@/lib/types/folder";
import type { Note, NoteListResponse } from "@/lib/types/note";

interface TreeChildren {
    folders: FolderDTO[];
    notes: Note[];
    canvasFiles: FileDTO[];
    attachments: FileDTO[];
}

interface NoteTreeSidebarProps {
    vault: string;
    selectedPathHash?: string;
    onSelectNote: (note: Note, previewMode?: boolean) => void;
    onSelectFile: (file: FileDTO) => void;
    onFoldersLoaded?: (folders: FolderDTO[]) => void;
}

type TreeSearchResult =
    | { type: "note"; path: string; pathHash: string; note: Note }
    | { type: "canvas"; path: string; pathHash: string; file: FileDTO }
    | { type: "attachment"; path: string; pathHash: string; file: FileDTO };

const ROOT_KEY = "__root__";
const ROOT_PATH = "";
const ROOT_PATH_HASH = "";
const TREE_PAGE_SIZE = 99999;
const SEARCH_DEBOUNCE_MS = 300;

function getFolderName(path: string) {
    return path.split("/").filter(Boolean).pop() || path;
}

function getItemTitle(path: string) {
    return path.split("/").pop()?.replace(/\.(md|canvas)$/i, "") || path;
}

function sortChildren(children: TreeChildren): TreeChildren {
    return {
        folders: [...children.folders].sort((a, b) => a.path.localeCompare(b.path)),
        notes: [...children.notes].sort((a, b) => a.path.localeCompare(b.path)),
        canvasFiles: [...children.canvasFiles].sort((a, b) => a.path.localeCompare(b.path)),
        attachments: [...children.attachments].sort((a, b) => a.path.localeCompare(b.path)),
    };
}

function canvasFileToNote(file: FileDTO): Note {
    return {
        id: 0,
        action: "",
        path: file.path,
        pathHash: file.pathHash,
        ctime: file.ctime,
        mtime: file.mtime,
        updatedTimestamp: file.mtime,
        updatedAt: "",
        createdAt: "",
        version: 0,
    };
}

export function NoteTreeSidebar({ vault, selectedPathHash, onSelectNote, onSelectFile, onFoldersLoaded }: NoteTreeSidebarProps) {
    const { t } = useTranslation();
    const { handleFolderList, handleFolderNotes, handleNoteList } = useNoteHandle();
    const { handleFolderFiles, handleFileList } = useFileHandle();
    const [childrenByKey, setChildrenByKey] = useState<Record<string, TreeChildren>>({});
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set([ROOT_KEY]));
    const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
    const [searchKeyword, setSearchKeyword] = useState("");
    const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<TreeSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchRequestIdRef = useRef(0);

    const loadChildren = useCallback((key: string, path: string, pathHash: string) => {
        setLoadingKeys(prev => new Set(prev).add(key));

        Promise.all([
            new Promise<FolderDTO[] | null>(resolve => handleFolderList(vault, path, pathHash, resolve)),
            new Promise<{ list: Note[] } | null>(resolve =>
                handleFolderNotes(vault, path, pathHash, 1, TREE_PAGE_SIZE, "path", "asc", resolve)
            ),
            new Promise<{ list: FileDTO[] } | null>(resolve =>
                handleFolderFiles(vault, path, pathHash, 1, TREE_PAGE_SIZE, "path", "asc", resolve)
            ),
        ]).then(([folders, notes, files]) => {
            const folderList = folders || [];
            onFoldersLoaded?.(folderList);
            setChildrenByKey(prev => ({
                ...prev,
                [key]: sortChildren({
                    folders: folderList,
                    notes: notes?.list || [],
                    canvasFiles: (files?.list || []).filter(file => file.path.toLowerCase().endsWith(".canvas")),
                    attachments: (files?.list || []).filter(file => !file.path.toLowerCase().endsWith(".canvas")),
                }),
            }));
        }).finally(() => {
            setLoadingKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        });
    }, [handleFolderFiles, handleFolderList, handleFolderNotes, onFoldersLoaded, vault]);

    useEffect(() => {
        setChildrenByKey({});
        setExpandedKeys(new Set([ROOT_KEY]));
        setLoadingKeys(new Set());
        setSearchKeyword("");
        setDebouncedSearchKeyword("");
        setSearchResults([]);
        setSearchLoading(false);
        loadChildren(ROOT_KEY, ROOT_PATH, ROOT_PATH_HASH);
    }, [loadChildren, vault]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchKeyword(searchKeyword.trim());
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [searchKeyword]);

    useEffect(() => {
        const keyword = debouncedSearchKeyword.trim();
        const requestId = ++searchRequestIdRef.current;

        if (!keyword) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);

        Promise.all([
            new Promise<NoteListResponse | null>(resolve =>
                handleNoteList(vault, 1, TREE_PAGE_SIZE, keyword, false, "path", false, "path", "asc", resolve)
            ),
            new Promise<FileListResponse | null>(resolve =>
                handleFileList(vault, 1, TREE_PAGE_SIZE, false, keyword, "path", "asc", resolve)
            ),
        ]).then(([noteData, fileData]) => {
            if (requestId !== searchRequestIdRef.current) return;

            const noteResults: TreeSearchResult[] = (noteData?.list || []).map(note => ({
                type: "note",
                path: note.path,
                pathHash: note.pathHash,
                note,
            }));
            const fileResults: TreeSearchResult[] = (fileData?.list || [])
                .map(file => ({
                    type: file.path.toLowerCase().endsWith(".canvas") ? "canvas" : "attachment",
                    path: file.path,
                    pathHash: file.pathHash,
                    file,
                }));

            setSearchResults([...noteResults, ...fileResults].sort((a, b) => a.path.localeCompare(b.path)));
        }).finally(() => {
            if (requestId === searchRequestIdRef.current) {
                setSearchLoading(false);
            }
        });
    }, [debouncedSearchKeyword, handleFileList, handleNoteList, vault]);

    const toggleFolder = useCallback((folder: FolderDTO) => {
        const key = folder.pathHash || folder.path;

        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });

        if (!childrenByKey[key] && !loadingKeys.has(key)) {
            loadChildren(key, folder.path, folder.pathHash);
        }
    }, [childrenByKey, loadChildren, loadingKeys]);

    const rootChildren = childrenByKey[ROOT_KEY];
    const rootIsLoading = loadingKeys.has(ROOT_KEY);

    const isEmpty = useMemo(() => {
        if (!rootChildren) return false;
        return rootChildren.folders.length === 0 && rootChildren.notes.length === 0 && rootChildren.canvasFiles.length === 0 && rootChildren.attachments.length === 0;
    }, [rootChildren]);

    const isSearching = debouncedSearchKeyword.length > 0;

    const handleClearSearch = () => {
        setSearchKeyword("");
        setDebouncedSearchKeyword("");
        setSearchResults([]);
        setSearchLoading(false);
    };

    const handleSelectSearchResult = (item: TreeSearchResult) => {
        if (item.type === "canvas") {
            onSelectNote(canvasFileToNote(item.file), true);
            return;
        }

        if (item.type === "attachment") {
            onSelectFile(item.file);
            return;
        }

        onSelectNote(item.note, true);
    };

    const renderSearchResult = (item: TreeSearchResult) => {
        const selected = selectedPathHash === item.pathHash;

        return (
            <button
                key={`${item.type}-${item.pathHash || item.path}`}
                type="button"
                className={cn(
                    "flex min-h-10 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "bg-primary/10 text-primary hover:bg-primary/15"
                )}
                onClick={() => handleSelectSearchResult(item)}
            >
                {item.type === "attachment" ? (
                    <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                    <FileText className={cn("mt-0.5 h-4 w-4 shrink-0", item.type === "canvas" ? "text-amber-500" : "text-muted-foreground")} />
                )}
                <span className="min-w-0 flex-1">
                    <span className="block truncate">{getItemTitle(item.path)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.path}</span>
                </span>
            </button>
        );
    };

    const renderFolder = (folder: FolderDTO, depth: number) => {
        const key = folder.pathHash || folder.path;
        const isExpanded = expandedKeys.has(key);
        const isLoading = loadingKeys.has(key);
        const children = childrenByKey[key];

        return (
            <div key={key}>
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ paddingLeft: `${8 + depth * 16}px` }}
                    onClick={() => toggleFolder(folder)}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {isExpanded ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                    ) : (
                        <Folder className="h-4 w-4 shrink-0 text-blue-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{getFolderName(folder.path)}</span>
                    {isLoading && <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
                </button>

                {isExpanded && children && (
                    <div className="mt-0.5">
                        {children.folders.map(child => renderFolder(child, depth + 1))}
                        {children.notes.map(note => renderNote(note, depth + 1))}
                        {children.canvasFiles.map(file => renderCanvasFile(file, depth + 1))}
                        {children.attachments.map(file => renderAttachment(file, depth + 1))}
                        {children.folders.length === 0 && children.notes.length === 0 && children.canvasFiles.length === 0 && children.attachments.length === 0 && (
                            <div
                                className="px-2 py-1.5 text-xs text-muted-foreground"
                                style={{ paddingLeft: `${28 + (depth + 1) * 16}px` }}
                            >
                                {t("ui.note.treeEmpty")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderNote = (note: Note, depth: number) => {
        const selected = selectedPathHash === note.pathHash;

        return (
            <button
                key={note.pathHash || note.path}
                type="button"
                className={cn(
                    "flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "bg-primary/10 text-primary hover:bg-primary/15"
                )}
                style={{ paddingLeft: `${28 + depth * 16}px` }}
                onClick={() => onSelectNote(note, true)}
            >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{getItemTitle(note.path)}</span>
            </button>
        );
    };

    const renderCanvasFile = (file: FileDTO, depth: number) => {
        const selected = selectedPathHash === file.pathHash;

        return (
            <button
                key={file.pathHash || file.path}
                type="button"
                className={cn(
                    "flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "bg-primary/10 text-primary hover:bg-primary/15"
                )}
                style={{ paddingLeft: `${28 + depth * 16}px` }}
                onClick={() => onSelectNote(canvasFileToNote(file), true)}
            >
                <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate">{getItemTitle(file.path)}</span>
            </button>
        );
    };

    const renderAttachment = (file: FileDTO, depth: number) => {
        const selected = selectedPathHash === file.pathHash;

        return (
            <button
                key={file.pathHash || file.path}
                type="button"
                className={cn(
                    "flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "bg-primary/10 text-primary hover:bg-primary/15"
                )}
                style={{ paddingLeft: `${28 + depth * 16}px` }}
                onClick={() => onSelectFile(file)}
            >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{getItemTitle(file.path)}</span>
            </button>
        );
    };

    return (
        <aside className="sticky top-0 flex h-[calc(100vh-102px)] max-h-[calc(100vh-102px)] min-h-0 w-80 shrink-0 self-start flex-col rounded-xl border border-border bg-card">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold">{t("ui.note.documentTree")}</span>
                </div>
                {rootIsLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="shrink-0 border-b border-border p-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={searchKeyword}
                        aria-label={t("ui.common.search")}
                        placeholder={t("ui.note.treeSearchPlaceholder")}
                        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={(event) => setSearchKeyword(event.target.value)}
                    />
                    {searchKeyword && (
                        <button
                            type="button"
                            aria-label={t("ui.common.clear")}
                            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={handleClearSearch}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
                {isSearching ? (
                    searchLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {t("ui.common.loading")}
                        </div>
                    ) : searchResults.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">{t("ui.common.noSearchResults")}</div>
                    ) : (
                        <div className="space-y-1">
                            {searchResults.map(renderSearchResult)}
                        </div>
                    )
                ) : !rootChildren && rootIsLoading ? (
                    <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("ui.note.treeLoading")}
                    </div>
                ) : isEmpty ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{t("ui.note.treeEmpty")}</div>
                ) : (
                    <>
                        {rootChildren?.folders.map(folder => renderFolder(folder, 0))}
                        {rootChildren?.notes.map(note => renderNote(note, 0))}
                        {rootChildren?.canvasFiles.map(file => renderCanvasFile(file, 0))}
                        {rootChildren?.attachments.map(file => renderAttachment(file, 0))}
                    </>
                )}
            </div>
        </aside>
    );
}
