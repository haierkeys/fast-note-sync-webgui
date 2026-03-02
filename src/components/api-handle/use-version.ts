import { addCacheBuster } from "@/lib/utils/cache-buster";
import type { VersionInfo } from "@/lib/types/version";
import { useAppStore } from "@/stores/app-store";
import { useTranslation } from "react-i18next";
import { getBrowserLang } from "@/i18n/utils";
import { useState, useEffect } from "react";
import env from "@/env.ts";

export type { VersionInfo } from "@/lib/types/version";

export function useVersion() {
    const { t } = useTranslation()
    const { setVersionInfo } = useAppStore()
    const [versionInfo, setVersionInfoLocal] = useState<VersionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchVersion = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(addCacheBuster(env.API_URL + "/api/version"), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Domain: window.location.origin,
                        Lang: getBrowserLang(),
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }

                const res = await response.json();
                if (controller.signal.aborted) {
                    return;
                }
                if (res.code < 100 && res.code > 0 && res.data) {
                    setVersionInfoLocal(res.data);
                    setVersionInfo(res.data);
                } else {
                    setError(res.message || t('getVersionError'));
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                if (!controller.signal.aborted) {
                    setError(t('getVersionError'));
                    console.error("Version fetch error:", error);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchVersion();

        return () => {
            controller.abort();
        };
    }, [setVersionInfo, t]);

    return {
        versionInfo,
        isLoading,
        error,
    };
}
