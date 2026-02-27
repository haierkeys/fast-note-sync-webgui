 export type BackupType = "full" | "incremental" | "sync";
export type CronStrategy = "daily" | "weekly" | "monthly" | "custom";

export interface BackupConfig {
    id?: number;
    uid?: number;
    vault: string;
    type: BackupType;
    cronStrategy: CronStrategy;
    cronExpression?: string;
    storageIds: string; // JSON array string, e.g., "[1, 2]"
    isEnabled: boolean;
    includeVaultName?: boolean;
    retentionDays?: number;
    lastRunTime?: string;
    nextRunTime?: string;
    lastStatus?: number;
    lastMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface BackupHistory {
    id: number;
    configId: number;
    uid: number;
    storageId: number;
    type: BackupType;
    status: number;
    message?: string;
    filePath?: string;
    fileSize?: number;
    fileCount?: number;
    startTime: string;
    endTime?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BackupConfigRequest {
    id?: number;
    vault: string;
    type: BackupType;
    cronStrategy: CronStrategy;
    cronExpression?: string;
    storageIds: string;
    isEnabled: boolean;
    includeVaultName?: boolean;
    retentionDays?: number;
}

export interface BackupExecuteRequest {
    id: number;
}
