import { NotepadText, Trash2, RefreshCw, Plus, Calendar, Clock, ChevronLeft, ChevronRight, History, Search, X, SortDesc, SortAsc, RotateCcw, Eye, Pencil, Folder as FolderIcon, ChevronDown, FolderSearch, TextCursorInput, Share2, Library, FileText, Paperclip, Image, Music, Video, FileCode, Upload, FolderPlus, FolderTree } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { useShareHandle } from "@/components/api-handle/share-handle";
import { toast } from "@/components/common/Toast";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { Folder } from "@/lib/types/folder";
import { Note } from "@/lib/types/note";
import { format } from "date-fns";
import { ShareModal } from "@/components/share/share-modal";
import { DndContext, useDraggable, useDroppable, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { FilePreview } from "@/components/file/file-preview";
import { useFileHandle } from "@/components/api-handle/file-handle";
import { File as FileDTO, FileListResponse } from "@/lib/types/file";
import { useMobile } from "@/hooks/use-mobile";


type SearchMode = "path" | "content";
type SortBy = "mtime" | "ctime" | "path";
type SortOrder = "desc" | "asc";
export type ShareFilterType = 'active' | null;
export type ViewModeType = 'flat' | 'folder' | 'flat-file' | 'workspace';

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
    shareFilter: ShareFilterType;
    setShareFilter: (filter: ShareFilterType) => void;
    viewMode: ViewModeType;
    setViewMode: (mode: ViewModeType) => void;
}

/**
 * 可拖拽的笔记卡片包装组件 - 支持直接点击拖拽整张卡片
 * Draggable note card wrapper component - supports dragging the entire card directly
 */
interface DraggableNoteCardProps {
    note: Note;
    children: React.ReactNode;
}

function DraggableNoteCard({ note, children }: DraggableNoteCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `note-${note.pathHash}`,
        data: {
            type: "note",
            note
        }
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 9999 : undefined,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes}
            {...listeners}
            className={cn(
                "w-full cursor-grab active:cursor-grabbing",
                isDragging && "pointer-events-none"
            )}
        >
            {children}
        </div>
    );
}

/**
 * 可拖拽的附件卡片包装组件 - 支持直接点击拖拽整张卡片
 * Draggable file card wrapper component - supports dragging the entire card directly
 */
interface DraggableFileCardProps {
    file: FileDTO;
    children: React.ReactNode;
}

function DraggableFileCard({ file, children }: DraggableFileCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `file-${file.pathHash}`,
        data: {
            type: "file",
            file
        }
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 9999 : undefined,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes}
            {...listeners}
            className={cn(
                "w-full cursor-grab active:cursor-grabbing",
                isDragging && "pointer-events-none"
            )}
        >
            {children}
        </div>
    );
}

/**
 * 可放置的文件夹卡片包装组件
 * Droppable folder card wrapper component
 */
interface DroppableFolderCardProps {
    folder: Folder;
    children: React.ReactNode;
}

function DroppableFolderCard({ folder, children }: DroppableFolderCardProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: `folder-${folder.pathHash}`,
        data: {
            type: "folder",
            folder
        }
    });

    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                "transition-all duration-200 rounded-xl",
                isOver && "ring-2 ring-primary ring-offset-2 scale-[1.01] bg-primary/5 border-primary/40 shadow-md"
            )}
        >
            {children}
        </div>
    );
}

/**
 * 可放置的面包屑按钮包装组件
 * Droppable breadcrumb button wrapper component
 */
interface DroppableBreadcrumbButtonProps {
    path: string;
    children: React.ReactNode;
    className?: string;
}

function DroppableBreadcrumbButton({ path, children, className }: DroppableBreadcrumbButtonProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: `breadcrumb-folder-${path || "root"}`,
        data: {
            type: "breadcrumb-folder",
            path
        }
    });

    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                // 默认使用紧凑内边距 px-2 py-0.5，与文字对齐；加上 select-none 优化交互体验
                // Default to tight px-2 py-0.5 padding for visual alignment; add select-none to optimize drag feel
                "inline-flex items-center transition-all duration-200 rounded-md px-2 py-0.5 border border-transparent text-xs sm:text-sm select-none",
                className,
                // 当拖拽悬停时变大并高亮，并赋予 z-40 确保绝对覆盖下方卡片，不受层叠上下文干扰
                // Scale up slightly and highlight when dragged over, add relative z-40 to prevent overlapping issues from lower cards
                isOver && "bg-primary/10 text-primary scale-[1.03] border-primary/20 shadow-sm relative z-40"
            )}
        >
            {children}
        </div>
    );
}


