import { ShieldCheck, Smartphone, Monitor, RefreshCw, RotateCw, Trash2, Clock, Globe, ShieldAlert, Plus, Key, Copy, Check, Terminal, FileText, ChevronLeft, ChevronRight, History, Activity, MoreVertical, HelpCircle, Laptop, Apple, Chrome } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useTokenHandle, TokenLog, type TokenInfo } from "@/components/api-handle/token-handle";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { VaultType } from "@/lib/types/vault";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import React from "react";


interface TokenManagerProps {
  isCompact?: boolean;
  onCountChange?: (count: number) => void;
  onOnlineCountChange?: (count: number) => void;
  onLoginCountChange?: (count: number) => void;
  onManualCountChange?: (count: number) => void;
}

export interface TokenManagerHandle {
  openCreate: () => void;
  refresh: () => void;
  setFilterType: (type: 0 | 1 | 2) => void;
  cleanExpired: () => void;
}

// 专业品牌图标组件
const WindowsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 17.1L9.75 21.9V12.3H0v8.249zM10.5 2V11.7H24V0L10.5 2zm0 19.9l13.5 2V12.3H10.5v9.6z" />
  </svg>
);

const AndroidIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.523 15.3414C17.0709 15.3414 16.7042 14.9747 16.7042 14.5226C16.7042 14.0705 17.0709 13.7038 17.523 13.7038C17.9751 13.7038 18.3418 14.0705 18.3418 14.5226C18.3418 14.9747 17.9751 15.3414 17.523 15.3414ZM6.47702 15.3414C6.02492 15.3414 5.65823 14.9747 5.65823 14.5226C5.65823 14.0705 6.02492 13.7038 6.47702 13.7038C6.92911 13.7038 7.29581 14.0705 7.29581 14.5226C7.29581 14.9747 6.92911 15.3414 6.47702 15.3414ZM17.8465 10.925L19.4975 8.06544C19.648 7.80481 19.5588 7.47196 19.2982 7.32145C19.0375 7.17094 18.7047 7.26017 18.5542 7.52081L16.8529 10.4677C15.4269 9.81534 13.8052 9.42997 12 9.42997C10.1948 9.42997 8.57307 9.81534 7.14713 10.4677L5.44577 7.52081C5.29527 7.26017 4.96245 7.17094 4.70181 7.32145C4.44116 7.47196 4.35194 7.80481 4.50244 8.06544L6.15347 10.925C3.06456 12.6015 1 15.7725 1 19.4673H23C23 15.7725 20.9354 12.6015 17.8465 10.925Z" />
  </svg>
);

