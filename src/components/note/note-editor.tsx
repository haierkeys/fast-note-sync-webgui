import { ArrowLeft, Folder, History, RefreshCcw, Check, X, Cloud, Fullscreen, Shrink, Eye, Pencil, Columns2, PanelLeftClose, ArrowLeftRight, Maximize, Minimize, Share2, Download, List } from "lucide-react";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { ShareModal } from "@/components/share/share-modal";
import { Note, NoteDetail } from "@/lib/types/note";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { hashCode } from "@/lib/utils/hash";
import { format } from "date-fns";

import type { MarkdownEditorRef } from "./markdown-editor";
import { TableOfContents } from "./table-of-contents";


// 懒加载编辑器组件
const MarkdownEditor = lazy(() => import("./markdown-editor").then(m => ({ default: m.MarkdownEditor })));

// 编辑器加载占位符
const EditorLoading = () => {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span>{t("ui.note.loadingEditor")}</span>
            </div>
        </div>
    );
};

// x毫秒后未操作触发保存
const AUTO_SAVE_DELAY = 1000;

interface NoteEditorProps {
    vault: string;
    note?: Note;
    onBack: () => void;
    onNavigateToFolder?: (folderPath: string) => void;
    onSaveSuccess: (path: string, pathHash: string) => void;
    onViewHistory?: () => void;
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    isRecycle?: boolean;
    initialPreviewMode?: boolean;
    onWikiLinkClick?: (target: string, currentNotePath?: string) => void;
    defaultFolderPath?: string;
}

