import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { useFileHandle } from "@/components/api-handle/file-handle";
import { CanvasData, CanvasNode, Viewport } from "@/lib/types/canvas";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CanvasRenderer } from "./canvas-renderer";
import "./canvas-viewer.css";

interface CanvasViewerProps {
    vault: string;
    note?: { path: string; pathHash?: string };
    onBack: () => void;
    onWikiLinkClick?: (target: string) => void;
}

function parseCanvasData(raw: string): CanvasData {
    const data = JSON.parse(raw);
    return {
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        edges: Array.isArray(data.edges) ? data.edges : [],
    };
}

function computeFitViewport(
    nodes: CanvasNode[],
    containerWidth: number,
    containerHeight: number,
): Viewport {
    if (nodes.length === 0 || containerWidth === 0 || containerHeight === 0) {
        return { x: 0, y: 0, zoom: 1 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const pad = 40;
    const zoom = Math.min(
        (containerWidth - pad * 2) / contentW,
        (containerHeight - pad * 2) / contentH,
        1.5,
    );
    const clampedZoom = Math.max(0.1, zoom);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return {
        x: containerWidth / 2 - cx * clampedZoom,
        y: containerHeight / 2 - cy * clampedZoom,
        zoom: clampedZoom,
    };
}

export function CanvasViewer({
    vault,
    note,
    onBack,
    onWikiLinkClick,
}: CanvasViewerProps) {
    const { getRawFileUrl } = useFileHandle();
    const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
    const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Dynamically compute available height since parent chain has no fixed height
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const updateHeight = () => {
            const rect = el.getBoundingClientRect();
            // Fill from current position to viewport bottom, minus bottom padding
            const available = window.innerHeight - rect.top - 16;
            el.style.height = `${Math.max(200, available)}px`;
        };
        updateHeight();
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
    }, []);

    // Measure canvas content area with ResizeObserver
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const measure = () => {
            const { clientWidth, clientHeight } = el;
            if (clientWidth > 0 && clientHeight > 0) {
                setContainerSize(prev => {
                    if (prev.w === clientWidth && prev.h === clientHeight) return prev;
                    return { w: clientWidth, h: clientHeight };
                });
            }
        };
        // Delay first measure to after height is set
        requestAnimationFrame(measure);
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Load canvas file via file API
    useEffect(() => {
        if (!note) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const url = getRawFileUrl(vault, note.path, note.pathHash);
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(text => {
                if (cancelled) return;
                try {
                    const data = parseCanvasData(text);
                    setCanvasData(data);
                } catch {
                    setError("Canvas JSON parse error");
                    setCanvasData(null);
                }
            })
            .catch(err => {
                if (cancelled) return;
                setError(err.message ?? "Failed to load canvas");
                setCanvasData(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [vault, note, getRawFileUrl]);

    // Fit to view when data loads or container resizes
    useEffect(() => {
        if (canvasData && containerSize.w > 0 && containerSize.h > 0) {
            setViewport(computeFitViewport(canvasData.nodes, containerSize.w, containerSize.h));
        }
    }, [canvasData, containerSize]);

    const handleFitView = useCallback(() => {
        if (canvasData && containerSize.w > 0) {
            setViewport(computeFitViewport(canvasData.nodes, containerSize.w, containerSize.h));
        }
    }, [canvasData, containerSize]);

    const handleZoomIn = useCallback(() => {
        setViewport(v => {
            const newZoom = Math.min(3.0, v.zoom * 1.2);
            const ratio = newZoom / v.zoom;
            const cx = containerSize.w / 2;
            const cy = containerSize.h / 2;
            return {
                x: cx - (cx - v.x) * ratio,
                y: cy - (cy - v.y) * ratio,
                zoom: newZoom,
            };
        });
    }, [containerSize]);

    const handleZoomOut = useCallback(() => {
        setViewport(v => {
            const newZoom = Math.max(0.1, v.zoom * 0.8);
            const ratio = newZoom / v.zoom;
            const cx = containerSize.w / 2;
            const cy = containerSize.h / 2;
            return {
                x: cx - (cx - v.x) * ratio,
                y: cy - (cy - v.y) * ratio,
                zoom: newZoom,
            };
        });
    }, [containerSize]);

    const filename = note?.path?.split("/").pop() ?? "canvas";

    return (
        <div ref={wrapperRef} className="w-full flex flex-col">
            {/* Toolbar */}
            <div className="canvas-toolbar">
                <div className="canvas-toolbar-left">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0 rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                    >
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <span className="canvas-toolbar-title">{filename}</span>
                </div>
                <div className="canvas-toolbar-right">
                    <span className="canvas-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
                    <Tooltip content="Zoom Out" side="bottom" delay={200}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomOut}
                            className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                        >
                            <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    </Tooltip>
                    <Tooltip content="Zoom In" side="bottom" delay={200}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomIn}
                            className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                        >
                            <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    </Tooltip>
                    <Tooltip content="Fit to View" side="bottom" delay={200}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleFitView}
                            className="rounded-lg sm:rounded-xl h-7 w-7 sm:h-10 sm:w-10"
                        >
                            <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Content */}
            <div ref={contentRef} className="flex-1 min-h-0">
                {loading && (
                    <div className="canvas-loading">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                            <span>Loading...</span>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="canvas-error">
                        <span>{error}</span>
                    </div>
                )}
                {!loading && !error && canvasData && canvasData.nodes.length === 0 && (
                    <div className="canvas-empty">
                        <span>Empty canvas</span>
                    </div>
                )}
                {!loading && !error && canvasData && canvasData.nodes.length > 0 && (
                    <CanvasRenderer
                        nodes={canvasData.nodes}
                        edges={canvasData.edges}
                        vault={vault}
                        viewport={viewport}
                        onViewportChange={setViewport}
                        onWikiLinkClick={onWikiLinkClick}
                    />
                )}
            </div>
        </div>
    );
}
