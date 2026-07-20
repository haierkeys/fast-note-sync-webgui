import { Pencil, Trash2, BrushCleaning, Plus, Key, Globe, Monitor, Library, RefreshCw, Check, X, Search, GripVertical, FileText, Paperclip, HardDrive, Wifi, Clock, ScanText, Wrench, Copy } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { TokenManager, TokenManagerHandle } from "@/components/user/token-manager";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ObsidianAuthModal } from "@/components/user/obsidian-auth-modal";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

import { VaultForceDeleteModal } from "./vault-force-delete-modal";


interface VaultListProps {
  onNavigateToNotes?: (vaultName: string, mode?: "folder" | "flat") => void;
  onNavigateToAttachments?: (vaultName: string) => void;
  ftsBleveEnabled?: boolean;
}

// 可排序的仓库卡片组件
interface SortableVaultCardProps {
  vault: VaultType;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  startEdit: (vault: VaultType, e: React.MouseEvent) => void;
  saveEdit: (vault: VaultType) => void;
  cancelEdit: () => void;
  handleDelete: (id: string) => void;
  onViewConfig: (vaultName: string, e: React.MouseEvent) => void;
  onNavigateToNotes?: (vaultName: string, mode?: "folder" | "flat") => void;
  onNavigateToAttachments?: (vaultName: string) => void;
  formatBytes: (bytes: string | number | undefined) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  ftsBleveEnabled?: boolean;
  onRebuildIndex: (id: string | number) => void;
  onOpenForceDeleteModal: (vault: VaultType) => void;
}