export function NoteEditor({
    vault,
    note,
    onBack,
    onNavigateToFolder,
    onSaveSuccess,
    onViewHistory,
    isMaximized = false,
    onToggleMaximize,
    isRecycle = false,
    initialPreviewMode = false,
    onWikiLinkClick,
    defaultFolderPath
}: NoteEditorProps) {
    const { t } = useTranslation();
    const { handleGetNote, handleSaveNote, handleRenameNote } = useNoteHandle();
    const editorRef = useRef<MarkdownEditorRef>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef("");
    const pathRef = useRef("");
    const flushPendingSaveRef = useRef<() => void>(() => {});
    const loadRequestRef = useRef(0);

    const [path, setPath] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [originalNote, setOriginalNote] = useState<NoteDetail | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitleValue, setEditingTitleValue] = useState("");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(initialPreviewMode);
    const [viewLayout, setViewLayout] = useState<"single" | "split">("single");
    const [splitReversed, setSplitReversed] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [showToc, setShowToc] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("fns_show_toc") !== "false";
        }
        return true;
    });

    // content state 变化时同步 ref（加载笔记、重置时）
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // 当 initialPreviewMode 变化时（例如从外部切换笔记），同步状态
    useEffect(() => {
        setIsPreviewMode(initialPreviewMode);
    }, [initialPreviewMode, note?.id]);

    // 是否为新建笔记模式
    const isNewNote = !note;

    const updatePath = useCallback((nextPath: string) => {
        pathRef.current = nextPath;
        setPath(nextPath);
    }, []);

    // 辅助函数：根据完整路径提取文件夹和文件名
    // Helper function: extract folder and filename from the full path
    const getDisplayParts = (fullPath: string) => {
        const lastSlash = fullPath.lastIndexOf('/');
        if (lastSlash === -1) return { folder: '', filename: fullPath };
        return {
            folder: fullPath.substring(0, lastSlash),
            filename: fullPath.substring(lastSlash + 1)
        };
    };

    const { folder, filename } = getDisplayParts(path);

    // 执行保存操作
    const doSave = useCallback((currentPath: string, currentContent: string, silent: boolean = false) => {
        if (!currentPath || isRecycle) return;

        const fullPath = currentPath.endsWith(".md") ? currentPath : currentPath + ".md";

        const options: { pathHash?: string; contentHash?: string } = {
            pathHash: hashCode(fullPath),
            contentHash: hashCode(currentContent)
        };


        setSaving(true);
        handleSaveNote(vault, fullPath, currentContent, options, () => {
            setSaving(false);
            setLastSavedAt(new Date());
            // 保存成功后更新 originalNote 的 path，避免后续请求被误判为重命名
            if (originalNote && originalNote.path !== fullPath) {
                setOriginalNote(prev => prev ? { ...prev, path: fullPath } : null);
            }
            onSaveSuccess(fullPath, options.pathHash || "");
        }, () => {
            setSaving(false);
        }, silent);
    }, [vault, originalNote, handleSaveNote, onSaveSuccess, isRecycle]);

    // 记录上一次加载的笔记标识，用于判断是否需要重新加载
    const lastNoteKeyRef = useRef<string>("");

    const loadNote = useCallback(() => {
        // 切换笔记前：先用旧 path flush 待保存内容，再清除定时器
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
            const latestContent = editorRef.current?.getValue() ?? contentRef.current;
            doSave(pathRef.current, latestContent, true);
        }

        const requestId = ++loadRequestRef.current;
        if (note) {
            updatePath(note.path.replace(/\.md$/, ""));
            setLoading(true);
            handleGetNote(vault, note.path, note.pathHash, isRecycle, (data) => {
                // stale response 保护：丢弃过期请求的响应
                if (requestId !== loadRequestRef.current) return;
                setOriginalNote(data);
                setContent(data.content);
            }, () => {
                if (requestId !== loadRequestRef.current) return;
                setLoading(false);
            });
        } else {
            updatePath(defaultFolderPath ? (defaultFolderPath + "/") : "");
            setContent("");
            setOriginalNote(null);
            setLoading(false);
        }
    }, [note, vault, handleGetNote, isRecycle, updatePath, doSave, defaultFolderPath]);

    // 当 note 关键信息变化时进行加载
    useEffect(() => {
        const currentKey = note ? `${note.id}-${note.pathHash}-${note.path}` : "new-note";
        if (currentKey !== lastNoteKeyRef.current) {
            lastNoteKeyRef.current = currentKey;
            loadNote();
        }
    }, [note, loadNote]);

    // 下载当前编辑/查看的 Markdown 笔记源文件 / Download the current Markdown note source file
    const handleDownload = useCallback(() => {
        const latestContent = editorRef.current?.getValue() ?? contentRef.current;
        const blob = new Blob([latestContent], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const downloadName = filename.endsWith(".md") ? filename : `${filename}.md`;
        link.setAttribute("download", downloadName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [filename]);

    // 组件卸载时：若存在防抖中的保存，立即 flush 一次
    useEffect(() => {
        return () => {
            flushPendingSaveRef.current();
        };
    }, []);

    // 全屏切换
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => {
                // 全屏请求失败时静默处理
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    // 监听全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    // 移动端自动退出分屏，防止隐藏按钮后无法退出
    useEffect(() => {
        if (viewLayout !== "split") return;
        const mql = window.matchMedia("(min-width: 768px)");
        const handleChange = (e: MediaQueryListEvent) => {
            if (!e.matches) {
                const latest = editorRef.current?.getValue() ?? contentRef.current;
                setContent(latest);
                setViewLayout("single");
            }
        };
        if (!mql.matches) {
            const latest = editorRef.current?.getValue() ?? contentRef.current;
            setContent(latest);
            setViewLayout("single");
            return;
        }
        mql.addEventListener("change", handleChange);
        return () => mql.removeEventListener("change", handleChange);
    }, [viewLayout]);

    const flushPendingSave = useCallback(() => {
        if (!saveTimerRef.current) return;

        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;

        const latestContent = editorRef.current?.getValue() ?? contentRef.current;
        doSave(pathRef.current, latestContent, true);
    }, [doSave]);

    useEffect(() => {
        flushPendingSaveRef.current = flushPendingSave;
    }, [flushPendingSave]);

    // 内容变化时的防抖自动保存（只更新 ref，不触发 React 重渲染）
    const handleContentChange = useCallback((newContent: string) => {
        contentRef.current = newContent;

        // 分屏模式下同步 content state，驱动预览面板更新
        if (viewLayout === "split") {
            setContent(newContent);
        }

        // 新建笔记且没有标题时不自动保存
        if (isNewNote && !pathRef.current) return;
        // 回收站模式不保存
        if (isRecycle) return;

        // 清除之前的定时器
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        // 设置新的防抖定时器
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            const latestContent = editorRef.current?.getValue() ?? contentRef.current;
            doSave(pathRef.current, latestContent, true);
        }, AUTO_SAVE_DELAY);
    }, [isNewNote, isRecycle, doSave, viewLayout]);

    // 标题编辑相关
    // Title editing logic
    const startEditingTitle = useCallback(() => {
        if (isRecycle) return;
        setEditingTitleValue(filename);
        setIsEditingTitle(true);
        setTimeout(() => titleInputRef.current?.focus(), 0);
    }, [filename, isRecycle]);

    const cancelEditingTitle = useCallback(() => {
        setIsEditingTitle(false);
        setEditingTitleValue("");
    }, []);
    const saveTitle = useCallback(() => {
        // 只过滤文件系统非法字符，保留空格并允许输入正斜杠 /
        // Only filter out illegal characters, keep spaces and forward slash /
        const sanitized = editingTitleValue
            .replace(/[<>:"\\|?*]/g, '')
            .split('')
            .filter(c => c.charCodeAt(0) >= 32)
            .join('');

        if (!sanitized) {
            cancelEditingTitle();
            return;
        }

        const oldPath = path;
        const oldFullPath = oldPath.endsWith(".md") ? oldPath : oldPath + ".md";
        
        // 确定新完整路径，支持通过在标题中输入斜杠移动文件夹
        // Determine the new full path, supporting folder moves by typing slashes in the title
        let targetPath = sanitized;
        if (!sanitized.includes("/")) {
            targetPath = folder ? (folder + "/" + sanitized) : sanitized;
        }
        const newFullPath = targetPath.endsWith(".md") ? targetPath : targetPath + ".md";

        if (newFullPath === oldFullPath) {
            setIsEditingTitle(false);
            return;
        }

        if (isNewNote) {
            updatePath(targetPath);
            setIsEditingTitle(false);
            return;
        }

        setSaving(true);
        handleRenameNote({
            vault,
            oldPath: oldFullPath,
            path: newFullPath,
            oldPathHash: originalNote?.pathHash
        }, () => {
            setSaving(false);
            updatePath(targetPath);
            setIsEditingTitle(false);
            setLastSavedAt(new Date());

            // 重要：刷新 originalNote 信息，确保后续保存使用新路径
            // Important: refresh originalNote info to ensure subsequent saves use the new path
            if (originalNote) {
                setOriginalNote({
                    ...originalNote,
                    path: newFullPath,
                    pathHash: hashCode(newFullPath)
                });
            }

            // 通知父组件路径变化
            // Notify parent component of path change
            onSaveSuccess(newFullPath, hashCode(newFullPath));
        });
    }, [editingTitleValue, path, folder, vault, originalNote, handleRenameNote, updatePath, isNewNote, onSaveSuccess, cancelEditingTitle]);

    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveTitle();
        } else if (e.key === "Escape") {
            cancelEditingTitle();
        }
    }, [saveTitle, cancelEditingTitle]);

    // 新建笔记时的标题输入
    // Input for title of new notes
    const handleNewNoteTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // 只过滤非法字符，不 trim，允许输入空格
        // Only filter out illegal characters for filesystem, keep spaces and don't trim
        const sanitized = e.target.value
            .replace(/[<>:"\\|?*]/g, '')
            .split('')
            .filter(c => c.charCodeAt(0) >= 32)
            .join('');
        const prefix = defaultFolderPath ? (defaultFolderPath + "/") : "";
        updatePath(prefix + sanitized);
    }, [updatePath, defaultFolderPath]);

    // 新建笔记首次保存
    // First save of new notes
    const handleFirstSave = useCallback(() => {
        if (!filename) {
            toast.error(t("ui.note.noteTitleRequired"));
            return;
        }
        const currentContent = editorRef.current?.getValue() ?? contentRef.current;
        doSave(path, currentContent, true);
    }, [filename, path, doSave, t]);

    const handleBack = useCallback(() => {
        flushPendingSave();

        if (isNewNote && !pathRef.current && contentRef.current.trim()) {
            toast.warning(t("ui.note.unsavedContentWithoutTitle", {
                defaultValue: "Content is not saved because the title is empty."
            }));
        }

        onBack();
    }, [flushPendingSave, isNewNote, onBack, t]);



    // 渲染标题区域
    const renderTitle = () => {
        // 新建笔记模式 - 直接显示输入框和保存按钮
        // New note mode - directly show input and save button
        if (isNewNote) {
            return (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    {folder && (
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground truncate max-w-37.5">{folder}</span>
                            <span className="text-muted-foreground">/</span>
                        </div>
                    )}
                    <Input
                        value={filename}
                        onChange={handleNewNoteTitleChange}
                        onKeyDown={(e) => e.key === "Enter" && handleFirstSave()}
                        placeholder={t("ui.note.noteTitlePlaceholder")?.replace(" (e.g., note.md)", "").replace(" (例如: note.md)", "")}
                        className="font-bold text-sm sm:text-lg border-none shadow-none focus-visible:ring-0 px-1 sm:px-2 flex-1 h-7 sm:h-auto"
                        autoFocus
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("ui.common.save")}
                        className="self-center h-6 w-6 sm:h-7 sm:w-7 shrink-0"
                        onClick={handleFirstSave}
                        disabled={!filename || saving}
                    >
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                </div>
            );
        }

        // 编辑标题模式
        if (isEditingTitle) {
            return (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    {folder && (
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground truncate max-w-37.5">{folder}</span>
                            <span className="text-muted-foreground">/</span>
                        </div>
                    )}
                    <Input
                        ref={titleInputRef}
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        onBlur={saveTitle}
                        className="font-bold text-sm sm:text-lg border-none shadow-none focus-visible:ring-0 px-1 h-7 sm:h-auto py-0 flex-1"
                    />
                    <Button variant="ghost" size="icon" aria-label={t("ui.common.save")} className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" onClick={saveTitle}>
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={t("ui.common.cancel")} className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" onClick={cancelEditingTitle}>
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                </div>
            );
        }

        // 显示标题（可点击编辑）
        return (
            <div className="flex items-center gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0 text-sm sm:text-lg">
                    {folder && (
                        <div
                            className="hidden sm:flex items-center gap-2 shrink-0 cursor-pointer hover:text-primary transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigateToFolder) {
                                    onNavigateToFolder(folder);
                                }
                            }}
                        >
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground truncate max-w-37.5 hover:text-primary">{folder}</span>
                            <span className="text-muted-foreground">/</span>
                        </div>
                    )}
                    <span
                        className={`font-bold truncate ${!isRecycle ? "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors" : ""}`}
                        onClick={startEditingTitle}
                    >
                        {filename}
                    </span>
                </div>
                {/* 保存状态、版本号和更新时间显示 */}
                {!isRecycle && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        {/* 版本号显示 */}
                        {originalNote?.version !== undefined && originalNote.version > 0 && (
                            <Tooltip content={t("ui.history.title")} side="bottom" delay={200}>
                                <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted/50 text-muted-foreground hover:bg-muted cursor-default">
                                    <History className="h-3 w-3" />
                                    <span>v{originalNote.version}</span>
                                </span>
                            </Tooltip>
                        )}
                        {/* 保存状态 */}
                        {saving ? (
                            <>
                                <Cloud className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-pulse" />
                                <span className="hidden sm:inline">{t("ui.common.saving")}</span>
                            </>
                        ) : lastSavedAt ? (
                            <>
                                <Cloud className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
                                <span>{format(lastSavedAt, "HH:mm:ss")}</span>
                            </>
                        ) : originalNote?.mtime ? (
                            <>
                                <Cloud className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50" />
                                <span className="hidden xs:inline">{format(new Date(originalNote.mtime), "MM-dd HH:mm")}</span>
                            </>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={containerRef} className={`w-full h-full min-h-0 flex flex-col ${isFullscreen ? "bg-background p-2 sm:p-4" : ""}`}>
            {/* 顶部工具栏 */}
            <div className="sticky top-0 z-30 -mx-1 mb-2 flex items-center justify-between gap-1 border-b border-border/60 bg-card/95 px-1 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:gap-4 sm:mb-4 sm:py-2">
                <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("ui.common.previous")}
                        onClick={handleBack}
                        className="shrink-0 rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                    >
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>

                    {renderTitle()}
                </div>

                <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
                    {note && (
                        <Tooltip content={t("ui.common.refresh")} side="bottom" delay={200}>
                            <Button
                                onClick={loadNote}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <RefreshCcw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </Tooltip>
                    )}
                    {note && viewLayout === "single" && (
                        <Tooltip content={isPreviewMode ? t("ui.note.editNote") : t("ui.note.viewNote")} side="bottom" delay={200}>
                            <Button
                                onClick={() => {
                                    // 切换前同步最新编辑内容到 state，确保预览/重建编辑器时 value 正确
                                    if (!isPreviewMode) {
                                        const latest = editorRef.current?.getValue() ?? contentRef.current;
                                        setContent(latest);
                                    }
                                    setIsPreviewMode(!isPreviewMode);
                                }}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                {isPreviewMode ? <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            </Button>
                        </Tooltip>
                    )}
                    {note && viewLayout === "single" && isPreviewMode && (
                        <Tooltip content={showToc ? t("ui.note.hideToc", { defaultValue: "Hide Outline" }) : t("ui.note.showToc", { defaultValue: "Show Outline" })} side="bottom" delay={200}>
                            <Button
                                onClick={() => {
                                    setShowToc(prev => {
                                        const next = !prev;
                                        localStorage.setItem("fns_show_toc", String(next));
                                        return next;
                                    });
                                }}
                                variant={showToc ? "default" : "outline"}
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        </Tooltip>
                    )}
                    {note && !isRecycle && (
                        <Tooltip content={viewLayout === "split" ? t("ui.note.singlePanel", { defaultValue: "Single panel" }) : t("ui.note.splitPanel", { defaultValue: "Split panel" })} side="bottom" delay={200}>
                            <Button
                                onClick={() => {
                                    if (viewLayout === "single") {
                                        // 进入分屏：同步最新编辑内容到 state
                                        const latest = editorRef.current?.getValue() ?? contentRef.current;
                                        setContent(latest);
                                        setIsPreviewMode(false);
                                        setViewLayout("split");
                                    } else {
                                        // 退出分屏：同步内容
                                        const latest = editorRef.current?.getValue() ?? contentRef.current;
                                        setContent(latest);
                                        setViewLayout("single");
                                    }
                                }}
                                variant="outline"
                                size="icon"
                                className="hidden md:inline-flex rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                {viewLayout === "split" ? <PanelLeftClose className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Columns2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            </Button>
                        </Tooltip>
                    )}
                    {viewLayout === "split" && (
                        <Tooltip content={t("ui.note.swapPanels", { defaultValue: "Swap panels" })} side="bottom" delay={200}>
                            <Button
                                onClick={() => setSplitReversed(prev => !prev)}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        </Tooltip>
                    )}
                    {note && onViewHistory && (
                        <Tooltip content={t("ui.history.title")} side="bottom" delay={200}>
                            <Button
                                onClick={onViewHistory}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        </Tooltip>
                    )}
                    {onToggleMaximize && (
                        <Tooltip content={isMaximized ? t("ui.note.exitMaximize", { defaultValue: "Exit Maximize" }) : t("ui.note.maximize", { defaultValue: "Maximize" })} side="bottom" delay={200}>
                            <Button
                                onClick={onToggleMaximize}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                {isMaximized ? <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            </Button>
                        </Tooltip>
                    )}
                    {note && !isRecycle && (
                        <Tooltip content={t("ui.share.title", { defaultValue: "Share Note" })} side="bottom" delay={200}>
                            <Button
                                onClick={() => setShareModalOpen(true)}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        </Tooltip>
                    )}
                    {note && (
                        <Tooltip content={t("ui.note.downloadMarkdown", { defaultValue: "Download Markdown" })} side="bottom" delay={200}>
                            <Button
                                onClick={handleDownload}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip content={isFullscreen ? t("ui.note.exitFullscreen") : t("ui.note.fullscreen")} side="bottom" delay={200}>
                        <Button
                            onClick={toggleFullscreen}
                            variant="outline"
                            size="icon"
                            className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                        >
                            {isFullscreen ? <Shrink className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Fullscreen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* 编辑器区域 */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-full rounded-xl border border-border bg-card">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                    </div>
                ) : viewLayout === "split" ? (
                    <div className="h-full flex gap-1">
                        {/* 左侧面板 */}
                        <div className="flex-1 min-w-0 overflow-visible rounded-xl border border-border bg-card">
                            <Suspense fallback={<EditorLoading />}>
                                <MarkdownEditor
                                    ref={splitReversed ? undefined : editorRef}
                                    key={`${note?.id}-${splitReversed ? "preview" : "edit"}`}
                                    value={content}
                                    onChange={splitReversed ? undefined : handleContentChange}
                                    readOnly={splitReversed || isRecycle}
                                    initialMode={splitReversed ? "preview" : "edit"}
                                    vault={vault}
                                    fileLinks={originalNote?.fileLinks}
                                    notePath={path}
                                    onWikiLinkClick={(target) => onWikiLinkClick?.(target, path)}
                                />
                            </Suspense>
                        </div>
                        {/* 右侧面板 */}
                        <div className="flex-1 min-w-0 overflow-visible rounded-xl border border-border bg-card">
                            <Suspense fallback={<EditorLoading />}>
                                <MarkdownEditor
                                    ref={splitReversed ? editorRef : undefined}
                                    key={`${note?.id}-${splitReversed ? "edit" : "preview"}`}
                                    value={content}
                                    onChange={splitReversed ? handleContentChange : undefined}
                                    readOnly={!splitReversed || isRecycle}
                                    initialMode={splitReversed ? "edit" : "preview"}
                                    vault={vault}
                                    fileLinks={originalNote?.fileLinks}
                                    notePath={path}
                                    onWikiLinkClick={(target) => onWikiLinkClick?.(target, path)}
                                />
                            </Suspense>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col lg:flex-row gap-4 overflow-visible">
                        <div className="flex-1 min-w-0 overflow-visible rounded-xl border border-border bg-card">
                            <Suspense fallback={<EditorLoading />}>
                                <MarkdownEditor
                                    ref={editorRef}
                                    key={`${note?.id}-${isPreviewMode}`}
                                    value={content}
                                    onChange={handleContentChange}
                                    readOnly={isRecycle || isPreviewMode}
                                    placeholder={t("ui.note.noteContentPlaceholder")}
                                    ariaLabel={t("ui.note.editNote")}
                                    vault={vault}
                                    fileLinks={originalNote?.fileLinks}
                                    initialMode={isPreviewMode ? "preview" : "edit"}
                                    notePath={path}
                                    onWikiLinkClick={(target) => onWikiLinkClick?.(target, path)}
                                />
                            </Suspense>
                        </div>
                        {isPreviewMode && showToc && (
                            <TableOfContents isInline={true} className="hidden lg:flex shrink-0 w-60 top-16 max-h-[calc(100vh-166px)]" />
                        )}
                    </div>
                )}
            </div>
            {note && !isRecycle && (
                <ShareModal
                    vault={vault}
                    path={originalNote?.path || note.path}
                    pathHash={originalNote?.pathHash || note.pathHash}
                    open={shareModalOpen}
                    onOpenChange={setShareModalOpen}
                />
            )}
        </div>
    );
}
