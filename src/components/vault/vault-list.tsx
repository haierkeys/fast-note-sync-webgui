import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { Pencil, Trash2, Plus, Clipboard, Database, Clock, RefreshCw, Check, X, Search, GripVertical, ExternalLink } from "lucide-react";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Input } from "@/components/ui/input";
import { CSS } from "@dnd-kit/utilities";
import env from "@/env.ts";


interface VaultListProps {
  onNavigateToNotes?: (vaultName: string) => void;
  onNavigateToAttachments?: (vaultName: string) => void;
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
  onNavigateToNotes?: (vaultName: string) => void;
  onNavigateToAttachments?: (vaultName: string) => void;
  formatBytes: (bytes: string | number | undefined) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
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
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer"
      onClick={() => editingId !== vault.id && onNavigateToNotes && onNavigateToNotes(vault.vault)}
    >
      {/* 头部：仓库名称 */}
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Database className="h-5 w-5" />
        </span>
        {editingId === vault.id ? (
          <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="flex-1 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(vault)
                if (e.key === "Escape") cancelEdit()
              }}
            />
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold truncate flex-1">{vault.vault}</h3>
            {/* 拖拽手柄 */}
            <button
              {...attributes}
              {...listeners}
              className="p-2 rounded-xl text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-5 w-5 md:h-4 md:w-4" />
            </button>
          </>
        )}
      </header>

      {/* 统计信息 */}
      <dl className="grid grid-cols-2 gap-3">
        <div
          className="flex flex-col rounded-lg border border-border/70 bg-background/80 p-3 hover:bg-primary/5 hover:border-primary/30 transition-colors group/stat"
          onClick={(e) => {
            if (editingId !== vault.id && onNavigateToNotes) {
              e.stopPropagation();
              onNavigateToNotes(vault.vault);
            }
          }}
        >
          <dt className="text-xs text-muted-foreground group-hover/stat:text-primary transition-colors">{t("ui.vault.note")}</dt>
          <dd className="text-xl font-semibold flex items-center justify-between gap-1">
            <span>{vault.noteCount}</span>
            {vault.noteSize !== undefined && (
              <span className="text-[10px] font-normal text-muted-foreground/50">
                {formatBytes(vault.noteSize)}
              </span>
            )}
          </dd>
        </div>
        <div
          className="flex flex-col rounded-lg border border-border/70 bg-background/80 p-3 hover:bg-primary/5 hover:border-primary/30 transition-colors group/stat"
          onClick={(e) => {
            if (editingId !== vault.id && onNavigateToAttachments) {
              e.stopPropagation();
              onNavigateToAttachments(vault.vault);
            }
          }}
        >
          <dt className="text-xs text-muted-foreground group-hover/stat:text-primary transition-colors">{t("ui.vault.attachmentCount")}</dt>
          <dd className="text-xl font-semibold flex items-center justify-between gap-1">
            <span>{vault.fileCount || "0"}</span>
            {vault.fileSize !== undefined && (
              <span className="text-[10px] font-normal text-muted-foreground/50">
                {formatBytes(vault.fileSize)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("ui.vault.totalSize", { size: formatBytes(vault.size) })}</span>
        <div className="flex items-center gap-3">
          {vault.createdAt && (
            <Tooltip content={t("ui.common.createdAt")} side="top" delay={300}>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {vault.createdAt}
              </span>
            </Tooltip>
          )}
          {vault.updatedAt && (
            <Tooltip content={t("ui.common.updatedAt")} side="top" delay={300}>
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {vault.updatedAt}
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
        {editingId === vault.id ? (
          <>
            <Tooltip content={t("ui.common.save")} side="top" delay={200}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation()
                  saveEdit(vault)
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t("ui.common.cancel")} side="top" delay={200}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  cancelEdit()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip content={t("ui.vault.authTokenConfig")} side="top" delay={200}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-purple-600"
                onClick={(e) => onViewConfig(vault.vault, e)}
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </Tooltip>

            <Tooltip content={t("ui.vault.edit")} side="top" delay={200}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-green-600"
                onClick={(e) => startEdit(vault, e)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t("ui.vault.delete")} side="top" delay={200}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(vault.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </article>
  );
}

// 本地存储排序顺序的 key
const VAULT_ORDER_KEY = "vault-sort-order"

export function VaultList({ onNavigateToNotes, onNavigateToAttachments }: VaultListProps) {
  const { t } = useTranslation()
  const [vaults, setVaults] = useState<VaultType[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [newVaultName, setNewVaultName] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configModalIsError, setConfigModalIsError] = useState(false)
  const [configVaultName, setConfigVaultName] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { handleVaultList, handleVaultDelete, handleVaultUpdate } = useVaultHandle()
  const { openConfirmDialog } = useConfirmDialog()

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
      await handleVaultDelete(id)
      setVaults(vaults.filter((vault) => vault.id !== id))
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
    setConfigModalIsError(false)
    setConfigModalOpen(true)
  }

  // 获取配置 JSON
  const getConfigJson = useCallback((vaultName?: string) => {
    return JSON.stringify({
      api: env.API_URL,
      apiToken: localStorage.getItem("token") || "",
      ...(vaultName ? { vault: vaultName } : {}),
    }, null, 2)
  }, [])

  const getObsidianUrl = useCallback((vaultName?: string) => {
    const api = env.API_URL;
    const apiToken = localStorage.getItem("token") || "";
    const vault = vaultName || configVaultName;
    return `obsidian://fast-note-sync/sso?pushApi=${encodeURIComponent(api)}&pushApiToken=${encodeURIComponent(apiToken)}&pushVault=${encodeURIComponent(vault)}`;
  }, [configVaultName]);

  // 复制配置（用于模态窗口）
  const handleCopyConfig = () => {
    const configText = getConfigJson(configVaultName)
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(configText)
        .then(() => {
          toast.success(t("ui.vault.copyConfigSuccess"))
        })
        .catch((err) => {
          toast.error(t("ui.common.error") + err)
        })
    } else {
      toast.error(t("ui.vault.copyConfigError"))
    }
  }


  return (
    <div className="w-full space-y-4">
      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
        {/* 左侧：数量显示 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {t("ui.vault.count", { count: filteredVaults.length })}
            {searchKeyword && vaults.length !== filteredVaults.length && (
              <span className="ml-1">/ {t("ui.vault.count", { count: vaults.length })}</span>
            )}
          </span>
        </div>

        {/* 右侧：搜索和操作 */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("ui.vault.searchPlaceholder")}
              className="pl-9 pr-8 rounded-xl"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchKeyword("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Tooltip content={t("ui.common.refresh")} side="bottom" delay={200}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadVaults(true)}
              className="h-9 w-9 rounded-xl shrink-0"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </Tooltip>
          <Button
            onClick={() => setIsAdding(true)}
            className="rounded-xl shrink-0"
            disabled={isAdding}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("ui.vault.add")}</span>
          </Button>
        </div>
      </div>

      {/* 新增仓库输入框 */}
      {isAdding && (
        <div className="rounded-xl border border-primary bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Database className="h-5 w-5" />
            </span>
            <Input
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              placeholder={t("ui.vault.name")}
              className="flex-1 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
                if (e.key === "Escape") {
                  setIsAdding(false)
                  setNewVaultName("")
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("ui.common.save")}
              className="h-8 w-8 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={handleAdd}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("ui.common.cancel")}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsAdding(false)
                setNewVaultName("")
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 仓库列表 */}
      {filteredVaults.length === 0 && !isAdding ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
          <p className="text-muted-foreground">
            {searchKeyword ? t("ui.common.noSearchResults") : t("ui.vault.noVaults")}
          </p>
          {!searchKeyword && (
            <div className="flex flex-col items-center gap-4">

              <Button
                variant="outline"
                className="w-full sm:w-auto rounded-xl bg-sky-700 hover:bg-sky-900 text-white hover:text-white transition-colors border-none shadow-sm"
                onClick={(e) => handleViewConfig("", e)}
              >
                <Clipboard className="h-4 w-4 mr-2" />
                {t("ui.vault.oneClickImport")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredVaults.map((v) => v.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 配置模态窗口 */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto rounded-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg truncate pr-8">
              {configModalIsError ? t("ui.vault.copyConfigError") : t("ui.vault.authTokenConfig")}
              {configVaultName && ` - ${configVaultName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <pre className="p-3 sm:p-4 rounded-xl bg-muted text-xs sm:text-sm overflow-x-auto max-h-48 sm:max-h-64 font-mono whitespace-pre-wrap break-all">
              {getConfigJson(configVaultName)}
            </pre>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 text-nowrap">
              <Button variant="outline" onClick={() => setConfigModalOpen(false)} className="w-full sm:w-auto rounded-xl">
                {t("ui.common.close")}
              </Button>
              <Button
                className="w-full sm:w-auto rounded-xl bg-sky-700 hover:bg-sky-900 text-white transition-colors border-none shadow-sm"
                onClick={() => {
                  window.location.href = getObsidianUrl();
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("ui.vault.oneClickImport")}
              </Button>

              <Button onClick={handleCopyConfig} className="w-full sm:w-auto rounded-xl">
                <Clipboard className="h-4 w-4 mr-2" />
                {t("ui.common.copy")}
              </Button>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
