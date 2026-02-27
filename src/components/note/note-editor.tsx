import { ArrowLeft, Folder, History, RefreshCcw, Check, X, Cloud, Fullscreen, Shrink, Eye, Pencil } from "lucide-react";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { Note, NoteDetail } from "@/lib/types/note";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { hashCode } from "@/lib/utils/hash";
import { format } from "date-fns";

import type { VditorEditorRef } from "./vditor-editor";


// 懒加载编辑器组件
const VditorEditor = lazy(() => import("./vditor-editor").then(m => ({ default: m.VditorEditor })));

// 编辑器加载占位符
const EditorLoading = () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span>加载编辑器...</span>
        </div>
    </div>
);

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
}

export function NoteEditor({
    vault,
    note,
    onBack,
    onNavigateToFolder,
    onSaveSuccess,
    onViewHistory,
    isMaximized: _isMaximized = false,
    onToggleMaximize: _onToggleMaximize,
    isRecycle = false,
    initialPreviewMode = false
}: NoteEditorProps) {
    // 保留 isMaximized 和 onToggleMaximize 用于未来最大化功能
    void _isMaximized;
    void _onToggleMaximize;
    const { t } = useTranslation();
    const { handleGetNote, handleSaveNote } = useNoteHandle();
    const editorRef = useRef<VditorEditorRef>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
    const titleInputRef = useRef<HTMLInputElement>(null);

    // 当 initialPreviewMode 变化时（例如从外部切换笔记），同步状态
    useEffect(() => {
        setIsPreviewMode(initialPreviewMode);
    }, [initialPreviewMode, note?.id]);

    // 是否为新建笔记模式
    const isNewNote = !note;

    // 记录上一次加载的笔记标识，用于判断是否需要重新加载
    const lastNoteKeyRef = useRef<string>("");

    const loadNote = useCallback(() => {
        if (note) {
            setPath(note.path.replace(/\.md$/, ""));
            setLoading(true);
            handleGetNote(vault, note.path, note.pathHash, isRecycle, (data) => {
                setOriginalNote(data);
                setContent(data.content);
                setLoading(false);
            });
        } else {
            setPath("");
            setContent("");
            setOriginalNote(null);
        }
    }, [note, vault, handleGetNote, isRecycle]);

    // 当 note 关键信息变化时进行加载
    useEffect(() => {
        const currentKey = note ? `${note.id}-${note.pathHash}-${note.path}` : "new-note";
        if (currentKey !== lastNoteKeyRef.current) {
            lastNoteKeyRef.current = currentKey;
            loadNote();
        }
    }, [note, loadNote]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
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



    // 执行保存操作
    const doSave = useCallback((currentPath: string, currentContent: string, silent: boolean = false) => {
        if (!currentPath || isRecycle) return;

        const fullPath = currentPath.endsWith(".md") ? currentPath : currentPath + ".md";

        const options: { pathHash?: string; srcPath?: string; srcPathHash?: string; contentHash?: string } = {
            pathHash: hashCode(fullPath),
            contentHash: hashCode(currentContent)
        };

        if (originalNote) {
            options.srcPath = originalNote.path;
            options.srcPathHash = hashCode(originalNote.path);
        }

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

    // 内容变化时的防抖自动保存
    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);

        // 新建笔记且没有标题时不自动保存
        if (isNewNote && !path) return;
        // 回收站模式不保存
        if (isRecycle) return;

        // 清除之前的定时器
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        // 设置新的防抖定时器
        saveTimerRef.current = setTimeout(() => {
            doSave(path, newContent, true);
        }, AUTO_SAVE_DELAY);
    }, [path, isNewNote, isRecycle, doSave]);

    // 标题编辑相关
    const startEditingTitle = useCallback(() => {
        if (isRecycle) return;
        setEditingTitleValue(path);
        setIsEditingTitle(true);
        setTimeout(() => titleInputRef.current?.focus(), 0);
    }, [path, isRecycle]);

    const cancelEditingTitle = useCallback(() => {
        setIsEditingTitle(false);
        setEditingTitleValue("");
    }, []);

    const saveTitle = useCallback(() => {
        // 只过滤文件系统非法字符，保留空格
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
        setPath(sanitized);
        setIsEditingTitle(false);

        // 如果路径变化了，保存笔记
        if (sanitized !== oldPath) {
            const currentContent = editorRef.current?.getValue() || content;
            doSave(sanitized, currentContent, true);
        }
    }, [editingTitleValue, path, content, doSave, cancelEditingTitle]);

    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveTitle();
        } else if (e.key === "Escape") {
            cancelEditingTitle();
        }
    }, [saveTitle, cancelEditingTitle]);

    // 新建笔记时的标题输入
    const handleNewNoteTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // 只过滤非法字符，不 trim，允许输入空格
        const sanitized = e.target.value
            .replace(/[<>:"\\|?*]/g, '')
            .split('')
            .filter(c => c.charCodeAt(0) >= 32)
            .join('');
        setPath(sanitized);
    }, []);

    // 新建笔记首次保存
    const handleFirstSave = useCallback(() => {
        if (!path) {
            toast.error(t("ui.note.noteTitleRequired"));
            return;
        }
        const currentContent = editorRef.current?.getValue() || content;
        doSave(path, currentContent, true);
    }, [path, content, doSave, t]);

    const getDisplayParts = (fullPath: string) => {
        const lastSlash = fullPath.lastIndexOf('/');
        if (lastSlash === -1) return { folder: '', filename: fullPath };
        return {
            folder: fullPath.substring(0, lastSlash),
            filename: fullPath.substring(lastSlash + 1)
        };
    };

    const { folder, filename } = getDisplayParts(path);

    // 渲染标题区域
    const renderTitle = () => {
        // 新建笔记模式 - 直接显示输入框和保存按钮
        if (isNewNote) {
            return (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                        value={path}
                        onChange={handleNewNoteTitleChange}
                        onKeyDown={(e) => e.key === "Enter" && handleFirstSave()}
                        placeholder={t("ui.note.noteTitlePlaceholder")?.replace(" (e.g., note.md)", "").replace(" (例如: note.md)", "")}
                        className="font-bold text-sm sm:text-lg border-none shadow-none focus-visible:ring-0 px-1 sm:px-2 flex-1 h-7 sm:h-auto"
                        autoFocus
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="self-center h-6 w-6 sm:h-7 sm:w-7 shrink-0"
                        onClick={handleFirstSave}
                        disabled={!path || saving}
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" onClick={saveTitle}>
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" onClick={cancelEditingTitle}>
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
        <div ref={containerRef} className={`w-full h-full flex flex-col ${isFullscreen ? "bg-background p-2 sm:p-4" : ""}`}>
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between gap-1 sm:gap-4 mb-1 sm:mb-4">
                <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
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
                    {note && (
                        <Tooltip content={isPreviewMode ? t("ui.note.editNote") : t("ui.note.viewNote")} side="bottom" delay={200}>
                            <Button
                                onClick={() => setIsPreviewMode(!isPreviewMode)}
                                variant="outline"
                                size="icon"
                                className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                            >
                                {isPreviewMode ? <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
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
                ) : (
                    <div className="h-full overflow-visible rounded-xl border border-border bg-card">
                        <Suspense fallback={<EditorLoading />}>
                            <VditorEditor
                                ref={editorRef}
                                key={`${note?.id}-${isPreviewMode}`}
                                value={content}
                                onChange={handleContentChange}
                                readOnly={isRecycle || isPreviewMode}
                                placeholder={t("ui.note.noteContentPlaceholder")}
                                vault={vault}
                                fileLinks={originalNote?.fileLinks}
                                initialMode={isPreviewMode ? "preview" : "sv"}
                            />
                        </Suspense>
                    </div>
                )}
            </div>
        </div>
    );
}