function SortableVaultCard({
  vault,
  editingId,
  editingName,
  setEditingName,
  startEdit,
  saveEdit,
  cancelEdit,
  handleDelete,
  onViewConfig,
  onNavigateToNotes,
  onNavigateToAttachments,
  formatBytes,
  t,
  ftsBleveEnabled,
  onRebuildIndex,
  onOpenForceDeleteModal,
}: SortableVaultCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: vault.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const [showToolbar, setShowToolbar] = useState(false);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/60 p-5 transition-all duration-300",
        "hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 hover:bg-card group cursor-pointer",
        isDragging && "shadow-2xl border-primary/50 bg-card"
      )}
      onClick={() => editingId !== vault.id && onNavigateToNotes && onNavigateToNotes(vault.vault, "folder")}
    >
      {/* 头部：仓库名称与状态 */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary shrink-0 border border-primary/20">
            <Library className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            {editingId === vault.id ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-9 rounded-xl border-primary/30 focus-visible:ring-primary/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(vault)
                    if (e.key === "Escape") cancelEdit()
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold truncate leading-tight group-hover:text-primary transition-colors">
                  {vault.vault}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal bg-primary/5 text-primary/70 border-primary/10">
                    ID: {String(vault.id).slice(0, 8)}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 拖拽手柄 - 仅在非编辑模式显示 */}
        {editingId !== vault.id && (
          <button
            {...attributes}
            {...listeners}
            className="p-2 rounded-xl text-muted-foreground/30 hover:text-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-all shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* 统计信息区 */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="relative flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/30 p-3.5 hover:bg-primary/5 hover:border-primary/20 transition-all group/stat overflow-hidden"
          onClick={(e) => {
            if (editingId !== vault.id && onNavigateToNotes) {
              e.stopPropagation();
              onNavigateToNotes(vault.vault, "flat");
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("ui.vault.note")}</span>
            <FileText className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/stat:text-primary/60 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">{vault.noteCount}</span>
            {vault.noteSize !== undefined && (
              <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap">
                {formatBytes(vault.noteSize)}
              </span>
            )}
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover/stat:opacity-[0.06] transition-opacity">
            <FileText className="h-12 w-12" />
          </div>
        </div>

        <div
          className="relative flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/30 p-3.5 hover:bg-primary/5 hover:border-primary/20 transition-all group/stat overflow-hidden"
          onClick={(e) => {
            if (editingId !== vault.id && onNavigateToAttachments) {
              e.stopPropagation();
              onNavigateToAttachments(vault.vault);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("ui.vault.attachmentCount")}</span>
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/stat:text-primary/60 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">{vault.fileCount || "0"}</span>
            {vault.fileSize !== undefined && (
              <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap">
                {formatBytes(vault.fileSize)}
              </span>
            )}
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover/stat:opacity-[0.06] transition-opacity">
            <Paperclip className="h-12 w-12" />
          </div>
        </div>
      </div>

      {/* 容量与时间 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-muted-foreground/70">
            <HardDrive className="h-3.5 w-3.5" />
            <span className="font-medium">{t("ui.vault.totalSize", { size: formatBytes(vault.size) })}</span>
          </div>
          <div className="flex items-center gap-3">
            {vault.updatedAt && (
              <Tooltip content={t("ui.common.updatedAt")} side="top" delay={300}>
                <span className="flex items-center gap-1.5 text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {vault.updatedAt.split(' ')[0]}
                </span>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 装饰性进度条 (细化显示笔记和附件占用) */}
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden flex">
          {parseInt(String(vault.noteSize || 0)) > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.max(5, Math.min((parseInt(String(vault.noteSize || 0)) / (1024 * 1024 * 1024)) * 100, 100))}%`,
                backgroundColor: '#08b94e',
                opacity: 0.3
              }}
            />
          )}
          {parseInt(String(vault.fileSize || 0)) > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min((parseInt(String(vault.fileSize || 0)) / (1024 * 1024 * 1024)) * 100, Math.max(0, 100 - (parseInt(String(vault.noteSize || 0)) > 0 ? Math.max(5, Math.min((parseInt(String(vault.noteSize || 0)) / (1024 * 1024 * 1024)) * 100, 100)) : 0)))}%`,
                backgroundColor: '#7C4DFF',
                opacity: 0.3
              }}
            />
          )}
        </div>
      </div>

      {/* 操作按钮区 */}
      <footer className="flex items-center justify-between gap-2 mt-auto">
        {editingId === vault.id ? (
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              {t("ui.common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white border-none"
              onClick={(e) => {
                e.stopPropagation()
                saveEdit(vault)
              }}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {t("ui.common.save")}
            </Button>
          </div>
        ) : (
          <>
            <Tooltip content={t("ui.vault.authTokenConfig")} side="top" delay={200}>
              <Button
                className="h-8 px-3 rounded-xl border-none shadow-sm flex items-center gap-1.5"
                onClick={(e) => onViewConfig(vault.vault, e)}
              >
                <Key className="h-4 w-4" />
                <span className="text-xs font-medium">{t("ui.vault.authTokenConfig")}</span>
              </Button>
            </Tooltip>

            <div className="flex items-center gap-1">
              <Tooltip content={t("ui.vault.toolbar") || "工具箱"} side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all",
                    showToolbar && "text-primary bg-primary/5"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolbar(!showToolbar);
                  }}
                >
                  <Wrench className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content={t("ui.vault.edit")} side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/5"
                  onClick={(e) => startEdit(vault, e)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content={t("ui.vault.delete")} side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(vault.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            </div>
          </>
        )}
      </footer>

      {/* 工具箱面板 - 内部左侧抽屉式拉出 */}
      {showToolbar && (
        <div
          className="absolute left-0 top-0 bottom-0 min-w-50 z-30 flex flex-col gap-3 p-4 rounded-l-2xl border-r border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-left duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-primary" />
              {t("ui.vault.toolbar") || "工具箱"}
            </span>
            <button
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors"
              onClick={() => setShowToolbar(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 w-full rounded-lg text-xs hover:bg-primary/5 hover:text-primary flex items-center justify-start gap-2 transition-all"
              onClick={() => {
                setShowToolbar(false);
                if (!ftsBleveEnabled) {
                  toast.warning(t("ui.vault.rebuildIndexDisabledHint") || "您需要启用 Bleve 全文搜索才可以重建");
                  return;
                }
                onRebuildIndex(vault.id);
              }}
            >
              <ScanText className="h-3.5 w-3.5" />
              <span>{t("ui.vault.rebuildIndex") || "重新全文索引"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 w-full rounded-lg text-xs hover:bg-primary/5 hover:text-primary flex items-center justify-start gap-2 transition-all"
              onClick={() => {
                setShowToolbar(false);
                navigator.clipboard.writeText(String(vault.id)).then(() => {
                  toast.success(t("ui.common.copied") || "已复制");
                });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{t("ui.vault.copyId") || "复制 ID"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 w-full rounded-lg text-xs hover:bg-destructive/5 hover:text-destructive flex items-center justify-start gap-2 text-destructive/80 transition-all font-bold"
              onClick={() => {
                setShowToolbar(false);
                onOpenForceDeleteModal(vault);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t("ui.vault.forceDeleteItem") || "强制物理删除..."}</span>
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

// 本地存储排序顺序的 key
const VAULT_ORDER_KEY = "vault-sort-order"

export function VaultList({ onNavigateToNotes, onNavigateToAttachments, ftsBleveEnabled }: VaultListProps) {
  const { t } = useTranslation()
  const [vaults, setVaults] = useState<VaultType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [newVaultName, setNewVaultName] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configVaultName, setConfigVaultName] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)
  const [onlineCount, setOnlineCount] = useState(0)
  const [tokenFilter, setTokenFilter] = useState<0 | 1 | 2>(0);
  const [loginCount, setLoginCount] = useState(0)
  const [manualCount, setManualCount] = useState(0)

  const [forceDeleteModalOpen, setForceDeleteModalOpen] = useState(false)
  const [selectedForceDeleteVault, setSelectedForceDeleteVault] = useState<VaultType | null>(null)

  const { handleVaultList, handleVaultDelete, handleVaultUpdate, handleVaultRebuildIndex } = useVaultHandle()
  const { openConfirmDialog } = useConfirmDialog()

  const handleOpenForceDeleteModal = (vault: VaultType) => {
    setSelectedForceDeleteVault(vault);
    setForceDeleteModalOpen(true);
  };

  const handleRebuildIndex = async (id: string | number) => {
    openConfirmDialog(t("ui.vault.rebuildIndexConfirm"), "confirm", async () => {
      try {
        await handleVaultRebuildIndex(id)
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    })
  }
  const tokenManagerRef = useRef<TokenManagerHandle>(null)

  const handleSetTokenFilter = (type: 0 | 1 | 2) => {
    const newType = tokenFilter === type ? 0 : type;
    setTokenFilter(newType);
    tokenManagerRef.current?.setFilterType(newType);
  };

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要移动 8px 才开始拖拽，避免误触
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 长按 200ms 后开始拖拽
        tolerance: 5, // 允许 5px 的移动容差
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadVaults = useCallback(async (showNotification = false) => {
    if (showNotification) {
      setIsRefreshing(true)
    }
    try {
      await handleVaultList((data) => {
        // 从本地存储读取排序顺序
        const savedOrder = localStorage.getItem(VAULT_ORDER_KEY)
        if (savedOrder) {
          try {
            const orderIds = JSON.parse(savedOrder) as string[]
            // 按保存的顺序排序
            const sortedData = [...data].sort((a, b) => {
              const indexA = orderIds.indexOf(a.id)
              const indexB = orderIds.indexOf(b.id)
              // 如果不在保存的顺序中，放到最后
              if (indexA === -1) return 1
              if (indexB === -1) return -1
              return indexA - indexB
            })
            setVaults(sortedData)
          } catch {
            setVaults(data)
          }
        } else {
          setVaults(data)
        }
      })
      if (showNotification) {
        toast.success(t("ui.common.refreshSuccess"))
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      if (showNotification) {
        setIsRefreshing(false)
      }
    }
  }, [handleVaultList, t])

  useEffect(() => {
    void loadVaults()
  }, [loadVaults])

  // 筛选后的仓库列表
  const filteredVaults = useMemo(() => {
    if (!searchKeyword.trim()) return vaults
    const keyword = searchKeyword.toLowerCase()
    return vaults.filter(vault => vault.vault.toLowerCase().includes(keyword))
  }, [vaults, searchKeyword])

  // 拖拽结束处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setVaults((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        // 保存排序顺序到本地存储
        const orderIds = newItems.map((item) => item.id)
        localStorage.setItem(VAULT_ORDER_KEY, JSON.stringify(orderIds))
        return newItems
      })
    }
  }

  const handleDelete = async (id: string) => {
    openConfirmDialog(t("ui.vault.confirmDelete"), "confirm", async () => {
      // Show loading toast / 显示加载提示
      const toastId = toast.loading(t("ui.vault.deleting") || "正在删除笔记库，请稍候...")
      try {
        await handleVaultDelete(id)
        setVaults(vaults.filter((vault) => vault.id !== id))
        // Show success toast / 显示成功提示
        toast.success(t("ui.vault.deleteSuccess") || "删除成功")
      } catch (error: unknown) {
        // Show error toast / 显示错误提示
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        // Dismiss loading toast / 销毁加载提示
        toast.dismiss(toastId)
      }
    })
  }

  // 开始编辑
  const startEdit = (vault: VaultType, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(vault.id)
    setEditingName(vault.vault)
  }

  // 保存编辑
  const saveEdit = (vault: VaultType) => {
    if (!editingName.trim()) {
      toast.error(t("ui.vault.nameRequired"))
      return
    }
    handleVaultUpdate({ ...vault, vault: editingName.trim() }, () => {
      setEditingId(null)
      loadVaults()
    })
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  // 添加新仓库
  const handleAdd = () => {
    if (!newVaultName.trim()) {
      toast.error(t("ui.vault.nameRequired"))
      return
    }
    handleVaultUpdate({ vault: newVaultName.trim() } as VaultType, () => {
      setIsAdding(false)
      setNewVaultName("")
      loadVaults()
    })
  }

  // 格式化字节
  const formatBytes = (bytes: string | number | undefined): string => {
    if (bytes === undefined || bytes === null || bytes === "") return "0 B"
    const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes
    if (isNaN(numBytes) || numBytes === 0) return "0 B"

    if (numBytes < 1024) return `${numBytes} B`
    if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(2)} KB`
    const mb = numBytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  // 查看仓库配置
  const handleViewConfig = (vaultName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfigVaultName(vaultName)
    setConfigModalOpen(true)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 lg:pb-4 items-start">
      {/* 左侧卡片 - 笔记库管理 */}
      <section className="rounded-xl border border-border bg-card p-6 custom-shadow overflow-hidden">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{t("ui.vault.management") || "笔记库管理"}</h2>
            <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-medium flex items-center gap-1 bg-muted/50 text-muted-foreground border-border/60">
              {vaults.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex items-center group/search">
              <div className={cn(
                "flex items-center relative transition-all duration-300 ease-in-out overflow-hidden h-9 rounded-xl border border-transparent",
                searchKeyword
                  ? "w-48 border-border bg-muted/50"
                  : "w-9 hover:w-48 hover:border-border hover:bg-muted/50 focus-within:w-48 focus-within:border-border focus-within:bg-muted/50"
              )}>
                <Input
                  type="text"
                  placeholder={t("ui.vault.searchPlaceholder")}
                  className={cn(
                    "h-full pl-3 pr-9 border-none bg-transparent focus-visible:ring-0 text-sm w-48 transition-opacity duration-300",
                    searchKeyword ? "opacity-100" : "opacity-0 group-hover/search:opacity-100 focus-within:opacity-100"
                  )}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
                <div className="absolute right-0 w-9 h-9 flex items-center justify-center shrink-0 z-10 pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                {searchKeyword && (
                  <button
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-20 animate-in fade-in zoom-in duration-200"
                    onClick={() => setSearchKeyword("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Tooltip content={t("ui.common.refresh") || "刷新"} side="top" delay={400}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadVaults(true)}
                disabled={isRefreshing}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </Tooltip>
            <Tooltip content={t("ui.vault.add") || "新增"} side="top" delay={400}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAdding(true)}
                disabled={isAdding}
                className="h-8 w-8 rounded-lg text-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </header>

        {/* 新增仓库输入框 */}
        {isAdding && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <Input
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder={t("ui.vault.name")}
                className="h-9 flex-1 rounded-xl"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                  if (e.key === "Escape") {
                    setIsAdding(false)
                    setNewVaultName("")
                  }
                }}
              />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleAdd}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsAdding(false); setNewVaultName(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 笔记库列表 */}
        <div className="min-h-[290px]">
          {filteredVaults.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[290px] text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
              <Library className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm opacity-70 mb-4">
                {searchKeyword ? t("ui.common.noSearchResults") : t("ui.vault.noVaults")}
              </p>
              {!searchKeyword && vaults.length === 0 && (
                <Button
                  className="rounded-xl border-none shadow-sm"
                  onClick={(e) => handleViewConfig("", e)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  {t("ui.vault.oneClickImport")}
                </Button>
              )}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredVaults.map((v) => v.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredVaults.map((vault) => (
                    <SortableVaultCard
                      key={vault.id}
                      vault={vault}
                      editingId={editingId}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      startEdit={startEdit}
                      saveEdit={saveEdit}
                      cancelEdit={cancelEdit}
                      handleDelete={handleDelete}
                      onViewConfig={handleViewConfig}
                      onNavigateToNotes={onNavigateToNotes}
                      onNavigateToAttachments={onNavigateToAttachments}
                      formatBytes={formatBytes}
                      t={t}
                      ftsBleveEnabled={ftsBleveEnabled}
                      onRebuildIndex={handleRebuildIndex}
                      onOpenForceDeleteModal={handleOpenForceDeleteModal}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>

      {/* 右侧卡片 - 令牌管理 */}
      <section className="space-y-4 lg:sticky lg:top-4 h-full">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/30 p-1 custom-shadow backdrop-blur-sm max-h-[calc(100vh-120px)] overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black tracking-tight">{t("ui.vault.authTokenConfig") || "授权令牌"}</h2>

              <div className="flex items-center gap-1.5 ml-1">
                <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-bold flex items-center gap-1 bg-muted/30 text-muted-foreground/60 border-none" title={t("ui.token.totalTokens")}>
                  {tokenCount}
                </Badge>
                {onlineCount > 0 && (
                  <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-bold flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border-none" title={t("ui.token.onlineDevices")}>
                    <Wifi className="h-3 w-3 animate-pulse" />
                    {onlineCount}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-2 border-l border-border/40 pl-2">
                <Tooltip content={`${t("ui.token.issueTypeManual")}`} side="top">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 px-2 flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-all duration-300 border-none rounded-lg",
                      tokenFilter === 2
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20 scale-110"
                        : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                    )}
                    onClick={() => handleSetTokenFilter(2)}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    {manualCount > 0 && <span className="text-[10px] leading-none">{manualCount}</span>}
                  </Badge>
                </Tooltip>

                <Tooltip content={`${t("ui.token.issueTypeLogin")}`} side="top">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 px-2 flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-all duration-300 border-none rounded-lg",
                      tokenFilter === 1
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 scale-110"
                        : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    )}
                    onClick={() => handleSetTokenFilter(1)}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {loginCount > 0 && <span className="text-[10px] leading-none">{loginCount}</span>}
                  </Badge>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip content={t("ui.common.refresh") || "刷新"} side="top" delay={400}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => tokenManagerRef.current?.refresh()}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content={t("ui.token.cleanExpired") || "批量清理已过期登录令牌"} side="top" delay={400}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => tokenManagerRef.current?.cleanExpired()}
                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/5"
                >
                  <BrushCleaning className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content={t("ui.token.createTitle") || "创建令牌"} side="top" delay={400}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => tokenManagerRef.current?.openCreate()}
                  className="h-8 w-8 rounded-lg text-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-5 pb-8 scrollbar-thin">
            <TokenManager
              ref={tokenManagerRef}
              isCompact
              onCountChange={setTokenCount}
              onOnlineCountChange={setOnlineCount}
              onLoginCountChange={setLoginCount}
              onManualCountChange={setManualCount}
            />
          </div>

        </div>
      </section>


      {/* 配置模态窗口 */}
      <ObsidianAuthModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        vaultName={configVaultName}
        onSuccess={() => tokenManagerRef.current?.refresh()}
      />

      {/* 强制物理删除模态窗口 */}
      <VaultForceDeleteModal
        open={forceDeleteModalOpen}
        onOpenChange={setForceDeleteModalOpen}
        vault={selectedForceDeleteVault}
      />
    </div>
  )
}
