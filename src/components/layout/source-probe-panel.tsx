import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import env from "@/env.ts";
import { Loader2, Activity, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export interface ProbeItem {
    ok: boolean;
    latencyMs: number;
}

export interface ProbeData {
    github: ProbeItem;
    cnb: ProbeItem;
    recommended: string;
    selectedMode: string;
}

interface SourceProbePanelProps {
    token: string | null;
    mode: string;
    onApply: (recommended: string) => void;
}

function latencyColor(ms: number, ok: boolean): string {
    if (!ok) return "text-red-500";
    if (ms < 300) return "text-green-500";
    if (ms < 1000) return "text-yellow-500";
    return "text-red-500";
}

export function SourceProbePanel({ token, mode, onApply }: SourceProbePanelProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ProbeData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const autoProbed = useRef(false);

    const runProbe = useCallback(async () => {
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const res = await fetch(
                addCacheBuster(env.API_URL + "/api/version/probe"),
                { headers: buildApiHeaders({ token }) }
            );
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();
            if (json.code <= 0 || json.code > 200 || !json.data) {
                throw new Error(json.message || "Failed");
            }
            setData(json.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Network error");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (mode === "auto" && !autoProbed.current) {
            autoProbed.current = true;
            runProbe();
        }
    }, [mode, runProbe]);

    return (
        <div className="space-y-2 pt-1">
            <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => runProbe()}
                disabled={loading}
            >
                {loading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                    <Activity className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t("ui.settings.pullSourceProbe.test")}
            </Button>

            {error && (
                <p className="text-xs text-red-500">{t("ui.settings.pullSourceProbe.error")}: {error}</p>
            )}

            {data && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 bg-muted/30">
                    <ProbeRow
                        label="GitHub"
                        ok={data.github.ok}
                        latencyMs={data.github.latencyMs}
                        isRecommended={data.recommended === "github"}
                        t={t}
                        prefix="github"
                    />
                    <ProbeRow
                        label="CNB"
                        ok={data.cnb.ok}
                        latencyMs={data.cnb.latencyMs}
                        isRecommended={data.recommended === "cnb"}
                        t={t}
                        prefix="cnb"
                    />
                    {data.recommended && (
                        <div className="col-span-2 pt-1 space-y-1">
                            {mode !== "auto" && (
                                <Button
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => onApply(data.recommended)}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    {t("ui.settings.pullSourceProbe.apply", {
                                        source: data.recommended === "github" ? "GitHub" : "CNB",
                                    })}
                                </Button>
                            )}
                            {mode === "auto" && (
                                <p className="text-[11px] text-muted-foreground">
                                    {t("ui.settings.pullSourceProbe.autoHint")}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ProbeRow({
    label,
    ok,
    latencyMs,
    isRecommended,
    t,
    prefix,
}: {
    label: string;
    ok: boolean;
    latencyMs: number;
    isRecommended: boolean;
    t: (key: string, opts?: Record<string, unknown>) => string;
    prefix: string;
}) {
    const color = latencyColor(latencyMs, ok);
    let StatusIcon = XCircle;
    if (ok) {
        StatusIcon = latencyMs < 300 ? CheckCircle2 : AlertCircle;
    }

    return (
        <div className="flex items-center gap-2 text-xs">
            <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className={`font-mono ${color}`}>
                {ok ? `${latencyMs}ms` : t(`ui.settings.pullSourceProbe.${prefix}Fail`)}
            </span>
            {isRecommended && (
                <span className="text-[10px] text-primary font-medium ml-1.5">
                    {t("ui.settings.pullSourceProbe.recommended")}
                </span>
            )}
        </div>
    );
}
