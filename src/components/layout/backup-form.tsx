import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBackupConfigSchema, BackupFormData } from "@/lib/validations/backup-schema";
import { BackupConfig, BackupType, CronStrategy } from "@/lib/types/backup";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { zodResolver } from "@hookform/resolvers/zod";
import { StorageConfig } from "@/lib/types/storage";
import { Tooltip } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { VaultType } from "@/lib/types/vault";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";


interface BackupFormProps {
    config?: BackupConfig;
    storages: StorageConfig[];
    onSubmit: () => void;
    onCancel?: () => void;
}

export function BackupForm({ config, storages, onSubmit, onCancel }: BackupFormProps) {
    const { t } = useTranslation();
    const { handleBackupConfigUpdate } = useBackupHandle();
    const { handleVaultList } = useVaultHandle();
    const [vaults, setVaults] = useState<VaultType[]>([]);

    // 过滤出可用的存储
    const activeStorages = storages.filter(s => s.isEnabled);

    // 解析存储 ID 数组，并过滤掉不可用的存储 ID
    const initialStorageIds = config?.storageIds
        ? (JSON.parse(config.storageIds) as number[]).filter(id => activeStorages.some(s => Number(s.id) === id))
        : [];
    const [selectedStorageIds, setSelectedStorageIds] = useState<number[]>(initialStorageIds);

    useEffect(() => {
        handleVaultList(setVaults);
    }, [handleVaultList]);

    // ESC 键取消
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && onCancel) {
                e.preventDefault()
                onCancel()
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [onCancel])

    const schema = createBackupConfigSchema(t);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BackupFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            vault: config?.vault || "",
            type: config?.type,
            cronStrategy: config?.cronStrategy || "daily",
            cronExpression: config?.cronExpression || "0 0 * * *",
            storageIds: JSON.stringify(initialStorageIds),
            isEnabled: config?.isEnabled ?? true,
            includeVaultName: config?.includeVaultName ?? false,
            retentionDays: config?.retentionDays ?? 30,
        },
    });

    const cronStrategy = watch("cronStrategy");

    const onFormSubmit = (data: BackupFormData) => {
        handleBackupConfigUpdate({
            ...data,
            id: config?.id,
        }, () => {
            onSubmit();
        });
    };

    const toggleStorage = (id: number) => {
        const newIds = selectedStorageIds.includes(id)
            ? selectedStorageIds.filter(i => i !== id)
            : [...selectedStorageIds, id];
        setSelectedStorageIds(newIds);
        setValue("storageIds", JSON.stringify(newIds));
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {/* 保险库选择 */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.vault")}</Label>
                    <Select
                        onValueChange={(value) => setValue("vault", value)}
                        defaultValue={config?.vault}>
                        <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder={t("ui.backup.selectVault")} />
                        </SelectTrigger>
                        <SelectContent>
                            {vaults.map((v) => (
                                <SelectItem value={v.vault} key={v.id}>
                                    {v.vault}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.vault && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.vault.message}</p>}
                </div>

                {/* 备份类型 */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.type")}</Label>
                    <Select
                        onValueChange={(value) => setValue("type", value as BackupType)}
                        defaultValue={config?.type}>
                        <SelectTrigger className="bg-background border-input">
                            <SelectValue placeholder={t("ui.backup.selectType")} />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Option values */}
                            <SelectItem value="full">{t("ui.backup.backupType.full")}</SelectItem>
                            <SelectItem value="incremental">{t("ui.backup.backupType.incremental")}</SelectItem>
                            <SelectItem value="sync">{t("ui.backup.backupType.sync")}</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.type && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.type.message}</p>}
                </div>

                {/* 仅在同步备份时显示：包含仓库名选项 */}
                {watch("type") === "sync" && (
                    <div className="space-y-1.5 md:col-span-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="includeVaultName"
                                checked={watch("includeVaultName")}
                                onCheckedChange={(checked) => setValue("includeVaultName", Boolean(checked))}
                            />
                            <Label htmlFor="includeVaultName" className="text-sm font-medium text-foreground">
                                {t("ui.backup.includeVaultName.label")}
                            </Label>
                            <Tooltip
                                content={
                                    <div className="whitespace-pre-line text-left">
                                        {t("ui.backup.includeVaultName.tooltip")}
                                    </div>
                                }
                                side="right"
                            >
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </Tooltip>
                        </div>
                    </div>
                )}

                {/* 仅在全量或增量备份时显示的配置项 */}
                {(watch("type") === "full" || watch("type") === "incremental") && (
                    <>
                        {/* 定时策略 */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.cronStrategy")}</Label>
                            <Select
                                onValueChange={(value) => setValue("cronStrategy", value as CronStrategy)}
                                defaultValue={config?.cronStrategy || "daily"}>
                                <SelectTrigger className="bg-background border-input">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">{t("ui.backup.strategy.daily")}</SelectItem>
                                    <SelectItem value="weekly">{t("ui.backup.strategy.weekly")}</SelectItem>
                                    <SelectItem value="monthly">{t("ui.backup.strategy.monthly")}</SelectItem>
                                    <SelectItem value="custom">{t("ui.backup.strategy.custom")}</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.cronStrategy && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.cronStrategy.message}</p>}
                        </div>

                        {/* Cron 表达式 */}
                        <div className={cn("space-y-1.5", cronStrategy !== "custom" && "opacity-50 pointer-events-none")}>
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.cronExpression")}</Label>
                            <Input
                                {...register("cronExpression")}
                                placeholder="0 0 * * *"
                                className="bg-background border-input"
                                disabled={cronStrategy !== "custom"}
                            />
                            {errors.cronExpression && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.cronExpression.message}</p>}
                        </div>

                    </>
                )}

                {/* 保留天数 - 镜像同步也需要显示保留天数 */}
                {(watch("type") === "full" || watch("type") === "incremental" || watch("type") === "sync") && (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground ml-1">
                            {watch("type") === "sync"
                                ? t("ui.backup.retentionDays.sync")
                                : (watch("type") === "full" || watch("type") === "incremental")
                                    ? t("ui.backup.retentionDays.backup")
                                    : t("ui.backup.retentionDays")}
                        </Label>
                        <Input
                            type="number"
                            {...register("retentionDays", { valueAsNumber: true })}
                            placeholder="30"
                            className="bg-background border-input"
                        />
                        {errors.retentionDays && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.retentionDays.message}</p>}
                    </div>
                )}

                {/* 存储后端多选 */}
                <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.storages")}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-input rounded-md p-3 bg-background/50">
                        {activeStorages.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground bg-muted/30 rounded-md border border-dashed">
                                <span className="text-sm mb-2">{t("ui.backup.noAvailableStorage")}</span>
                                <p className="text-xs opacity-70 mb-2">{t("ui.backup.addStorageTip")}</p>
                            </div>
                        ) : (
                            activeStorages.map((s) => (
                                <div key={s.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`storage-${s.id}`}
                                        checked={selectedStorageIds.includes(Number(s.id))}
                                        onCheckedChange={() => toggleStorage(Number(s.id))}
                                    />
                                    <Label htmlFor={`storage-${s.id}`} className="text-sm font-normal cursor-pointer truncate">
                                        {t(`ui.storage.storageType.${s.type}`)} ({s.id})
                                    </Label>
                                </div>
                            ))
                        )}
                    </div>
                    {errors.storageIds && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.storageIds.message}</p>}
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="isEnabledBackup"
                        checked={watch("isEnabled")}
                        onCheckedChange={(checked) => setValue("isEnabled", Boolean(checked))}
                    />
                    <Label htmlFor="isEnabledBackup" className="text-sm font-medium text-foreground">{t("ui.common.isEnabled")}</Label>
                </div>

                <div className="flex items-center gap-3">
                    {onCancel && (
                        <Button type="button" variant="ghost" onClick={onCancel}>
                            {t("ui.common.cancel")}
                        </Button>
                    )}
                    <Button type="submit" size="sm" className="px-8 rounded-lg shadow-sm">
                        {config ? t("ui.common.save") : t("ui.common.add")}
                    </Button>
                </div>
            </div>
        </form>
    );
}
