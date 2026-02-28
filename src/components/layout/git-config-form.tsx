import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GitSyncConfigRequest, GitSyncConfigDTO } from "@/lib/types/git";
import { createGitSyncSchema } from "@/lib/validations/git-sync-schema";
import { useGitHandle } from "@/components/api-handle/git-handle";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";


interface GitConfigFormProps {
    /** 现有配置(编辑模式) */
    config?: GitSyncConfigDTO
    /** 笔记本列表 */
    vaults: VaultType[]
    /** 提交成功回调 */
    onSubmit: () => void
    /** 取消回调 */
    onCancel?: () => void
}

/**
 * Git 仓库配置表单组件
 */
export function GitConfigForm({ config, vaults, onSubmit, onCancel }: GitConfigFormProps) {
    const { t } = useTranslation()
    const { handleGitSyncUpdate, handleGitSyncValidate } = useGitHandle()

    const [showPassword, setShowPassword] = useState(false)
    const [isValidating, setIsValidating] = useState(false)

    const schema = useMemo(() => createGitSyncSchema(t), [t])

    const defaultValues = useMemo(() => (
        config ? {
            id: config.id,
            vault: config.vault,
            repoUrl: config.repoUrl,
            branch: config.branch,
            username: config.username,
            password: config.password,
            isEnabled: config.isEnabled,
            delay: config.delay,
            retentionDays: config.retentionDays ?? 30,
        } : {
            isEnabled: true,
            branch: "main",
            delay: 10,
            retentionDays: 30,
        }
    ), [config?.id, config?.vault, config?.repoUrl, config?.branch, config?.username, config?.password, config?.isEnabled, config?.delay, config?.retentionDays])

    const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, getValues, reset, watch } = useForm<GitSyncConfigRequest>({
        resolver: zodResolver(schema),
        defaultValues,
    })

    const selectedVault = watch("vault")
    const isEnabled = watch("isEnabled")

    useEffect(() => {
        reset(defaultValues)
        setShowPassword(false)
    }, [defaultValues, reset])

    const handleCancel = useCallback(() => {
        reset(defaultValues)
        setShowPassword(false)
        onCancel?.()
    }, [defaultValues, reset, onCancel])

    // ESC 键取消
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && onCancel) {
                e.preventDefault()
                handleCancel()
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [handleCancel, onCancel])

    const onFormSubmit = async (data: GitSyncConfigRequest) => {
        await handleGitSyncUpdate(data, () => {
            onSubmit()
        })
    }

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {/* 关联笔记本 */}
                <div className="space-y-1.5">
                    <Label htmlFor="vault" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.vault")}</Label>
                    <Select
                        name="vault"
                        onValueChange={(value) => setValue("vault", value)}
                        value={selectedVault || undefined}>
                        <SelectTrigger id="vault" className="bg-background border-input focus:ring-primary/20">
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

                {/* 分支名称 */}
                <div className="space-y-1.5">
                    <Label htmlFor="branch" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.git.form.branch")}</Label>
                    <Input id="branch" autoComplete="off" className="bg-background border-input" {...register("branch")} />
                    {errors.branch && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.branch.message}</p>}
                </div>

                {/* 仓库协议地址 */}
                <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="repoUrl" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.git.repoUrl")}</Label>
                    <Input id="repoUrl" placeholder="https://github.com/user/repo.git" autoComplete="off" className="bg-background border-input" {...register("repoUrl")} />
                    {errors.repoUrl && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.repoUrl.message}</p>}
                </div>

                {/* 用户名 */}
                <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.auth.username")}</Label>
                    <Input id="username" autoComplete="off" className="bg-background border-input" {...register("username")} />
                    {errors.username && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.username.message}</p>}
                </div>

                {/* 密码 / Token */}
                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.auth.password")} / Token</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            className="bg-background border-input pr-10"
                            {...register("password")}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    {errors.password && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.password.message}</p>}
                </div>

                {/* 自动同步延迟 */}
                <div className="space-y-1.5">
                    <Label htmlFor="delay" className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.git.form.delay")}</Label>
                    <Input id="delay" type="number" className="bg-background border-input" {...register("delay", { valueAsNumber: true })} />
                    {errors.delay && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.delay.message}</p>}
                </div>

                {/* 历史保留天数 */}
                <div className="space-y-1.5">
                    <Label htmlFor="retentionDays" className="text-xs font-semibold text-muted-foreground ml-1">
                        {t("ui.git.retentionDays")}
                    </Label>
                    <Input
                        id="retentionDays"
                        type="number"
                        className="bg-background border-input"
                        {...register("retentionDays", { valueAsNumber: true })}
                    />
                    <p className="text-[10px] text-muted-foreground ml-1">{t("ui.git.retentionDaysDesc")}</p>
                    {errors.retentionDays && <p className="text-[11px] text-destructive mt-1 ml-1">{errors.retentionDays.message}</p>}
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
                {/* 是否启用 */}
                <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
                    <Checkbox
                        id="isEnabled"
                        name="isEnabled"
                        checked={Boolean(isEnabled)}
                        onCheckedChange={(checked) => setValue("isEnabled", Boolean(checked))}
                        className="border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="isEnabled" className="text-sm font-medium text-foreground">{t("ui.common.isEnabled")}</Label>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                    {onCancel && (
                        <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting || isValidating}>
                            {t("ui.common.cancel")}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="px-6 rounded-lg"
                        disabled={isSubmitting || isValidating}
                        onClick={async () => {
                            const values = getValues()
                            if (!values.repoUrl) {
                                return
                            }
                            setIsValidating(true)
                            await handleGitSyncValidate({
                                repoUrl: values.repoUrl,
                                branch: values.branch,
                                username: values.username,
                                password: values.password,
                            }, () => { })
                            setIsValidating(false)
                        }}
                    >
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        {isValidating ? t("ui.git.validate.loading") : t("ui.git.validate.title")}
                    </Button>
                    <Button type="submit" size="sm" className="px-8 rounded-lg shadow-sm" disabled={isSubmitting || isValidating}>
                        {config ? t("ui.common.save") : t("ui.common.add")}
                    </Button>
                </div>
            </div>
        </form>
    )
}
