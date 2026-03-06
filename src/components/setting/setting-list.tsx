import { ListTree, Plus, RefreshCw, Search, X, Pencil, Trash2, TextCursorInput, Clock, ChevronLeft, ChevronRight, FileCode, FileJson, FileType, FileText, Image as ImageIcon, FileBox } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useSettingHandle } from "@/components/api-handle/setting-handle";
import { useState, useEffect, useCallback, useMemo } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { Tooltip } from "@/components/ui/tooltip";
import { SettingItem } from "@/lib/types/setting";
import { Button } from "@/components/ui/button";
import CodeMirror from "@uiw/react-codemirror";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { EditorView } from "@codemirror/view";
import { format } from "date-fns";


interface SettingListProps {
    vault: string;
    vaults: VaultType[];
    onVaultChange: (vault: string) => void;
}

export function SettingList({ vault, vaults, onVaultChange }: SettingListProps) {
    const { t } = useTranslation();
    const { handleSettingList, handleSaveSetting, handleDeleteSetting, handleRenameSetting } = useSettingHandle();
    const { openConfirmDialog } = useConfirmDialog();

    const [settings, setSettings] = useState<SettingItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");

    // 分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const pageSize = 24;

    const fetchSettings = useCallback(() => {
        if (!vault) return;
        setLoading(true);
        handleSettingList(vault, (data) => {
            setSettings(data.list || []);
            setTotalItems(data.pager?.totalRows || 0);
            setLoading(false);
        }, () => {
            setLoading(false);
        }, searchKeyword, currentPage, pageSize);
    }, [handleSettingList, vault, searchKeyword, currentPage]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const filteredSettings = settings;

    const getLanguageExtension = (_path: string) => {
        // 使用已有的 markdown 扩展，它对于 json/js 也提供不错的基础支持
        return [markdown()];
    };

    const onAdd = () => {
        let path = "";
        let content = "";

        const EditorWrapper = ({ initialPath }: { initialPath: string }) => {
            const [currentPath, setCurrentPath] = useState(initialPath);
            const extensions = useMemo(() => getLanguageExtension(currentPath), [currentPath]);

            return (
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("ui.settingsBrowser.key")}</label>
                        <Input
                            autoFocus
                            placeholder="e.g. system/config.json"
                            onChange={(e) => {
                                path = e.target.value;
                                setCurrentPath(e.target.value);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("ui.settingsBrowser.value")}</label>
                        <div className="border border-border rounded-xl overflow-hidden min-h-[300px] focus-within:ring-2 focus-within:ring-primary/20">
                            <CodeMirror
                                height="300px"
                                theme="dark"
                                extensions={[...extensions, EditorView.lineWrapping]}
                                onChange={(value) => { content = value; }}
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: true,
                                    allowMultipleSelections: true,
                                    indentOnInput: true,
                                    bracketMatching: true,
                                    closeBrackets: true,
                                    highlightActiveLine: true,
                                }}
                            />
                        </div>
                    </div>
                </div>
            );
        };

        openConfirmDialog(
            t("ui.settingsBrowser.add"),
            "confirm",
            () => {
                if (!path) return;
                handleSaveSetting(vault, { path, content }, fetchSettings);
            },
            <EditorWrapper initialPath="" />,
            "max-w-3xl"
        );
    };

    const onEdit = (item: SettingItem) => {
        let content = item.content;
        const extensions = getLanguageExtension(item.path);

        openConfirmDialog(
            t("ui.settingsBrowser.edit") + ": " + item.path,
            "confirm",
            () => {
                handleSaveSetting(vault, { ...item, content }, fetchSettings);
            },
            <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">{t("ui.settingsBrowser.value")}</label>
                <div className="border border-border rounded-xl overflow-hidden min-h-[450px] focus-within:ring-2 focus-within:ring-primary/20">
                    <CodeMirror
                        autoFocus
                        value={item.content}
                        height="450px"
                        theme="dark"
                        extensions={[...extensions, EditorView.lineWrapping]}
                        onChange={(value) => { content = value; }}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            dropCursor: true,
                            allowMultipleSelections: true,
                            indentOnInput: true,
                            bracketMatching: true,
                            closeBrackets: true,
                            highlightActiveLine: true,
                        }}
                    />
                </div>
            </div>,
            "max-w-4xl"
        );
    };

    const onRename = (item: SettingItem) => {
        let newPath = item.path;
        openConfirmDialog(
            t("ui.settingsBrowser.rename"),
            "confirm",
            () => {
                if (!newPath || newPath === item.path) return;
                handleRenameSetting(vault, item.path, newPath, item.pathHash, fetchSettings);
            },
            <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">{t("ui.settingsBrowser.newKey")}</label>
                <Input
                    autoFocus
                    defaultValue={item.path}
                    onChange={(e) => { newPath = e.target.value; }}
                />
            </div>
        );
    };

    const onDelete = (item: SettingItem) => {
        openConfirmDialog(
            t("ui.settingsBrowser.confirmDelete", { key: item.path }),
            "confirm",
            () => {
                handleDeleteSetting(vault, item.path, item.pathHash, fetchSettings);
            }
        );
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    return (
        <div className="w-full flex flex-col space-y-2">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-0">
                <div className="flex items-center gap-3">
                    <ListTree className="h-5 w-5 text-primary" />
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
                    <span className="text-sm font-medium text-muted-foreground ml-2">
                        {totalItems} {t("ui.common.items")}
                    </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            type="text"
                            placeholder={t("ui.common.search")}
                            className="pl-9 pr-10 rounded-xl"
                            value={searchKeyword}
                            onChange={(e) => {
                                setSearchKeyword(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                        {searchKeyword && (
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => {
                                    setSearchKeyword("");
                                    setCurrentPage(1);
                                }}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchSettings}
                        disabled={loading}
                        className="rounded-xl shrink-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={onAdd} className="rounded-xl shrink-0">
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t("ui.common.add")}</span>
                    </Button>
                </div>
            </div>

            {/* List Content */}
            {loading && settings.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    {t("ui.common.loading")}
                </div>
            ) : filteredSettings.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    {t("ui.settingsBrowser.noSettings")}
                </div>
            ) : (
                <>
                    {/* Row Layout List */}
                    <div className="flex flex-col border border-border/50 rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
                        {filteredSettings.map((item, index) => {
                            const pathParts = item.path.split('/');
                            const fileName = pathParts.pop() || "";
                            const dirPath = pathParts.join('/');

                            const getFileIcon = (name: string) => {
                                const ext = name.split('.').pop()?.toLowerCase();
                                switch (ext) {
                                    case 'json':
                                        return <FileJson className="h-4 w-4 text-orange-500/70" />;
                                    case 'js':
                                    case 'ts':
                                    case 'jsx':
                                    case 'tsx':
                                        return <FileCode className="h-4 w-4 text-blue-500/70" />;
                                    case 'css':
                                    case 'scss':
                                    case 'less':
                                        return <FileType className="h-4 w-4 text-pink-500/70" />;
                                    case 'md':
                                    case 'txt':
                                        return <FileText className="h-4 w-4 text-emerald-500/70" />;
                                    case 'yml':
                                    case 'yaml':
                                        return <FileBox className="h-4 w-4 text-purple-500/70" />;
                                    case 'png':
                                    case 'jpg':
                                    case 'jpeg':
                                    case 'gif':
                                    case 'svg':
                                    case 'webp':
                                        return <ImageIcon className="h-4 w-4 text-indigo-500/70" />;
                                    default:
                                        return <FileText className="h-4 w-4 text-primary/70" />;
                                }
                            };

                            return (
                                <div
                                    key={item.pathHash || item.path}
                                    className={`group flex items-center justify-between px-4 py-3 transition-all duration-200 hover:bg-muted/40 ${
                                        index !== filteredSettings.length - 1 ? "border-b border-border/40" : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            {getFileIcon(fileName)}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex flex-wrap items-center gap-x-1 text-sm">
                                                {dirPath && (
                                                    <span className="text-muted-foreground/85">
                                                        {dirPath}/
                                                    </span>
                                                )}
                                                <span className="font-semibold text-foreground break-all">
                                                    {fileName}
                                                </span>
                                            </div>
                                            {(item.updatedAt || item.createdAt) && (
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(item.updatedAt || item.createdAt || ""), "yyyy-MM-dd HH:mm")}
                                                    </div>
                                                    {item.content && (
                                                        <div className="hidden md:flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-muted/30 text-[9px] uppercase tracking-wider">
                                                           {item.content.length} chars
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 ml-4 shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                                        <Tooltip content={t("ui.settingsBrowser.rename")} side="top">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                                onClick={() => onRename(item)}
                                            >
                                                <TextCursorInput className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content={t("ui.common.edit")} side="top">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                                onClick={() => onEdit(item)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content={t("ui.common.delete")} side="top">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => onDelete(item)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controller */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <div className="flex items-center gap-1 px-2">
                                <span className="text-sm font-medium">{currentPage}</span>
                                <span className="text-sm text-muted-foreground">/</span>
                                <span className="text-sm text-muted-foreground">{totalPages}</span>
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                                disabled={currentPage === totalPages || loading}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
