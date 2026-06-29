import { addCacheBuster } from "@/lib/utils/cache-buster";
import { useState, useCallback } from "react";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import type { HistoricalVersion } from "@/lib/types/version";
import env from "@/env.ts";

export interface UpdateCheckResult {
    hasUpdate: boolean;
    latestVersion: string | null;
    releaseUrl: string | null;
    releaseNotes: string | null;
    releaseNotesContent: string | null;
    publishedAt: string | null;
    versionHistory?: HistoricalVersion[];
}

export function useUpdateCheck() {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

    const checkUpdate = useCallback(async (currentVersion: string): Promise<UpdateCheckResult | null> => {
        if (!currentVersion) {
            setError("Current version is unknown");
            return null;
        }

        setIsChecking(true);
        setError(null);

        try {
            const response = await fetch(
                addCacheBuster(env.API_URL + "/api/version"),
                {
                    headers: buildApiHeaders({ token: null }),
                }
            );

            if (!response.ok) {
                throw new Error(`Version API error: ${response.status}`);
            }

            const res = await response.json();
            if (res.code >= 100 || res.code <= 0 || !res.data) {
                throw new Error(res.message || "Failed to get version info");
            }

            const release = res.data;
            const result: UpdateCheckResult = {
                hasUpdate: release.versionIsNew || false,
                latestVersion: (release.versionIsNew ? release.versionNewName : release.version) || release.gitTag,
                releaseUrl: release.versionNewLink,
                releaseNotes: release.versionNewChangelog,
                releaseNotesContent: release.versionNewChangelogContent,
                publishedAt: release.buildTime,
                versionHistory: release.versionHistory,
            };

            setUpdateResult(result);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to check for updates";
            setError(message);
            return null;
        } finally {
            setIsChecking(false);
        }
    }, []);

    return {
        checkUpdate,
        isChecking,
        error,
        updateResult,
    };
}
