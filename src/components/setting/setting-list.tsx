import { Settings, Plus, RefreshCw, Search, X, Pencil, Trash2, TextCursorInput, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useSettingHandle } from "@/components/api-handle/setting-handle";
import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { SettingItem } from "@/lib/types/setting";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
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

    const onAdd = () => {
        let path = "";
        let content = "";
        openConfirmDialog(
            t("ui.settingsBrowser.add"),
            "confirm",
            () => {
                if (!path) return;
                handleSaveSetting(vault, { path, content }, fetchSettings);
            },
            <div className="space-y-4 pt-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t("ui.settingsBrowser.key")}</label>
                    <Input
                        autoFocus
                        placeholder="e.g. system/name"
                        onChange={(e) => { path = e.target.value; }}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t("ui.settingsBrowser.value")}</label>
                    <Textarea
                        placeholder="e.g. My System"
                        className="min-h-[200px] font-mono text-base"
                        onChange={(e) => { content = e.target.value; }}
                    />
                </div>
            </div>,
            "max-w-3xl"
        );
    };

    const onEdit = (item: SettingItem) => {
        let content = item.content;
        openConfirmDialog(
            t("ui.settingsBrowser.edit") + ": " + item.path,
            "confirm",
            () => {
                handleSaveSetting(vault, { ...item, content }, fetchSettings);
            },
            <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">{t("ui.settingsBrowser.value")}</label>
                <Textarea
                    autoFocus
                    defaultValue={item.content}
                    className="min-h-[400px] font-mono text-base"
                    onChange={(e) => { content = e.target.value; }}
                />
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
                    <Settings className="h-5 w-5 text-primary" />
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
                    <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden">
                        {filteredSettings.map((item, index) => (
                            <div
                                key={item.pathHash || item.path}
                                className={`group flex items-center justify-between px-3 py-2 transition-colors hover:bg-muted/50 ${
                                    index !== filteredSettings.length - 1 ? "border-b border-border/50" : ""
                                }`}
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-primary break-all truncate" title={item.path}>
                                            {item.path}
                                        </span>
                                        {(item.updatedAt || item.createdAt) && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(item.updatedAt || item.createdAt || ""), "yyyy-MM-dd HH:mm:ss")}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 ml-4 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Tooltip content={t("ui.settingsBrowser.rename")} side="top">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onRename(item)}>
                                            <TextCursorInput className="h-4 w-4" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t("ui.common.edit")} side="top">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onEdit(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t("ui.common.delete")} side="top">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(item)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>
                        ))}
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