export function NoteList({ vault, vaults, onVaultChange, onSelectNote, onCreateNote, page, setPage, pageSize, setPageSize, onViewHistory, isRecycle = false, searchKeyword, setSearchKeyword, currentPath, setCurrentPath, currentPathHash, setCurrentPathHash, pathHashMap, setPathHashMap, shareFilter, setShareFilter, viewMode, setViewMode }: NoteListProps) {
    const { t } = useTranslation();
    const isMobile = useMobile();
    const { handleNoteList, handleDeleteNote, handleRestoreNote, handleFolderList, handleFolderNotes, handlePermanentDeleteNote, handleClearNoteRecycle, handleRenameNote, handleNoteListByPaths, handleDeleteFolder, handleCreateFolder } = useNoteHandle();
    const { handleGetNoteSharePaths } = useShareHandle();
    const { openConfirmDialog } = useConfirmDialog();

    // 拖拽传感器配置，加上 8px 移动判定以过滤普通的笔记点击阅读
    // Drag sensors configuration, with 8px constraint to filter normal clicks for reading notes
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const { handleFileList, handleDeleteFile, getRawFileUrl, handleFolderFiles, handleRenameFile, handleFileUpload } = useFileHandle();

    // 处理笔记与附件拖拽至子目录或面包屑导航（笔记库根目录/上级目录）的放置逻辑
    // Handle drop logic of dragging notes and attachments to subfolders or breadcrumb navigation (vault root/parent folders)
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        // 获取目标目录相对路径 / Get target directory relative path
        let targetPath: string | null = null;
        if (overData?.type === "folder") {
            const targetFolder = overData.folder as Folder;
            targetPath = targetFolder.path;
        } else if (overData?.type === "breadcrumb-folder") {
            targetPath = overData.path; // targetPath is "" for vault root
        }

        if (targetPath === null) return;

        if (activeData?.type === "note") {
            const dragNote = activeData.note as Note;
            const filename = dragNote.path.split("/").pop() || "";
            const newFullPath = targetPath === "" ? filename : targetPath + "/" + filename;

            if (newFullPath === dragNote.path) return;

            handleRenameNote({
                vault,
                oldPath: dragNote.path,
                path: newFullPath,
                oldPathHash: dragNote.pathHash
            }, () => {
                fetchNotes();
            });
        } else if (activeData?.type === "file") {
            const dragFile = activeData.file as FileDTO;
            const filename = dragFile.path.split("/").pop() || "";
            const newFullPath = targetPath === "" ? filename : targetPath + "/" + filename;

            if (newFullPath === dragFile.path) return;

            handleRenameFile({
                vault,
                oldPath: dragFile.path,
                path: newFullPath,
                oldPathHash: dragFile.pathHash
            }, () => {
                fetchNotes();
            });
        }
    };

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalRows, setTotalRows] = useState(0);
    const [filterType, setFilterType] = useState<'notes' | 'files'>('notes');
    const [debouncedKeyword, setDebouncedKeyword] = useState(searchKeyword);
    const [searchMode, setSearchMode] = useState<SearchMode>("path");

    // 附件管理的状态声明 / Attachment management states
    const [files, setFiles] = useState<FileDTO[]>([]);
    const [filesTotalRows, setFilesTotalRows] = useState(0);
    const [filePage, setFilePage] = useState(1);
    const [filePageSize, setFilePageSize] = useState(() => {
        const saved = localStorage.getItem("filePageSize");
        return saved ? parseInt(saved, 10) : 10;
    });

    const [fileLoading, setFileLoading] = useState(false);

    // 附件上传状态与引用 / Attachment upload states and ref
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 处理文件选择并执行附件上传 / Handle file selection and perform attachment upload
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setUploading(true);
        // 如果 currentPath 存在，组装当前文件夹相对路径；否则直接用文件名
        // Assemble relative path of current folder if currentPath exists; otherwise use filename directly
        const targetPath = currentPath ? `${currentPath}/${selectedFile.name}` : selectedFile.name;

        handleFileUpload(vault, targetPath, selectedFile, (data) => {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ""; // 重置文件输入框 / Reset file input
            }
            if (data) {
                fetchNotes(); // 刷新混合列表 / Refresh hybrid list
            }
        });
    };

    // 附件预览状态 / Attachment preview states
    const [previewFile, setPreviewFile] = useState<FileDTO | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");

    const [sortBy, setSortBy] = useState<SortBy>("mtime");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [batchRestoreProgress, setBatchRestoreProgress] = useState<{ current: number; total: number } | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);
    const noteRequestIdRef = useRef(0);
    const { trashType, setModule } = useAppStore();
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedShareNote, setSelectedShareNote] = useState<Note | null>(null);
    // 仅存储有效分享的笔记路径集合，替代原来的完整 ShareItem 列表
    // Only store active shared note paths, replacing the full ShareItem list
    const [activeSharePaths, setActiveSharePaths] = useState<Set<string>>(new Set());

    const refreshShareItems = () => {
        if (isRecycle) return;
        handleGetNoteSharePaths(vault, (paths) => {
            // 内容未变化时跳过更新，避免触发不必要的全列表重渲染
            // Skip update when content is unchanged to avoid unnecessary full list re-render
            setActiveSharePaths(prev => {
                if (paths.length !== prev.size || !paths.every(p => prev.has(p))) return new Set(paths);
                return prev;
            });
        });
    };

    // 非回收站模式下异步懒加载分享路径（不阻塞首屏笔记列表渲染）
    // Lazy-load share paths asynchronously after mount (does not block first-screen note list)
    useEffect(() => {
        refreshShareItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vault]);

    // 活跃分享路径集合即为 activeSharePaths（已按 vault 过滤）
    // Active note path set is already filtered by vault on backend
    const activeShareCount = activeSharePaths.size;

    // 仅在分享筛选激活时才将 size 纳入 fetchNotes 依赖，避免正常模式下触发多余请求
    // Only include share path count as a fetchNotes dependency when share filter is active
    const shareFilterActiveDep = shareFilter === 'active' ? activeSharePaths.size : 0;

    // Debounce search keyword
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedKeyword(searchKeyword);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchKeyword]);



    const fetchNotes = (
        currentPage: number = page,
        currentPageSize: number = pageSize,
        currentFilePage: number = filePage,
        currentFilePageSize: number = filePageSize,
        keyword: string = debouncedKeyword
    ) => {
        const requestId = ++noteRequestIdRef.current;

        setLoading(true);
        // 每次新请求统一重置文件加载标志，避免上一个请求（如目录/附件模式）被新请求淘汰后残留 fileLoading，导致加载占位符永久显示
        // Reset file loading flag on every new request so a stale request (e.g. folder/attachment mode) discarded by requestId
        // cannot leave fileLoading stuck true and keep the loading placeholder visible forever.
        setFileLoading(false);

        if (viewMode === "workspace" && !isRecycle) {
            setFolders([]);
            setNotes([]);
            setFiles([]);
            setTotalRows(0);
            setFilesTotalRows(0);
            setLoading(false);
            setFileLoading(false);
            return;
        }

        // 分享筛选：全库平铺查询（修复子文件夹漏筛）
        // Share filter: global flat search (fixes missing subfolder shares)
        if (shareFilter === 'active' && !isRecycle) {
            setFolders([]);
            if (activeSharePaths.size === 0) {
                setNotes([]);
                setTotalRows(0);
                setLoading(false);
                return;
            }

            handleNoteListByPaths(vault, [...activeSharePaths], currentPage, currentPageSize, sortBy, sortOrder, (data) => {
                if (requestId !== noteRequestIdRef.current) return;
                setNotes(data?.list || []);
                setTotalRows(data?.pager?.totalRows || 0);
                setLoading(false);
            });
            return;
        }

        // 附件平铺浏览模式
        // Flat file view mode
        if (viewMode === "flat-file" && !isRecycle) {
            setFileLoading(true);
            handleFileList(vault, currentFilePage, currentFilePageSize, isRecycle, keyword, sortBy, sortOrder, (data) => {
                if (requestId !== noteRequestIdRef.current) return;
                setFiles(data?.list || []);
                setFilesTotalRows(data?.pager?.totalRows || 0);
                setFileLoading(false);
                setLoading(false);
            });
            return;
        }

        if (viewMode === "folder" && !isRecycle) {
            // 并行发起目录列表、目录笔记和目录附件三个独立请求，拉取全量数据进行前端合并
            // Issue folder list, folder notes, and folder files requests in parallel, fetch all to merge in frontend
            setFileLoading(true);
            Promise.all([
                new Promise<Folder[] | null>(resolve => handleFolderList(vault, currentPath, currentPathHash, resolve)),
                new Promise<{ list: Note[]; pager: { page: number; pageSize: number; totalRows: number } } | null>(resolve =>
                    handleFolderNotes(vault, currentPath, currentPathHash, 1, 99999, sortBy, sortOrder, resolve)
                ),
                new Promise<FileListResponse | null>(resolve =>
                    handleFolderFiles(vault, currentPath, currentPathHash, 1, 99999, sortBy, sortOrder, resolve)
                )
            ]).then(([folderData, noteData, fileData]) => {
                if (requestId !== noteRequestIdRef.current) return;
                setFolders(folderData || []);
                const notesList = noteData?.list || [];
                const filesList = fileData?.list || [];
                setNotes(notesList);
                setFiles(filesList);
                setTotalRows(notesList.length + filesList.length);
                setFilesTotalRows(filesList.length);
                setLoading(false);
                setFileLoading(false);
            });
        } else {
            handleNoteList(vault, currentPage, currentPageSize, keyword, isRecycle, searchMode, false, sortBy, sortOrder, (data) => {
                if (requestId !== noteRequestIdRef.current) return;

                let filteredList = data?.list || [];

                setNotes(filteredList);
                setTotalRows(data?.pager?.totalRows || 0);
                setLoading(false);
            });
        }
    };

    useEffect(() => {
        console.log("[NoteList] fetchNotes triggered:", { currentPath, currentPathHash });
        fetchNotes(page, pageSize, filePage, filePageSize, debouncedKeyword);
        setSelectedPaths(new Set()); // 清空选中
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vault, page, pageSize, filePage, filePageSize, debouncedKeyword, isRecycle, searchMode, sortBy, sortOrder, viewMode, currentPath, currentPathHash, shareFilter, shareFilterActiveDep]);

    useEffect(() => {
        if (debouncedKeyword) {
            setViewMode(filterType === "files" ? "flat-file" : "flat");
        }
        setPage(1);
        setFilePage(1);
    }, [debouncedKeyword, filterType, setPage, setViewMode]);

    useEffect(() => {
        if (isRecycle) {
            setViewMode("flat");
            if (searchMode === "content") {
                setSearchMode("path");
            }
        }
    }, [isRecycle, setViewMode, searchMode]);

    const handlePageChange = (newPage: number) => {
        const currentTotalRows = viewMode === "folder" ? mergedList.length : totalRows;
        if (newPage >= 1 && newPage <= Math.ceil(currentTotalRows / pageSize)) {
            setPage(newPage);
        }
    };

    const handleFilePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= Math.ceil(filesTotalRows / filePageSize)) {
            setFilePage(newPage);
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

    const onDeleteFolder = (e: React.MouseEvent, folder: Folder) => {
        e.stopPropagation();
        const title = folder.path.split("/").pop() || folder.path;

        setLoading(true);
        Promise.all([
            new Promise<Folder[] | null>(resolve => handleFolderList(vault, folder.path, folder.pathHash, resolve)),
            new Promise<{ list: Note[] } | null>(resolve =>
                handleFolderNotes(vault, folder.path, folder.pathHash, 1, 1, "mtime", "desc", resolve)
            ),
            new Promise<FileListResponse | null>(resolve =>
                handleFolderFiles(vault, folder.path, folder.pathHash, 1, 1, "mtime", "desc", resolve)
            )
        ]).then(([subfolders, noteData, fileData]) => {
            setLoading(false);
            const subfoldersList = subfolders || [];
            const notesList = noteData?.list || [];
            const filesList = fileData?.list || [];

            if (subfoldersList.length > 0 || notesList.length > 0 || filesList.length > 0) {
                openConfirmDialog(t("ui.note.deleteFolderNotEmpty"), "alert");
            } else {
                openConfirmDialog(t("ui.note.deleteFolderConfirm", { title }), "confirm", () => {
                    handleDeleteFolder(vault, folder.path, folder.pathHash, () => {
                        fetchNotes();
                    });
                });
            }
        }).catch(err => {
            setLoading(false);
            console.error(err);
        });
    };

    const validateName = (name: string, isPath: boolean = false): { isValid: boolean; reasonKey: string; params?: Record<string, unknown> } => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { isValid: false, reasonKey: "ui.validation.nameRequired" };
        }

        // 分隔出所有路径分段进行逐一校验
        const segments = isPath ? trimmed.split('/') : [trimmed];

        // Windows 禁用字符正则（如果 isPath 为 true，排除 '/'）
        const illegalCharRegex = isPath 
            ? /[\\:*?"<>|]/ 
            : /[\\/:*?"<>|]/;

        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

        for (const segment of segments) {
            const segTrimmed = segment.trim();
            if (!segTrimmed) {
                continue; // 忽略连续的斜杠
            }

            // 1. 长度限制 (NTFS/EXT4 单段最大 255 字符)
            if (segTrimmed.length > 255) {
                return { isValid: false, reasonKey: "ui.validation.nameTooLong" };
            }

            // 2. 非法字符限制
            if (illegalCharRegex.test(segTrimmed)) {
                return { isValid: false, reasonKey: "ui.validation.nameIllegalChars" };
            }

            // 3. 特殊段限制
            if (segTrimmed === "." || segTrimmed === "..") {
                return { isValid: false, reasonKey: "ui.validation.nameReservedDot" };
            }

            // 4. Windows 保留名称校验
            if (reservedNames.test(segTrimmed)) {
                return { isValid: false, reasonKey: "ui.validation.nameReservedWindows", params: { name: segTrimmed } };
            }

            // 5. 首尾空字符或点校验
            if (segment.startsWith(' ') || segment.endsWith(' ') || segment.startsWith('.') || segment.endsWith('.')) {
                return { isValid: false, reasonKey: "ui.validation.nameInvalidWrap" };
            }
        }

        return { isValid: true, reasonKey: "" };
    };

    const onCreateFolder = () => {
        let newFolderName = "";
        openConfirmDialog(
            t("ui.note.newFolder"),
            "confirm",
            () => {
                const trimmedName = newFolderName.trim();
                const validation = validateName(trimmedName, false);
                if (!validation.isValid) {
                    toast.error(t(validation.reasonKey, validation.params) as string);
                    return;
                }

                // 本地查重 / Local conflict check
                const nameLower = trimmedName.toLowerCase();
                const exists = folders.some(f => {
                    const lastSegment = f.path.split("/").pop() || f.path;
                    return lastSegment.toLowerCase() === nameLower;
                });

                if (exists) {
                    toast.error(t("ui.note.folderAlreadyExists", { name: trimmedName }));
                    return;
                }

                // 拼装完整路径 / Assemble full path
                const newPath = currentPath ? `${currentPath}/${trimmedName}` : trimmedName;

                handleCreateFolder(vault, newPath, () => {
                    fetchNotes();
                });
            },
            <div className="pt-2">
                <Input
                    autoFocus
                    placeholder={t("ui.note.folderNamePlaceholder")}
                    onChange={(e) => {
                        newFolderName = e.target.value;
                    }}
                />
            </div>
        );
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
    const onPermanentDelete = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        const title = note.path.replace(/\.md$/, "");
        openConfirmDialog(t("ui.note.permanentDeleteConfirm", { title }), "confirm", () => {
            handlePermanentDeleteNote(vault, note.path, note.pathHash, () => {
                fetchNotes();
            });
        });
    };

    /**
     * 重命名笔记并支持移动文件夹
     * Rename the note and support moving between folders
     */
    const onRename = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        
        // 提取扩展名与不含扩展名的完整相对路径
        // Extract file extension and the full relative path without extension
        const extension = note.path.includes(".") ? note.path.substring(note.path.lastIndexOf(".")) : ".md";
        const baseRelativePath = note.path.includes(".") ? note.path.substring(0, note.path.lastIndexOf(".")) : note.path;
        let newPath = baseRelativePath;

        openConfirmDialog(
            t("ui.note.renameNote"),
            "confirm",
            () => {
                if (!newPath || newPath === baseRelativePath) return;

                const trimmed = newPath.trim();
                const validation = validateName(trimmed, true);
                if (!validation.isValid) {
                    toast.error(t(validation.reasonKey, validation.params) as string);
                    return;
                }

                // 拼接新相对路径的扩展名
                // Combine the new relative path with its file extension
                const finalPath = trimmed.endsWith(extension) ? trimmed : trimmed + extension;

                handleRenameNote({
                    vault,
                    oldPath: note.path,
                    path: finalPath,
                    oldPathHash: note.pathHash
                }, () => {
                    fetchNotes();
                });
            },
            <div className="pt-2">
                <Input
                    autoFocus
                    defaultValue={baseRelativePath}
                    placeholder={t("ui.note.renameNotePlaceholder")}
                    onChange={(e) => {
                        newPath = e.target.value;
                    }}
                />
            </div>
        );
    };

    /**
     * 格式化文件大小 / Format file size
     */
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    /**
     * 重命名附件 / Rename attachment
     */
    const onRenameFile = (e: React.MouseEvent, file: FileDTO) => {
        e.stopPropagation();
        const fullFileName = file.path.split("/").pop() || "";
        const lastDotIndex = fullFileName.lastIndexOf(".");
        const extension = lastDotIndex !== -1 ? fullFileName.substring(lastDotIndex) : "";
        const baseName = lastDotIndex !== -1 ? fullFileName.substring(0, lastDotIndex) : fullFileName;
        let newName = baseName;

        openConfirmDialog(
            t("ui.file.renameFile"),
            "confirm",
            () => {
                if (!newName || newName === baseName) return;

                const trimmed = newName.trim();
                const validation = validateName(trimmed, false);
                if (!validation.isValid) {
                    toast.error(t(validation.reasonKey, validation.params) as string);
                    return;
                }

                const finalName = trimmed.endsWith(extension) ? trimmed : trimmed + extension;

                const oldDir = file.path.includes("/")
                    ? file.path.substring(0, file.path.lastIndexOf("/") + 1)
                    : "";

                handleRenameFile({
                    vault,
                    oldPath: file.path,
                    path: oldDir + finalName,
                    oldPathHash: file.pathHash
                }, () => {
                    fetchNotes();
                });
            },
            <div className="pt-2">
                <Input
                    autoFocus
                    defaultValue={baseName}
                    placeholder={t("ui.file.renameFilePlaceholder")}
                    onChange={(e) => {
                        newName = e.target.value;
                    }}
                />
            </div>
        );
    };

    /**
     * 删除附件 / Delete attachment
     */
    const onDeleteFile = (e: React.MouseEvent, file: FileDTO) => {
        e.stopPropagation();
        openConfirmDialog(t("ui.file.deleteFileConfirm", { title: file.path }), "confirm", () => {
            handleDeleteFile(vault, file.path, file.pathHash, () => {
                fetchNotes();
            });
        });
    };

    /**
     * 处理附件点击 (预览或下载) / Handle attachment click (preview or download)
     */
    const handleFileClick = (file: FileDTO) => {
        let url = getRawFileUrl(vault, file.path, file.pathHash?.toString());
        if (isRecycle) {
            url += (url.includes("?") ? "&" : "?") + "isRecycle=1";
        }
        setPreviewFile(file);
        setPreviewUrl(url);
    };

    /**
     * 根据文件后缀获取对应的图标 / Get icon by file extension
     */
    const getFileIcon = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase() || '';

        // 图片类型 / Image types
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
            return <Image className="h-5 w-5" />;
        }
        // PDF 类型 / PDF types
        if (ext === 'pdf') {
            return <FileText className="h-5 w-5" />;
        }
        // 音频类型 / Audio types
        if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
            return <Music className="h-5 w-5" />;
        }
        // 视频类型 / Video types
        if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) {
            return <Video className="h-5 w-5" />;
        }
        // 脚本/代码类型 / Script and Code types
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'sh', 'bat', 'go', 'css', 'html', 'json', 'c', 'cpp', 'rs', 'php'].includes(ext)) {
            return <FileCode className="h-5 w-5" />;
        }

        // 默认类型 / Default types
        return <Paperclip className="h-5 w-5" />;
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
            const total = selectedNotes.length;

            try {
                for (let i = 0; i < selectedNotes.length; i++) {
                    setBatchRestoreProgress({ current: i + 1, total });
                    await Promise.race([
                        new Promise<void>((resolve) => {
                            handleRestoreNote(vault, selectedNotes[i].path, selectedNotes[i].pathHash, resolve);
                        }),
                        new Promise<void>((resolve) => setTimeout(resolve, 30000)),
                    ]);
                }
            } finally {
                setBatchRestoreProgress(null);
                setSelectedPaths(new Set());
                fetchNotes();
            }
        });
    };

    const onBatchPermanentDelete = () => {
        if (selectedPaths.size === 0) return;

        openConfirmDialog(t("ui.common.batchPermanentDeleteConfirm", { count: selectedPaths.size }), "confirm", async () => {
            setLoading(true);
            const selectedNotes = notes.filter(n => selectedPaths.has(n.pathHash));
            const total = selectedNotes.length;

            try {
                for (let i = 0; i < selectedNotes.length; i++) {
                    setBatchRestoreProgress({ current: i + 1, total });
                    await Promise.race([
                        new Promise<void>((resolve) => {
                            handlePermanentDeleteNote(vault, selectedNotes[i].path, selectedNotes[i].pathHash, resolve);
                        }),
                        new Promise<void>((resolve) => setTimeout(resolve, 30000)),
                    ]);
                }
            } finally {
                setBatchRestoreProgress(null);
                setSelectedPaths(new Set());
                fetchNotes();
            }
        });
    };

    const onClearRecycleBin = () => {
        openConfirmDialog(t("ui.note.clearRecycleConfirm"), "confirm", () => {
            handleClearNoteRecycle(vault, () => {
                fetchNotes();
            });
        });
    };

    // 合并并排序的混合列表项
    // Merged and sorted list of notes and attachments
    const mergedList = useMemo(() => {
        if (viewMode !== "folder" || isRecycle) return [];

        const noteItems = notes.map(n => ({
            type: "note" as const,
            id: `note-${n.pathHash}`,
            pathHash: n.pathHash,
            mtime: n.mtime,
            ctime: n.ctime,
            path: n.path,
            data: n
        }));
        const fileItems = files.map(f => ({
            type: "file" as const,
            id: `file-${f.pathHash}`,
            pathHash: f.pathHash,
            mtime: f.mtime,
            ctime: f.ctime,
            path: f.path,
            data: f
        }));

        let combined = [...noteItems, ...fileItems];

        // 排序逻辑 / Sorting logic
        combined.sort((a, b) => {
            let valA: string | number = a[sortBy];
            let valB: string | number = b[sortBy];

            if (sortBy === "path") {
                valA = a.path.toLowerCase();
                valB = b.path.toLowerCase();
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return combined;
    }, [notes, files, viewMode, isRecycle, sortBy, sortOrder]);

    // 计算融合后列表的总记录数，用于在当前目录下过滤时的统一分页
    const displayTotalRows = viewMode === "folder" ? mergedList.length : totalRows;

    // 对融合后的列表做前端切片分页 / Frontend pagination for the merged list
    const paginatedItems = useMemo(() => {
        if (viewMode !== "folder" || isRecycle) return [];
        return mergedList.slice((page - 1) * pageSize, page * pageSize);
    }, [mergedList, viewMode, isRecycle, page, pageSize]);



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
                    {!isRecycle && (
                        <Button
                            variant={shareFilter === 'active' ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-xl text-xs h-8"
                            onClick={() => {
                                const next = shareFilter === 'active' ? null : 'active';
                                setShareFilter(next);
                                if (next) {
                                    setPage(1);
                                    setViewMode("flat");
                                }
                            }}
                        >
                            <Share2 className="h-3 w-3 mr-1" />
                            {t("ui.share.tabActive")} ({activeShareCount})
                        </Button>
                    )}
                </div>

                {/* 右侧：搜索和操作 */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                type="text"
                                placeholder={filterType === "files" ? t("ui.file.searchPlaceholder") : t("ui.note.searchPlaceholder")}
                                className="pl-9 pr-14 rounded-xl"
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
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors">
                                            {searchMode === "path" && <FolderSearch className="h-3.5 w-3.5" />}
                                            {searchMode === "content" && <NotepadText className="h-3.5 w-3.5" />}

                                            <ChevronDown className="h-3 w-3" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl min-w-40 p-1.5 space-y-1">
                                        {/* 第一组：搜索模式 */}
                                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider select-none">
                                            {t("ui.note.searchModeLabel", "搜索模式")}
                                        </div>
                                        <DropdownMenuItem
                                            onClick={() => setSearchMode("path")}
                                            className={`rounded-lg flex items-center justify-between text-xs sm:text-sm ${searchMode === "path" ? "bg-accent text-accent-foreground font-medium" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FolderSearch className="h-4 w-4" />
                                                <span>{t("ui.note.searchPath")}</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setSearchMode("content")}
                                            disabled={filterType === "files" || isRecycle}
                                            className={`rounded-lg flex items-center justify-between text-xs sm:text-sm ${searchMode === "content" ? "bg-accent text-accent-foreground font-medium" : ""} ${(filterType === "files" || isRecycle) ? "opacity-40" : ""}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <NotepadText className="h-4 w-4" />
                                                <span>{t("ui.note.searchContentMode")}</span>
                                            </div>
                                        </DropdownMenuItem>

                                        <div className="h-px bg-border my-1" />

                                        {/* 第二组：限制类型 */}
                                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider select-none">
                                            {t("ui.note.searchTypeLimit", "限制类型")}
                                        </div>

                                        <DropdownMenuItem
                                            onClick={() => setFilterType("notes")}
                                            className={`rounded-lg flex items-center justify-between text-xs sm:text-sm ${filterType === "notes" ? "bg-accent text-accent-foreground font-medium" : ""}`}
                                        >
                                            <span>{t("ui.note.note", "仅看笔记")}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setFilterType("files")}
                                            disabled={searchMode === "content"}
                                            className={`rounded-lg flex items-center justify-between text-xs sm:text-sm ${filterType === "files" ? "bg-accent text-accent-foreground font-medium" : ""} ${searchMode === "content" ? "opacity-40" : ""}`}
                                        >
                                            <span>{t("ui.file.file", "仅看附件")}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={t("ui.common.refresh")}
                            onClick={() => fetchNotes()}
                            disabled={loading}
                            className="rounded-xl shrink-0"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {!isRecycle && (
                            <>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={onFileChange}
                                    style={{ display: "none" }}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="rounded-xl shrink-0"
                                >
                                    <Upload className={`h-4 w-4 sm:mr-2 ${uploading ? "animate-bounce" : ""}`} />
                                    <span className="hidden sm:inline">
                                        {uploading ? t("ui.file.uploading", "上传中...") : t("ui.file.upload", "上传附件")}
                                    </span>
                                </Button>
                                {viewMode === "folder" && (
                                    <Button onClick={onCreateFolder} variant="outline" className="rounded-xl shrink-0">
                                        <FolderPlus className="h-4 w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">{t("ui.note.newFolder")}</span>
                                    </Button>
                                )}
                                <Button onClick={onCreateNote} className="rounded-xl shrink-0">
                                    <Plus className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">{t("ui.note.newNote")}</span>
                                </Button>
                            </>
                        )}
                    </div>

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
                                    setShareFilter(null);
                                }}
                            >
                                {t("ui.note.viewFolder")}
                            </button>
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors border-l border-border ${viewMode === 'flat' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                    setViewMode("flat");
                                    setShareFilter(null);
                                }}
                            >
                                {t("ui.note.viewFlatNotes")}
                            </button>
                            <button
                                className={`px-4 h-full text-xs font-medium transition-colors border-l border-border ${viewMode === 'flat-file' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                    setViewMode("flat-file");
                                    setShareFilter(null);
                                }}
                            >
                                {t("ui.note.viewFlatFiles")}
                            </button>
                            {!isMobile && (
                                <button
                                    className={`px-4 h-full text-xs font-medium transition-colors border-l border-border inline-flex items-center gap-1.5 ${viewMode === 'workspace' ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                    onClick={() => {
                                        setSearchKeyword("");
                                        setDebouncedKeyword("");
                                        setViewMode("workspace");
                                        setShareFilter(null);
                                    }}
                                >
                                    <FolderTree className="h-3.5 w-3.5" />
                                    {t("ui.note.viewWorkspace")}
                                </button>
                            )}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                            {viewMode === 'flat-file' ? (
                                `${filesTotalRows} ${t("ui.file.file")}`
                            ) : viewMode === 'workspace' ? (
                                t("ui.note.documentTree")
                            ) : viewMode === 'folder' ? (
                                `${totalRows} ${t("ui.note.note")} / ${filesTotalRows} ${t("ui.file.file")}`
                            ) : (
                                `${totalRows} ${t("ui.note.note")}`
                            )}
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
                            <NotepadText className="h-3.5 w-3.5" />
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
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 py-2 px-2 bg-muted/30 rounded-xl border border-border/50">
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
                        {notes.length > 0 && (
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
                    {notes.length > 0 && (
                        <div className="flex items-center gap-3 pl-0 sm:pl-4 border-l-0 sm:border-l border-border/60">
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
                            <NotepadText className="h-3.5 w-3.5" />
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

            {/* 启用拖拽上下文包裹面包屑导航与列表 */}
            {/* Enable Drag & Drop context wrapping breadcrumbs and lists */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                {/* 面包屑导航 - 仅在目录模式且无分享筛选时显示 */}
                {/* Breadcrumbs navigation - only displayed in folder mode without active share filter */}
                {viewMode === "folder" && !isRecycle && currentPath && !shareFilter && (
                    <div 
                        // 面包屑容器使用 py-2 提供变大安全区域，使用 mb-4 拉开下部间距，并使用 z-30 提供层级保护
                        // Breadcrumbs wrapper uses py-2 for scale breathing room, mb-4 for visual gap, and z-30 for layout layering
                        className="flex items-center gap-2 px-1.5 py-2 mb-4 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide relative z-30"
                    >
                        {/* 笔记库根目录，包装为 Droppable 容器以接受拖放移动到根目录 */}
                        {/* Vault root folder, wrapped as a droppable container to accept dropping to move to root */}
                        <DroppableBreadcrumbButton path="" className="flex items-center gap-1">
                            <button
                                className="hover:text-primary transition-colors flex items-center gap-1 text-xs sm:text-sm"
                                onClick={() => {
                                    setCurrentPath("");
                                    setCurrentPathHash("");
                                    setPage(1);
                                    setFilePage(1);
                                }}
                            >
                                <Library className="h-4 w-4 shrink-0 mr-1" />
                                <span>{vault}</span>
                            </button>
                        </DroppableBreadcrumbButton>
                        {currentPath.split("/").filter(Boolean).map((part, index, arr) => (
                            <React.Fragment key={`breadcrumb-${index}`}>
                                <ChevronRight className="h-4 w-4 shrink-0" />
                                {index === arr.length - 1 ? (
                                    /* 最后一级为当前文件夹目录，采用对应的 px-2 py-0.5 以确保与前几级节点基线和高度绝对对齐 */
                                    /* The last level is the current folder directory. Adopt matching px-2 py-0.5 to keep baseline and heights strictly aligned */
                                    <span className="px-2 py-0.5 text-foreground font-medium text-xs sm:text-sm select-none">
                                        {part}
                                    </span>
                                ) : (
                                    /* 上级子目录，包装为 Droppable 容器以接受拖动移动到该目录下 */
                                    /* Parent subfolders, wrapped as a droppable container to accept dropping to move under this folder */
                                    <DroppableBreadcrumbButton path={arr.slice(0, index + 1).join("/")}>
                                        <button
                                            className="hover:text-primary transition-colors flex items-center text-xs sm:text-sm"
                                            onClick={() => {
                                                const path = arr.slice(0, index + 1).join("/");
                                                setCurrentPath(path);
                                                setCurrentPathHash(pathHashMap[path] || "");
                                                setPage(1);
                                                setFilePage(1);
                                            }}
                                        >
                                            {part}
                                        </button>
                                    </DroppableBreadcrumbButton>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* 统一的数据加载占位符 */}
                {/* Unified loading skeleton */}
                {(loading || fileLoading) ? (
                    <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        {batchRestoreProgress
                            ? `${batchRestoreProgress.current} / ${batchRestoreProgress.total}`
                            : t("ui.common.loading")}
                    </div>
                ) : (
                    <div className="-mx-2 px-2 relative z-10 space-y-6">
                        {/* 1. 目录浏览视图 */}
                        {/* 1. Folder view mode */}
                        {viewMode === "folder" && !isRecycle && (
                            <>
                                {(!Array.isArray(folders) || folders.length === 0) &&
                                 (!Array.isArray(notes) || notes.length === 0) &&
                                 (!Array.isArray(files) || files.length === 0) ? (
                                    <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                                        {t("ui.common.noData")}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {/* 子目录块 */}
                                        {Array.isArray(folders) && folders.length > 0 && (
                                            <div className="grid grid-cols-1 gap-3">
                                                {folders.map((folder) => (
                                                    <DroppableFolderCard key={`folder-droppable-${folder.pathHash}`} folder={folder}>
                                                        <article
                                                            className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
                                                            onClick={() => {
                                                                setPathHashMap({ ...pathHashMap, [folder.path]: folder.pathHash });
                                                                setCurrentPath(folder.path);
                                                                setCurrentPathHash(folder.pathHash);
                                                                setPage(1);
                                                                setFilePage(1);
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
                                                                <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-destructive"
                                                                        onClick={(e) => onDeleteFolder(e, folder)}
                                                                        aria-label={t("ui.common.delete")}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                                </div>
                                                            </div>
                                                        </article>
                                                    </DroppableFolderCard>
                                                ))}
                                            </div>
                                        )}

                                        {/* 融合后的笔记与附件列表区块 */}
                                        {Array.isArray(paginatedItems) && paginatedItems.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {paginatedItems.map((item) => {
                                                        if (item.type === "note") {
                                                            const note = item.data;
                                                            const noteIsShared = activeSharePaths.has(note.path);
                                                            const cardContent = (
                                                                <article
                                                                    className="rounded-xl border border-border bg-card p-2.5 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 w-full"
                                                                    onClick={() => onSelectNote(note, true)}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                            <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                                                                <NotepadText className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                            </span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <h3 className="font-semibold text-card-foreground truncate flex items-center gap-1">
                                                                                    <span className="truncate">{note.path.split("/").pop()?.replace(/\.md$/, "")}</span>
                                                                                    {noteIsShared && <Share2 className="h-3 w-3 text-green-500 shrink-0" />}
                                                                                </h3>
                                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                                                    <span className="hidden sm:flex items-center gap-1">
                                                                                        <Calendar className="h-3.5 w-3.5" />
                                                                                        {format(new Date(note.ctime), "yyyy-MM-dd HH:mm")}
                                                                                    </span>
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Clock className="h-3.5 w-3.5" />
                                                                                        <span className="hidden sm:inline">{format(new Date(note.mtime), "yyyy-MM-dd HH:mm")}</span>
                                                                                        <span className="sm:hidden">{format(new Date(note.mtime), "MM-dd HH:mm")}</span>
                                                                                    </span>
                                                                                    {note.version > 0 && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <History className="h-3.5 w-3.5" />
                                                                                            v{note.version}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-primary" onClick={() => onSelectNote(note, true)}><Eye className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-600" onClick={() => onSelectNote(note, false)}><Pencil className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-purple-600" onClick={() => onViewHistory(note)}><History className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-500" onClick={(e) => onRename(e, note)}><TextCursorInput className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl ${noteIsShared ? "text-green-600 hover:text-green-700 bg-green-500/10" : "text-muted-foreground hover:text-primary"}`} onClick={() => { setSelectedShareNote(note); setShareModalOpen(true); }}><Share2 className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={(e) => onDelete(e, note)}><Trash2 className="h-4 w-4" /></Button>
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            );
                                                            return (
                                                                <DraggableNoteCard key={`note-draggable-${note.pathHash}`} note={note}>
                                                                    {cardContent}
                                                                </DraggableNoteCard>
                                                            );
                                                        } else {
                                                            const file = item.data;
                                                            const cardContent = (
                                                                <article
                                                                    className="rounded-xl border border-border bg-card p-2.5 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 w-full"
                                                                    onClick={() => handleFileClick(file)}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                            <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                                                                {getFileIcon(file.path)}
                                                                            </span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <h3 className="font-semibold text-card-foreground truncate flex items-center gap-1.5">
                                                                                    <span className="truncate">{file.path.split("/").pop()}</span>
                                                                                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                                </h3>
                                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                                                    <span>{formatFileSize(file.size)}</span>
                                                                                    <span className="hidden sm:flex items-center gap-1">
                                                                                        <Calendar className="h-3.5 w-3.5" />
                                                                                        {format(new Date(file.ctime), "yyyy-MM-dd HH:mm")}
                                                                                    </span>
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Clock className="h-3.5 w-3.5" />
                                                                                        {format(new Date(file.mtime), "yyyy-MM-dd HH:mm")}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-500" onClick={(e) => onRenameFile(e, file)}><TextCursorInput className="h-4 w-4" /></Button>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={(e) => onDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button>
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            );
                                                            return (
                                                                <DraggableFileCard key={`file-draggable-${file.pathHash}`} file={file}>
                                                                    {cardContent}
                                                                </DraggableFileCard>
                                                            );
                                                        }
                                                    })}
                                                </div>
                                                {/* 融合列表统一分页 */}
                                                {Math.ceil(displayTotalRows / pageSize) > 1 && (
                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="rounded-xl h-8 px-2"><ChevronLeft className="h-4 w-4" /></Button>
                                                        <span className="text-xs font-medium flex items-center px-1">{page} / {Math.ceil(displayTotalRows / pageSize)}</span>
                                                        <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page === Math.ceil(displayTotalRows / pageSize)} className="rounded-xl h-8 px-2"><ChevronRight className="h-4 w-4" /></Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* 2. 笔记平铺浏览视图 */}
                        {/* 2. Flat Notes view mode */}
                        {viewMode === "flat" && (
                            <>
                                {(!Array.isArray(notes) || notes.length === 0) ? (
                                    <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                                        {t("ui.note.noNotes")}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-1 gap-3">
                                            {notes.map((note) => {
                                                const noteIsShared = !isRecycle && activeSharePaths.has(note.path);
                                                const cardContent = (
                                                    <article
                                                        key={`note-${note.pathHash}`}
                                                        className="rounded-xl border border-border bg-card p-2.5 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 w-full"
                                                        onClick={() => onSelectNote(note, true)}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 sm:gap-4">
                                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                {isRecycle && (
                                                                    <div className="flex items-center self-center" onClick={(e) => toggleSelect(e, note.pathHash)}>
                                                                        <Checkbox checked={selectedPaths.has(note.pathHash)} className="rounded-md" />
                                                                    </div>
                                                                )}
                                                                <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                                                    <NotepadText className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                </span>
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className="font-semibold text-card-foreground truncate flex items-center gap-1">
                                                                        <span className="truncate">{note.path.replace(/\.md$/, "")}</span>
                                                                        {noteIsShared && <Share2 className="h-3 w-3 text-green-500 shrink-0" />}
                                                                    </h3>
                                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                                        <span className="hidden sm:flex items-center gap-1">
                                                                            <Calendar className="h-3.5 w-3.5" />
                                                                            {format(new Date(note.ctime), "yyyy-MM-dd HH:mm")}
                                                                        </span>
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock className="h-3.5 w-3.5" />
                                                                            <span className="hidden sm:inline">{format(new Date(note.mtime), "yyyy-MM-dd HH:mm")}</span>
                                                                            <span className="sm:hidden">{format(new Date(note.mtime), "MM-dd HH:mm")}</span>
                                                                        </span>
                                                                        {note.version > 0 && (
                                                                            <span className="flex items-center gap-1">
                                                                                <History className="h-3.5 w-3.5" />
                                                                                v{note.version}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onSelectNote(note, true); }}><Eye className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-600" onClick={(e) => { e.stopPropagation(); onSelectNote(note, false); }}><Pencil className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-purple-600" onClick={(e) => { e.stopPropagation(); onViewHistory(note); }}><History className="h-4 w-4" /></Button>
                                                                {!isRecycle && <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-500" onClick={(e) => onRename(e, note)}><TextCursorInput className="h-4 w-4" /></Button>}
                                                                {!isRecycle && <Button variant="ghost" size="icon" className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl ${noteIsShared ? "text-green-600 hover:text-green-700 bg-green-500/10" : "text-muted-foreground hover:text-primary"}`} onClick={(e) => { e.stopPropagation(); setSelectedShareNote(note); setShareModalOpen(true); }}><Share2 className="h-4 w-4" /></Button>}
                                                                {!isRecycle && <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={(e) => onDelete(e, note)}><Trash2 className="h-4 w-4" /></Button>}
                                                                {isRecycle && (
                                                                    <>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-green-600" onClick={(e) => onRestore(e, note)}><RotateCcw className="h-4 w-4" /></Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={(e) => onPermanentDelete(e, note)}><Trash2 className="h-4 w-4" /></Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </article>
                                                );
                                                return isRecycle ? (
                                                    <React.Fragment key={`note-${note.pathHash}`}>
                                                        {cardContent}
                                                    </React.Fragment>
                                                ) : (
                                                    <DraggableNoteCard key={`note-draggable-${note.pathHash}`} note={note}>
                                                        {cardContent}
                                                    </DraggableNoteCard>
                                                );
                                            })}
                                        </div>

                                        {/* 全局笔记分页 */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 pt-2 shrink-0">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span className="whitespace-nowrap">{t("ui.common.of")} {totalRows} {t("ui.note.results")}</span>
                                                <Select value={pageSize.toString()} onValueChange={(val) => {
                                                    setPageSize(parseInt(val));
                                                    setPage(1);
                                                }}>
                                                    <SelectTrigger className="h-8 min-w-25 rounded-xl"><SelectValue placeholder={pageSize.toString()} /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {[10, 20, 50, 100].map((size) => (
                                                            <SelectItem key={size} value={size.toString()} className="rounded-xl">{size} {t("ui.common.perPage")}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1 || loading} className="rounded-xl"><ChevronLeft className="h-4 w-4" />{t("ui.common.previous")}</Button>
                                                <span className="text-sm font-medium px-2">{page} / {Math.ceil(totalRows / pageSize)}</span>
                                                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page === Math.ceil(totalRows / pageSize) || loading} className="rounded-xl">{t("ui.common.next")}<ChevronRight className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 3. 附件平铺浏览视图 */}
                        {/* 3. Flat Attachments view mode */}
                        {viewMode === "flat-file" && (
                            <>
                                {(!Array.isArray(files) || files.length === 0) ? (
                                    <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                                        {t("ui.file.noFiles")}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-1 gap-3">
                                            {files.map((file) => (
                                                <article
                                                    key={`file-${file.pathHash}`}
                                                    className="rounded-xl border border-border bg-card p-2.5 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 w-full"
                                                    onClick={() => handleFileClick(file)}
                                                >
                                                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                                            {isRecycle && (
                                                                <div className="flex items-center self-center" onClick={(e) => e.stopPropagation()}>
                                                                    <Checkbox checked={selectedPaths.has(file.pathHash)} className="rounded-md" />
                                                                </div>
                                                            )}
                                                            <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                                                {getFileIcon(file.path)}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="font-semibold text-card-foreground truncate flex items-center gap-1.5">
                                                                    <span className="truncate">{file.path}</span>
                                                                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                </h3>
                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                                    <span>{formatFileSize(file.size)}</span>
                                                                    <span className="hidden sm:flex items-center gap-1">
                                                                        <Calendar className="h-3.5 w-3.5" />
                                                                        {format(new Date(file.ctime), "yyyy-MM-dd HH:mm")}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        {format(new Date(file.mtime), "yyyy-MM-dd HH:mm")}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {!isRecycle && <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-blue-500" onClick={(e) => onRenameFile(e, file)}><TextCursorInput className="h-4 w-4" /></Button>}
                                                            {!isRecycle && <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground hover:text-destructive" onClick={(e) => onDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button>}
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>

                                        {/* 全局附件分页 */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 pt-2 shrink-0">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{t("ui.common.of")} {filesTotalRows} {t("ui.file.results")}</span>
                                                <Select value={filePageSize.toString()} onValueChange={(val) => {
                                                    setFilePageSize(parseInt(val));
                                                    setFilePage(1);
                                                }}>
                                                    <SelectTrigger className="h-8 w-25 rounded-xl"><SelectValue placeholder={filePageSize.toString()} /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {[10, 20, 50, 100].map((size) => (
                                                            <SelectItem key={size} value={size.toString()} className="rounded-xl">{size} {t("ui.common.perPage")}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleFilePageChange(filePage - 1)} disabled={filePage === 1 || fileLoading} className="rounded-xl"><ChevronLeft className="h-4 w-4" />{t("ui.common.previous")}</Button>
                                                <span className="text-sm font-medium px-2">{filePage} / {Math.ceil(filesTotalRows / filePageSize)}</span>
                                                <Button variant="outline" size="sm" onClick={() => handleFilePageChange(filePage + 1)} disabled={filePage === Math.ceil(filesTotalRows / filePageSize) || fileLoading} className="rounded-xl">{t("ui.common.next")}<ChevronRight className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </DndContext>

            {selectedShareNote && (
                <ShareModal
                    vault={vault}
                    path={selectedShareNote.path}
                    pathHash={selectedShareNote.pathHash}
                    open={shareModalOpen}
                    onOpenChange={setShareModalOpen}
                    onShareChange={refreshShareItems}
                />
            )}

            {/* 附件预览组件 / Attachment preview modal */}
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
