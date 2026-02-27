import * as z from "zod";


export const createBackupConfigSchema = (t: (key: string) => string) => z.object({
    vault: z.string().min(1, t("ui.backup.validation.vaultRequired")),
    type: z.enum(["full", "incremental", "sync"], {
        required_error: t("ui.backup.validation.typeRequired"),
    }),
    cronStrategy: z.enum(["daily", "weekly", "monthly", "custom"], {
        required_error: t("ui.backup.validation.strategyRequired"),
    }),
    cronExpression: z.string().optional(),
    storageIds: z.string().refine((val) => {
        try {
            const arr = JSON.parse(val);
            return Array.isArray(arr) && arr.length > 0;
        } catch {
            return false;
        }
    }, t("ui.backup.validation.storageRequired")),
    isEnabled: z.boolean().default(true),
    includeVaultName: z.boolean().default(false),
    retentionDays: z.number().int().min(-1, t("ui.backup.validation.retentionDaysMin")).optional(),
}).refine((data) => {
    if (data.cronStrategy === "custom" && !data.cronExpression) {
        return false;
    }
    return true;
}, {
    message: t("ui.backup.validation.cronExpressionRequired"),
    path: ["cronExpression"],
});

export type BackupFormData = z.infer<ReturnType<typeof createBackupConfigSchema>>;