const TokenManagerInner = (
  { isCompact, onCountChange, onOnlineCountChange, onLoginCountChange, onManualCountChange }: TokenManagerProps,
  ref: React.ForwardedRef<TokenManagerHandle>
) => {
  const { t } = useTranslation();
  const { 
    tokens, 
    isLoading, 
    currentTokenID, 
    handleListTokens, 
    handleRevokeToken, 
    handleCreateToken, 
    handleUpdateToken, 
    handleFetchTokenLogs, 
    handleRotateToken,
    handleCleanExpiredTokens
  } = useTokenHandle();

  const highlightTokenId = useAppStore(state => state.highlightTokenId);
  const setHighlightTokenId = useAppStore(state => state.setHighlightTokenId);

  useEffect(() => {
    if (highlightTokenId && tokens.length > 0) {
      // 延迟一点确保渲染完成
      const timer = setTimeout(() => {
        const element = document.getElementById(`token-card-${highlightTokenId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 5秒后清除高亮状态
          const clearTimer = setTimeout(() => setHighlightTokenId(null), 5000);
          return () => clearTimeout(clearTimer);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightTokenId, tokens, setHighlightTokenId]);

  const [filterType, setFilterType] = useState<0 | 1 | 2>(0); // 0: all, 1: login, 2: manual

    useImperativeHandle(ref, () => ({
      openCreate: () => setIsCreateOpen(true),
      refresh: () => handleListTokens(),
      setFilterType: (type: 0 | 1 | 2) => setFilterType(type),
      cleanExpired: () => setIsCleanExpiredOpen(true),
    }));
    const [revokingId, setRevokingId] = useState<number | null>(null);

    // Token Log View State
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
    const [logs, setLogs] = useState<TokenLog[]>([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [logPage, setLogPage] = useState(1);
    const [isLogLoading, setIsLogLoading] = useState(false);
    const LOG_PAGE_SIZE = 10;

    // Create/Edit token dialog state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { handleVaultList } = useVaultHandle();
    const [availableVaults, setAvailableVaults] = useState<VaultType[]>([]);
    const [selectedVaults, setSelectedVaults] = useState<string[]>([]);

    useEffect(() => {
      if (isCreateOpen) {
        handleVaultList((list) => {
          setAvailableVaults(list);
        }).catch((err) => console.error("Failed to load vaults for token restriction", err));
      }
    }, [isCreateOpen, handleVaultList]);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editingTokenId, setEditingTokenId] = useState<number | null>(null);

    const [newClientType, setNewClientType] = useState("Other");
    const [newProtocols, setNewProtocols] = useState<string[]>(["rest", "ws"]);
    const [newClientDim, setNewClientDim] = useState("*");
    const [newFuncDims, setNewFuncDims] = useState<string[]>([]); // Empty means "*"
    const [newExpiresDays, setNewExpiresDays] = useState(30);
    const [newBoundIp, setNewBoundIp] = useState("");
    const [newUserAgent, setNewUserAgent] = useState("");
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Rotation dialog state
    const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);
    const [rotateTargetId, setRotateTargetId] = useState<number | null>(null);
    const [isRotating, setIsRotating] = useState(false);
    const [isRotateMode, setIsRotateMode] = useState(false);

    // Clean expired tokens state
    const [isCleanExpiredOpen, setIsCleanExpiredOpen] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    const onCleanExpired = async () => {
      setIsCleaning(true);
      try {
        const success = await handleCleanExpiredTokens(1);
        if (success) {
          toast.success(t("ui.token.cleanExpiredSuccess") || "Cleaned successfully");
          setIsCleanExpiredOpen(false);
        } else {
          toast.error(t("ui.common.error") || "Clean failed");
        }
      } finally {
        setIsCleaning(false);
      }
    };

    useEffect(() => {
      handleListTokens();
    }, [handleListTokens]);

    useEffect(() => {
      if (onCountChange) {
        onCountChange(tokens.length);
      }
      if (onOnlineCountChange) {
        const online = tokens.filter(t => t.isWsOnline).length;
        onOnlineCountChange(online);
      }
      if (onLoginCountChange) {
        const login = tokens.filter(t => t.issueType === 1).length;
        onLoginCountChange(login);
      }
      if (onManualCountChange) {
        const manual = tokens.filter(t => t.issueType === 2).length;
        onManualCountChange(manual);
      }
    }, [tokens, onCountChange, onOnlineCountChange, onLoginCountChange, onManualCountChange]);

    const onRevoke = async (id: number) => {
      setRevokingId(id);
      const success = await handleRevokeToken(id);
      if (success) {
        toast.success(t("ui.token.revokeSuccess") || "Token revoked successfully");
      } else {
        toast.error(t("ui.token.revokeFailed") || "Failed to revoke token");
      }
      setRevokingId(null);
    };

    const onRotate = (id: number) => {
      setRotateTargetId(id);
      setIsRotateDialogOpen(true);
    };

    const onRotateConfirm = async () => {
      if (!rotateTargetId) return;
      
      setIsRotating(true);
      try {
        const newToken = await handleRotateToken(rotateTargetId);
        if (newToken) {
          setGeneratedToken(newToken);
          setIsRotateMode(true);
          setIsCreateOpen(true);
          setIsEditMode(false); // Show the new token in the creation dialog
          setIsRotateDialogOpen(false);
          toast.success(t("ui.token.rotateSuccess"));
        } else {
          toast.error(t("ui.common.error"));
        }
      } finally {
        setIsRotating(false);
        setRotateTargetId(null);
      }
    };

    const onOpenLogs = (id: number) => {
      setSelectedTokenId(id);
      setLogPage(1);
      setIsLogOpen(true);
      fetchLogs(id, 1);
    };

    const onOpenEdit = (token: TokenInfo) => {
      setEditingTokenId(token.id);
      setIsEditMode(true);
      setNewClientType(token.clientType);
      setNewBoundIp(token.boundIp);
      setNewUserAgent(token.userAgent);

      // Parse scope
      const parts = token.scope.split(" ");
      let p = ["rest", "ws"];
      let c = "*";
      let f = [] as string[];

      parts.forEach((part: string) => {
        if (part.startsWith("p:")) p = part.substring(2) === "*" ? [] : part.substring(2).split(",").filter(i => i);
        if (part.startsWith("c:")) c = part.substring(2);
        if (part.startsWith("f:")) f = part.substring(2) === "*" ? [] : part.substring(2).split(",").filter(i => i);
      });

      setNewProtocols(p);
      setNewClientDim(c);
      setNewFuncDims(f);

      // Parse vaults
      const vList = token.vaults ? token.vaults.split(",").filter((i: string) => i) : [];
      setSelectedVaults(vList);

      // Expires: Calculate days from now
      const expiresAt = new Date(token.expiredAt);
      const diff = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      setNewExpiresDays(diff > 0 ? diff : 30);

      setIsCreateOpen(true);
    };

    const fetchLogs = async (id: number, page: number) => {
      setIsLogLoading(true);
      const res = await handleFetchTokenLogs(id, page, LOG_PAGE_SIZE);
      if (res) {
        setLogs(res.logs);
        setTotalLogs(res.pager.totalRows);
      }
      setIsLogLoading(false);
    };

    const onPageChange = (newPage: number) => {
      if (selectedTokenId) {
        setLogPage(newPage);
        fetchLogs(selectedTokenId, newPage);
      }
    };

    const onSubmitToken = async () => {
      const protocolStr = newProtocols.length === 0 ? "*" : newProtocols.join(",");
      const funcStr = newFuncDims.length === 0 ? "*" : newFuncDims.join(",");
      const vaultsStr = selectedVaults.length === 0 ? "" : selectedVaults.join(",");

      if (isEditMode && editingTokenId) {
        const success = await handleUpdateToken(
          editingTokenId,
          newClientType.trim(),
          "", // Scope is handled by components if needed, or leave blank to use dimensions
          newExpiresDays,
          newBoundIp.trim(),
          newUserAgent.trim(),
          protocolStr,
          newClientDim.trim(),
          funcStr,
          vaultsStr
        );
        if (success) {
          toast.success(t("ui.common.success"));
          closeCreateDialog();
        } else {
          toast.error(t("ui.common.error"));
        }
      } else {
        const token = await handleCreateToken(
          newClientType.trim(),
          "",
          newExpiresDays,
          newBoundIp.trim(),
          newUserAgent.trim(),
          protocolStr,
          newClientDim.trim(),
          funcStr,
          vaultsStr
        );
        if (token) {
          setGeneratedToken(token);
          handleListTokens();
          toast.success(t("ui.common.success"));
        } else {
          toast.error(t("ui.common.error"));
        }
      }
    };

    const handleCopy = useCallback(() => {
      if (generatedToken) {
        navigator.clipboard.writeText(generatedToken).then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          toast.success(t("ui.vault.copyConfigSuccess") || "Copied to clipboard");
        });
      }
    }, [generatedToken, t]);

    const closeCreateDialog = () => {
      setIsCreateOpen(false);
      setIsEditMode(false);
      setIsRotateMode(false);
      setEditingTokenId(null);
      setGeneratedToken(null);
      setNewClientType("Other");
      setNewProtocols(["rest", "ws"]);
      setNewClientDim("*");
      setNewFuncDims([]);
      setSelectedVaults([]);
      setNewExpiresDays(30);
      setNewBoundIp("");
      setNewUserAgent("");
    };

    const toggleProtocol = (p: string) => {
      setNewProtocols(prev =>
        prev.includes(p) ? prev.filter(i => i !== p) : [...prev, p]
      );
    };
    const toggleFuncDim = (f: string) => {
      setNewFuncDims(prev => {
        const isSelecting = !prev.includes(f);
        let next = isSelecting ? [...prev, f] : prev.filter(i => i !== f);

        if (isSelecting) {
          if (f.endsWith("_rw")) {
            const rVersion = f.replace("_rw", "_r");
            next = next.filter(i => i !== rVersion);
          } else if (f.endsWith("_r")) {
            const rwVersion = f.replace("_r", "_rw");
            next = next.filter(i => i !== rwVersion);
          }
        }
        return next;
      });
    };

    const renderDeviceIcon = (clientName: string = "") => {
      const name = String(clientName || "").toLowerCase();

      if (name.includes("web") || name.includes("chrome") || name.includes("edge") || name.includes("safari") || name.includes("firefox")) {
        return <Chrome className="h-3 w-3 text-[#4285F4] shrink-0" />;
      } else if (name.includes("mac") || name.includes("apple") || name.includes("iphone") || name.includes("ipad") || name.includes("ios")) {
        if (name.includes("iphone") || name.includes("ipad") || name.includes("ios")) {
          return <Smartphone className="h-3 w-3 text-[#555555] shrink-0" />;
        }
        return <Apple className="h-3 w-3 text-[#555555] shrink-0" />;
      } else if (name.includes("win")) {
        return <WindowsIcon className="h-3 w-3 text-[#0078D4] shrink-0 translate-y-[0.5px]" />;
      } else if (name.includes("android")) {
        return <AndroidIcon className="h-3 w-3 text-[#3DDC84] shrink-0" />;
      } else if (name.includes("mobile")) {
        return <Smartphone className="h-3 w-3 text-slate-400 shrink-0" />;
      }

      return <Laptop className="h-3 w-3 text-slate-400 shrink-0" />;
    };

    const getClientIcon = (clientType: string) => {
      const type = clientType.toLowerCase();
      if (type.includes("mobile") || type.includes("ios") || type.includes("android")) {
        return <Smartphone className="h-4 w-4" />;
      }
      return <Monitor className="h-4 w-4" />;
    };

    const parseScope = useCallback((scope: string) => {
      const parts = scope.split(" ");
      let protocols = [] as string[];
      let client = "*";
      let funcs = [] as string[];

      parts.forEach((part: string) => {
        if (part.startsWith("p:")) protocols = part.substring(2).split(",").filter(i => i);
        if (part.startsWith("c:")) client = part.substring(2);
        if (part.startsWith("f:")) funcs = part.substring(2) === "*" ? [] : part.substring(2).split(",").filter(i => i);
      });

      return { protocols, client, funcs };
    }, []);

    const getExpiryInfo = useCallback((createdAt: string, expiredAt: string) => {
      const start = new Date(createdAt).getTime();
      const end = new Date(expiredAt).getTime();
      const now = new Date().getTime();

      if (now >= end) return { percent: 100, isExpired: true, remainingDays: 0 };

      const total = end - start;
      const elapsed = now - start;
      const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
      const remainingDays = Math.ceil((end - now) / (1000 * 3600 * 24));

      return { percent, isExpired: false, remainingDays };
    }, []);

    const getFuncLabel = (func: string) => {
      switch (func) {
        case "note_r": return t("ui.token.permNoteR");
        case "note_w":
        case "note_rw": return t("ui.token.permNoteRW");
        case "file_r": return t("ui.token.permFileR");
        case "file_w":
        case "file_rw": return t("ui.token.permFileRW");
        case "config_r": return t("ui.token.permConfigR");
        case "config_w":
        case "config_rw": return t("ui.token.permConfigRW");
        default: return func;
      }
    };

    return (
      <>
        <div className={cn("space-y-6", isCompact ? "animate-none" : "animate-in fade-in slide-in-from-bottom-4 duration-500")}>
        {!isCompact && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                {t("ui.nav.menuTokens") || "令牌管理"}
              </h1>
              <p className="text-muted-foreground mt-2">
                {t("ui.token.description") || "管理您的活动会话和 API 访问令牌。您可以随时注销不再使用的设备。"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleListTokens()}
                disabled={isLoading}
                className="rounded-xl"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCleanExpiredOpen(true)}
                disabled={isLoading || isCleaning}
                className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5"
                title={t("ui.token.cleanExpired") || "批量清理已过期登录令牌"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsCreateOpen(true)}
                className="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
              </Button>

            </div>
          </div>
        )}




        <Dialog open={isCreateOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                {isRotateMode ? (t("ui.token.rotateResultTitle") || "令牌轮换结果") : 
                 isEditMode ? (t("ui.token.editTitle") || "编辑令牌") : (t("ui.token.createTitle") || "创建新令牌")}
              </DialogTitle>
              <DialogDescription>
                {isRotateMode ? (t("ui.token.rotateResultDesc") || "新的令牌已生成，旧令牌已失效。请更新您的客户端配置。") :
                 isEditMode ? (t("ui.token.editDesc") || "修改现有令牌的权限和有效期设置。") : (t("ui.token.createDesc") || "手动创建一个具有特定权限和有效期的 API 访问令牌。")}
              </DialogDescription>
            </DialogHeader>

            {!generatedToken ? (
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 py-4">
                {/* 第一行：备注名称 和 客户端限制 */}
                <div className="space-y-2">
                  <Label htmlFor="clientType" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span className="flex items-center gap-1">
                      {t("ui.token.name")}
                      <Tooltip content={t("ui.token.nameHelp")}>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                      </Tooltip>
                    </span>
                  </Label>
                  <Input
                    id="clientType"
                    value={newClientType}
                    onChange={(e) => setNewClientType(e.target.value)}
                    placeholder="e.g. Obsidian-Mobile, MyServer"
                    className="rounded-xl h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientDim" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Smartphone className="h-3 w-3" />
                    <span className="flex items-center gap-1">
                      {t("ui.token.clientType")}
                      <Tooltip content={t("ui.token.clientTypeHelp")}>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                      </Tooltip>
                    </span>
                  </Label>
                  <Input
                    id="clientDim"
                    value={newClientDim}
                    onChange={(e) => setNewClientDim(e.target.value)}
                    placeholder="e.g. ObsidianPlugin, *"
                    className="rounded-xl h-9"
                  />
                </div>

                {/* 第二行：协议限制 和 有效期 */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Terminal className="h-3 w-3" />
                    <span className="flex items-center gap-1">
                      {t("ui.token.protocol")}
                      <Tooltip content={t("ui.token.protocolHelp")}>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                      </Tooltip>
                    </span>
                  </Label>
                  <div className="flex flex-wrap items-center gap-3 p-2 px-3 rounded-xl bg-muted/50 border border-border h-9">
                    {["rest", "ws", "mcp"].map((p) => (
                      <div key={p} className="flex items-center space-x-1.5">
                        <Checkbox
                          id={`p-${p}`}
                          checked={newProtocols.includes(p)}
                          onCheckedChange={() => toggleProtocol(p)}
                          className="h-3.5 w-3.5"
                        />
                        <Label htmlFor={`p-${p}`} className="uppercase cursor-pointer text-xs">{p}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {t("ui.token.expiresDays")}
                  </Label>
                  <Input
                    id="expires"
                    type="number"
                    value={newExpiresDays}
                    onChange={(e) => setNewExpiresDays(parseInt(e.target.value))}
                    className="rounded-xl h-9"
                  />
                </div>

                {/* 第三行：内容限制（全宽） */}
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="funcDim" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="flex items-center gap-1">
                      {t("ui.token.function")}
                      <Tooltip content={t("ui.token.functionHelp")}>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                      </Tooltip>
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-y-3 gap-x-4 p-3 rounded-xl bg-muted/50 border border-border">
                    {/* Notes Column */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 px-1 border-b border-border/30 pb-1">
                        {t("ui.vault.note")}
                      </div>
                      {[
                        { id: "note_r", label: t("ui.token.funcNoteR") },
                        { id: "note_rw", label: t("ui.token.funcNoteRW") },
                      ].map((opt) => (
                        <div key={opt.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`f-${opt.id}`}
                            checked={newFuncDims.includes(opt.id)}
                            onCheckedChange={() => toggleFuncDim(opt.id)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={`f-${opt.id}`} className="cursor-pointer text-[11px] truncate" title={opt.label}>{opt.label.includes(' - ') ? opt.label.split(' - ')[1] : opt.label}</Label>
                        </div>
                      ))}
                    </div>

                    {/* Files Column */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 px-1 border-b border-border/30 pb-1">
                        {t("ui.file.file")}
                      </div>
                      {[
                        { id: "file_r", label: t("ui.token.funcFileR") },
                        { id: "file_rw", label: t("ui.token.funcFileRW") },
                      ].map((opt) => (
                        <div key={opt.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`f-${opt.id}`}
                            checked={newFuncDims.includes(opt.id)}
                            onCheckedChange={() => toggleFuncDim(opt.id)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={`f-${opt.id}`} className="cursor-pointer text-[11px] truncate" title={opt.label}>{opt.label.includes(' - ') ? opt.label.split(' - ')[1] : opt.label}</Label>
                        </div>
                      ))}
                    </div>

                    {/* Config Column */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 px-1 border-b border-border/30 pb-1">
                        {t("ui.nav.menuSettings")}
                      </div>
                      {[
                        { id: "config_r", label: t("ui.token.funcConfigR") },
                        { id: "config_rw", label: t("ui.token.funcConfigRW") },
                      ].map((opt) => (
                        <div key={opt.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`f-${opt.id}`}
                            checked={newFuncDims.includes(opt.id)}
                            onCheckedChange={() => toggleFuncDim(opt.id)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={`f-${opt.id}`} className="cursor-pointer text-[11px] truncate" title={opt.label}>{opt.label.includes(' - ') ? opt.label.split(' - ')[1] : opt.label}</Label>
                        </div>
                      ))}
                    </div>

                    <div className="col-span-3 border-t border-border/50 pt-2 mt-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="f-all"
                          checked={newFuncDims.length === 0}
                          onCheckedChange={(checked) => checked ? setNewFuncDims([]) : setNewFuncDims(["note_r"])}
                          className="h-3.5 w-3.5"
                        />
                        <Label htmlFor="f-all" className="cursor-pointer font-bold text-[11px]">{t("ui.common.unrestricted")}</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 笔记库限制（全宽） */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span className="flex items-center gap-1">
                      {t("ui.token.vaultRestriction")}
                      <Tooltip content={t("ui.token.vaultRestrictionHelp")}>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help transition-colors" />
                      </Tooltip>
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                    {availableVaults.length === 0 ? (
                      <p className="text-xs text-muted-foreground/75 px-1 py-0.5">
                        {t("ui.token.noVaultsAvailable")}
                      </p>
                    ) : (
                      <>
                        {availableVaults.map((v) => (
                          <div key={v.id} className="flex items-center space-x-2 bg-background/50 hover:bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/40 transition-colors">
                            <Checkbox
                              id={`v-${v.id}`}
                              checked={selectedVaults.includes(v.vault)}
                              onCheckedChange={(checked) => {
                                setSelectedVaults(prev =>
                                  checked ? [...prev, v.vault] : prev.filter(item => item !== v.vault)
                                );
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <Label htmlFor={`v-${v.id}`} className="cursor-pointer text-xs font-medium">{v.vault}</Label>
                          </div>
                        ))}
                        <div className="flex w-full col-span-3 border-t border-border/50 pt-2 mt-1">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="v-all"
                              checked={selectedVaults.length === 0}
                              onCheckedChange={(checked) => checked && setSelectedVaults([])}
                              className="h-3.5 w-3.5"
                            />
                            <Label htmlFor="v-all" className="cursor-pointer text-xs font-bold text-primary">{t("ui.common.unrestricted")}</Label>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 第四行：限制 IP 和 限制 UA */}
                <div className="space-y-1.5">
                  <Label htmlFor="boundIp" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    {t("ui.token.boundIp")}
                  </Label>
                  <Input
                    id="boundIp"
                    value={newBoundIp}
                    onChange={(e) => setNewBoundIp(e.target.value)}
                    placeholder="e.g. 127.0.0.1"
                    className="rounded-xl h-9"
                  />
                  <p className="text-[10px] text-muted-foreground/70 px-1 italic">
                    {t("ui.token.ipWildcardHint")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="userAgent" className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Monitor className="h-3 w-3" />
                    {t("ui.token.userAgent")}
                  </Label>
                  <Input
                    id="userAgent"
                    value={newUserAgent}
                    onChange={(e) => setNewUserAgent(e.target.value)}
                    placeholder="e.g. Mozilla..."
                    className="rounded-xl h-9"
                  />
                  <p className="text-[10px] text-muted-foreground/70 px-1 italic">
                    {t("ui.token.uaWildcardHint")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <p>{t("ui.token.warning") || "请务必复制并妥善保存此令牌。出于安全原因，它将不会再次显示。"}</p>
                </div>
                <div className="relative group">
                  <div className="p-4 rounded-xl bg-muted font-mono text-sm break-all pr-12 border border-border">
                    {generatedToken}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 h-8 w-8 rounded-lg"
                    onClick={handleCopy}
                  >
                    {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              {!generatedToken ? (
                <>
                  <Button variant="ghost" onClick={closeCreateDialog} className="rounded-xl">
                    {t("ui.common.cancel")}
                  </Button>
                  <Button onClick={onSubmitToken} disabled={isLoading} className="rounded-xl px-8">
                    {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    {t("ui.common.confirm")}
                  </Button>
                </>
              ) : (
                <Button onClick={closeCreateDialog} className="rounded-xl w-full">
                  {t("ui.common.close")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4">
          {(() => {
            const filteredTokens = tokens.filter(t => filterType === 0 || t.issueType === filterType);
            if (filteredTokens.length === 0 && !isLoading) {
              return (
                <Card className="border-dashed border-2 bg-muted/30">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">{t("ui.token.noTokens") || "暂无活动令牌"}</p>
                  </CardContent>
                </Card>
              );
            }
            return filteredTokens.map((token) => {
              const { protocols, funcs } = parseScope(token.scope);
              const expiry = getExpiryInfo(token.createdAt, token.expiredAt);
              const isSelf = token.id === currentTokenID;

              return (
                <Card 
                  id={`token-card-${token.id}`}
                  key={token.id} 
                  className={cn(
                    "group relative overflow-hidden transition-all duration-500 border-border/40 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    expiry.isExpired ? "opacity-60 bg-muted/20" : "bg-card/50",
                    highlightTokenId === token.id && "shadow-[0_0_35px_-5px_rgba(245,158,11,0.4)] border-amber-500/30 bg-amber-500/[0.01] z-10"
                  )}
                  onClick={() => highlightTokenId === token.id && setHighlightTokenId(null)}
                >
                  {/* 顶部背景装饰 */}
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1 transition-all duration-500",
                    expiry.isExpired ? "bg-muted" :
                      isSelf ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
                        token.issueType === 2 ? "bg-gradient-to-r from-blue-500 to-blue-600" :
                          "bg-gradient-to-r from-primary/40 to-primary"
                  )} />

                  <CardContent className="p-5 space-y-4">
                    {/* 头部：图标 + 标题 + 状态 */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 duration-300",
                          expiry.isExpired ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        )}>
                          {token.issueType === 1 ? (
                            <Globe className="h-5 w-5" />
                          ) : (
                            getClientIcon(token.clientType)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base truncate max-w-[150px]">{token.clientType}</h3>
                            {isSelf && (
                              <Badge className="h-5 text-[10px] px-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
                                {t("ui.token.current")}
                              </Badge>
                            )}
                            {token.isWsOnline && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/5 px-1.5 py-0.5 rounded-md border border-emerald-500/10">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                {t("ui.token.wsOnline")}
                              </div>
                            )}
                            <div className="flex gap-1">
                              {protocols.map(p => (
                                <Badge key={p} variant="outline" className="h-4 text-[9px] px-1 font-bold uppercase border-primary/20 text-primary bg-primary/5">
                                  {p === "*" ? t("ui.token.anyProtocol") : p}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal bg-primary/5 text-primary/70 border-primary/10">
                                ID: {token.id}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal flex items-center gap-1 bg-primary/5 text-primary/70 border-primary/10">
                                {token.issueType === 1 ? <Globe className="h-3 w-3" /> : React.cloneElement(getClientIcon(token.clientType) as React.ReactElement<{ className?: string }>, { className: "h-3 w-3" })}
                                {token.issueType === 1 ? t("ui.token.issueTypeLogin") : t("ui.token.issueTypeManual")}
                              </Badge>
                            </span>

                            {/* 权限 Scope 详情 */}
                            <div className="flex flex-wrap gap-1 items-center">
                              {funcs.length === 0 ? (
                                <Badge variant="outline" className="h-4 text-[9px] px-1 font-medium bg-muted text-muted-foreground border-border">{t("ui.token.unrestrictedFunc")}</Badge>
                              ) : (
                                funcs.map(f => (
                                  <Badge key={f} variant="outline" className="h-4 text-[9px] px-1 font-medium bg-sky-500/5 text-sky-600 border-sky-500/20">{getFuncLabel(f)}</Badge>
                                ))
                              )}

                              {token.boundIp && token.boundIp !== "*" && (
                                <Badge variant="outline" className="h-4 text-[9px] px-1 font-medium border-amber-500/20 text-amber-600 bg-amber-500/5 whitespace-nowrap">
                                  {t("ui.token.ipRestriction")}: {token.boundIp}
                                </Badge>
                              )}

                              {token.userAgent && token.userAgent !== "*" && (
                                <Tooltip content={token.userAgent}>
                                  <Badge variant="outline" className="h-4 text-[9px] px-1 font-medium border-indigo-500/20 text-indigo-600 bg-indigo-500/5 cursor-help">
                                    {t("ui.token.uaRestriction")}
                                  </Badge>
                                </Tooltip>
                              )}

                              {token.vaults ? (
                                <Badge variant="outline" className="h-4 text-[9px] px-1 font-semibold border-emerald-500/30 text-emerald-600 bg-emerald-500/5 whitespace-nowrap">
                                  {t("ui.token.vaultRestriction")}: {token.vaults}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-4 text-[9px] px-1 font-medium border-border/80 text-muted-foreground/80 bg-muted/20 whitespace-nowrap">
                                  {t("ui.token.vaultRestriction")}: {t("ui.common.unrestricted")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            <DropdownMenuItem onClick={() => onOpenLogs(token.id)} className="gap-2 cursor-pointer">
                              <History className="h-4 w-4" />
                              {t("ui.token.logsTitle")}
                            </DropdownMenuItem>
                            {token.issueType === 2 && (
                              <DropdownMenuItem onClick={() => onOpenEdit(token)} className="gap-2 cursor-pointer">
                                <FileText className="h-4 w-4" />
                                {t("ui.common.edit")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => onRotate(token.id)}
                              disabled={isSelf || token.issueType !== 2}
                              className="gap-2 cursor-pointer"
                            >
                              <RotateCw className="h-4 w-4" />
                              {t("ui.token.rotate")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onRevoke(token.id)}
                              disabled={isSelf || revokingId === token.id}
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("ui.common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>


                    {/* 最后使用与有效期 */}
                    <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 truncate">
                        <Activity className="h-3 w-3" />
                        <span>{t("ui.token.lastUsedAt")}:</span>
                        <span className="font-medium">
                          {token.lastUsedAt && !token.lastUsedAt.startsWith("0001") ? new Date(token.lastUsedAt).toLocaleString() : t("ui.common.never")}
                        </span>
                        {token.lastUsedAt && !token.lastUsedAt.startsWith("0001") && (new Date().getTime() - new Date(token.lastUsedAt).getTime() < 60 * 60 * 1000) && (
                          <span className="text-emerald-500  ml-1 animate-pulse">
                            {t("ui.token.recentUse")}
                          </span>
                        )}
                        {token.activeClients && token.activeClients.length > 0 && (
                          <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border/50">
                            {token.activeClients.map((name, index) => (
                              <div key={index} className="flex items-center gap-1">
                                {renderDeviceIcon(name)}
                                <span className="text-primary font-bold">
                                  {name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Tooltip
                        content={
                          <div className="space-y-1 p-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{t("ui.common.createdAt")}:</span>
                              <span className="font-mono">{new Date(token.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{t("ui.token.expiresAt")}:</span>
                              <span className="font-mono">{new Date(token.expiredAt).toLocaleString()}</span>
                            </div>
                          </div>
                        }
                      >
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold shrink-0 cursor-help",
                          expiry.isExpired ? "text-destructive" : expiry.percent > 90 ? "text-destructive" : expiry.percent > 70 ? "text-amber-500" : "text-emerald-500"
                        )}>
                          <Clock className="h-3 w-3" />
                          {expiry.isExpired ? t("ui.token.statusExpired") : `${expiry.remainingDays}${t("ui.token.daysRemaining")}`}
                        </div>
                      </Tooltip>
                    </div>

                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>


        <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
          <DialogContent className="sm:max-w-[900px] lg:max-w-[1000px] rounded-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t("ui.token.logsTitle") || "访问日志"}
              </DialogTitle>
              <DialogDescription>
                {tokens.find(t => t.id === selectedTokenId)?.clientType} - {t("ui.token.logsDesc") || "查看该令牌的最近访问记录"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4">
              <div className="rounded-xl border border-border overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[170px] text-[11px] uppercase tracking-wider font-bold">{t("ui.token.logTime")}</TableHead>
                      <TableHead className="w-[80px] text-[11px] uppercase tracking-wider font-bold">{t("ui.token.logProtocol") || "协议"}</TableHead>
                      <TableHead className="w-[180px] text-[11px] uppercase tracking-wider font-bold">{t("ui.token.logClient")}</TableHead>
                      <TableHead className="w-[120px] text-[11px] uppercase tracking-wider font-bold">{t("ui.token.logIp")}</TableHead>
                      <TableHead className="min-w-[200px] text-[11px] uppercase tracking-wider font-bold">{t("ui.token.logUa")}</TableHead>
                      <TableHead className="w-[70px] text-[11px] uppercase tracking-wider font-bold text-center">{t("ui.token.logStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLogLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground/30" />
                        </TableCell>
                      </TableRow>
                    ) : (logs?.length || 0) === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                          {t("ui.common.noData") || "暂无日志记录"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs?.map((log) => (
                        <TableRow key={log.id} className="group hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 h-4 w-fit border-primary/20 text-primary bg-primary/5">
                              {log.protocol}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-foreground/90">{log.clientName || "Unknown"}</span>
                              <span className="text-[11px] text-muted-foreground font-medium">{log.client}</span>
                              {log.clientVersion && (
                                <span className="text-[10px] text-muted-foreground/50 font-mono">v{log.clientVersion}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{log.ip}</TableCell>
                          <TableCell>
                            <div className="text-[10px] text-muted-foreground/60 truncate max-w-[300px]" title={log.ua}>
                              {log.ua}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              "text-xs font-bold",
                              log.statusCode >= 200 && log.statusCode < 300 ? "text-emerald-500" : "text-destructive"
                            )}>{log.statusCode}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                Total {totalLogs} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => onPageChange(logPage - 1)}
                  disabled={logPage <= 1 || isLogLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium px-2">
                  {logPage} / {Math.ceil(totalLogs / LOG_PAGE_SIZE) || 1}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => onPageChange(logPage + 1)}
                  disabled={logPage >= Math.ceil(totalLogs / LOG_PAGE_SIZE) || isLogLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rotate Token Warning Dialog */}
      <Dialog open={isRotateDialogOpen} onOpenChange={setIsRotateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" />
              {t("ui.token.rotate")}
            </DialogTitle>
            <DialogDescription>
              {t("ui.token.rotateConfirm")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p className="leading-relaxed font-medium">
                {t("ui.token.rotateWarning")}
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground italic">
              {t("ui.token.rotateEffectHint") || "执行此操作后，旧令牌的所有活跃会话将失效，需重新配置客户端"}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRotateDialogOpen(false)}
              className="rounded-xl"
            >
              {t("ui.common.cancel")}
            </Button>
            <Button
              onClick={onRotateConfirm}
              disabled={isRotating}
              className="rounded-xl px-8"
            >
              {isRotating ? (
                <RotateCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCw className="h-4 w-4 mr-2" />
              )}
              {t("ui.token.rotateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clean Expired Tokens Dialog */}
      <Dialog open={isCleanExpiredOpen} onOpenChange={setIsCleanExpiredOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t("ui.token.cleanExpired") || "批量清理已过期登录令牌"}
            </DialogTitle>
            <DialogDescription>
              {t("ui.token.cleanExpiredConfirm")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p className="leading-relaxed font-medium">
                {t("ui.token.cleanExpiredConfirm")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCleanExpiredOpen(false)}
              className="rounded-xl"
            >
              {t("ui.common.cancel")}
            </Button>
            <Button
              onClick={onCleanExpired}
              disabled={isCleaning}
              variant="destructive"
              className="rounded-xl px-8"
            >
              {isCleaning ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t("ui.token.cleanExpiredAction") || "立即清理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    );
  };

export const TokenManager = React.memo(forwardRef(TokenManagerInner));
