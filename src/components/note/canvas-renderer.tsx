import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { CanvasNode, CanvasEdge, Viewport, CANVAS_COLORS } from "@/lib/types/canvas";
import { MarkdownRenderer } from "./markdown-editor";

interface CanvasRendererProps {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    vault: string;
    viewport: Viewport;
    onViewportChange: (v: Viewport) => void;
    onNodeClick?: (node: CanvasNode) => void;
    onWikiLinkClick?: (target: string) => void;
}

function resolveColor(color?: string): string | undefined {
    if (!color) return undefined;
    return CANVAS_COLORS[color] ?? color;
}

function getAnchorPoint(node: CanvasNode, side: string): { x: number; y: number } {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    switch (side) {
        case "top": return { x: cx, y: node.y };
        case "bottom": return { x: cx, y: node.y + node.height };
        case "left": return { x: node.x, y: cy };
        case "right": return { x: node.x + node.width, y: cy };
        default: return { x: cx, y: cy };
    }
}

function getControlOffset(side: string, distance: number): { dx: number; dy: number } {
    switch (side) {
        case "top": return { dx: 0, dy: -distance };
        case "bottom": return { dx: 0, dy: distance };
        case "left": return { dx: -distance, dy: 0 };
        case "right": return { dx: distance, dy: 0 };
        default: return { dx: 0, dy: 0 };
    }
}

// --- Edge Component ---

function CanvasEdgeComponent({
    edge,
    nodeMap,
}: {
    edge: CanvasEdge;
    nodeMap: Map<string, CanvasNode>;
}) {
    const fromNode = nodeMap.get(edge.fromNode);
    const toNode = nodeMap.get(edge.toNode);
    if (!fromNode || !toNode) return null;

    const from = getAnchorPoint(fromNode, edge.fromSide);
    const to = getAnchorPoint(toNode, edge.toSide);

    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const dist = Math.min(dx / 2, dy / 2, 100);
    const offset = Math.max(dist, 30);

    const cp1 = getControlOffset(edge.fromSide, offset);
    const cp2 = getControlOffset(edge.toSide, offset);

    const pathD = `M ${from.x} ${from.y} C ${from.x + cp1.dx} ${from.y + cp1.dy}, ${to.x + cp2.dx} ${to.y + cp2.dy}, ${to.x} ${to.y}`;
    const color = resolveColor(edge.color);
    const edgeId = `edge-${edge.id}`;
    const showToArrow = edge.toEnd !== "none";
    const showFromArrow = edge.fromEnd === "arrow";

    return (
        <g>
            <defs>
                {showToArrow && (
                    <marker
                        id={`${edgeId}-to`}
                        markerWidth="12"
                        markerHeight="10"
                        refX="11"
                        refY="5"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <polygon points="0 0, 12 5, 0 10" fill={color ?? "currentColor"} />
                    </marker>
                )}
                {showFromArrow && (
                    <marker
                        id={`${edgeId}-from`}
                        markerWidth="12"
                        markerHeight="10"
                        refX="1"
                        refY="5"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                    >
                        <polygon points="12 0, 0 5, 12 10" fill={color ?? "currentColor"} />
                    </marker>
                )}
            </defs>
            <path
                d={pathD}
                className="canvas-edge-path"
                style={color ? { stroke: color } : undefined}
                markerEnd={showToArrow ? `url(#${edgeId}-to)` : undefined}
                markerStart={showFromArrow ? `url(#${edgeId}-from)` : undefined}
            />
            {edge.label && (
                <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2}
                    className="canvas-edge-label"
                    dy="-6"
                >
                    {edge.label}
                </text>
            )}
        </g>
    );
}

// --- Node Component ---

function CanvasNodeComponent({
    node,
    onNodeClick,
    onWikiLinkClick,
}: {
    node: CanvasNode;
    onNodeClick?: (node: CanvasNode) => void;
    onWikiLinkClick?: (target: string) => void;
}) {
    const color = resolveColor(node.color);
    const nodeStyle = color
        ? { borderColor: color, backgroundColor: `${color}18` }
        : undefined;

    if (node.type === "group") {
        return (
            <div
                className="canvas-group"
                style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    ...(color ? { borderColor: color, background: `${color}15` } : {}),
                }}
            >
                {node.label && <span className="canvas-group-label">{node.label}</span>}
            </div>
        );
    }

    const handleClick = () => {
        if (node.type === "file" && node.file && onWikiLinkClick) {
            onWikiLinkClick(node.file);
        } else if (node.type === "link" && node.url) {
            window.open(node.url, "_blank", "noopener,noreferrer");
        }
        onNodeClick?.(node);
    };

    return (
        <div
            className="canvas-node"
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                ...nodeStyle,
            }}
            onClick={node.type !== "text" ? handleClick : undefined}
        >
            {node.type === "text" && (
                <div className="canvas-node-text markdown-preview">
                    <MarkdownRenderer content={node.text ?? ""} />
                </div>
            )}
            {node.type === "file" && (
                <div className="canvas-node-file">
                    <FileText className="canvas-node-file-icon" />
                    <span className="canvas-node-file-name">
                        {node.file?.split("/").pop() ?? node.file}
                    </span>
                </div>
            )}
            {node.type === "link" && (
                <div className="canvas-node-link">
                    <ExternalLink className="canvas-node-link-icon" />
                    <span className="canvas-node-link-url">{node.url}</span>
                </div>
            )}
        </div>
    );
}

// --- Main Renderer ---

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

export function CanvasRenderer({
    nodes,
    edges,
    viewport,
    onViewportChange,
    onNodeClick,
    onWikiLinkClick,
}: CanvasRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
    const pointerCacheRef = useRef<PointerEvent[]>([]);
    const lastPinchDistRef = useRef<number | null>(null);

    const nodeMap = useMemo(() => {
        const map = new Map<string, CanvasNode>();
        for (const n of nodes) map.set(n.id, n);
        return map;
    }, [nodes]);

    // Separate groups (render first) from other nodes
    const groups = useMemo(() => nodes.filter(n => n.type === "group"), [nodes]);
    const regularNodes = useMemo(() => nodes.filter(n => n.type !== "group"), [nodes]);

    const svgBounds = useMemo(() => {
        if (nodes.length === 0) return { minX: 0, minY: 0, w: 100, h: 100 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        }
        const pad = 500;
        return {
            minX: minX - pad,
            minY: minY - pad,
            w: maxX - minX + pad * 2,
            h: maxY - minY + pad * 2,
        };
    }, [nodes]);

    const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            // Zoom centered on mouse position
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = clampZoom(viewport.zoom * factor);
            const ratio = newZoom / viewport.zoom;
            onViewportChange({
                x: mx - (mx - viewport.x) * ratio,
                y: my - (my - viewport.y) * ratio,
                zoom: newZoom,
            });
        } else {
            // Pan
            onViewportChange({
                ...viewport,
                x: viewport.x - e.deltaX,
                y: viewport.y - e.deltaY,
            });
        }
    }, [viewport, onViewportChange]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        const cache = pointerCacheRef.current;
        cache.push(e.nativeEvent);

        if (cache.length === 1) {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }
    }, [viewport.x, viewport.y]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const cache = pointerCacheRef.current;
        const idx = cache.findIndex(p => p.pointerId === e.pointerId);
        if (idx >= 0) cache[idx] = e.nativeEvent;

        if (cache.length === 2) {
            // Pinch zoom
            const d = Math.hypot(
                cache[0].clientX - cache[1].clientX,
                cache[0].clientY - cache[1].clientY
            );
            if (lastPinchDistRef.current !== null) {
                const factor = d / lastPinchDistRef.current;
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    const mx = (cache[0].clientX + cache[1].clientX) / 2 - rect.left;
                    const my = (cache[0].clientY + cache[1].clientY) / 2 - rect.top;
                    const newZoom = clampZoom(viewport.zoom * factor);
                    const ratio = newZoom / viewport.zoom;
                    onViewportChange({
                        x: mx - (mx - viewport.x) * ratio,
                        y: my - (my - viewport.y) * ratio,
                        zoom: newZoom,
                    });
                }
            }
            lastPinchDistRef.current = d;
        } else if (cache.length === 1 && dragStartRef.current) {
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            onViewportChange({
                ...viewport,
                x: dragStartRef.current.vx + dx,
                y: dragStartRef.current.vy + dy,
            });
        }
    }, [viewport, onViewportChange]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        const cache = pointerCacheRef.current;
        const idx = cache.findIndex(p => p.pointerId === e.pointerId);
        if (idx >= 0) cache.splice(idx, 1);

        if (cache.length < 2) {
            lastPinchDistRef.current = null;
        }
        if (cache.length === 0) {
            setIsDragging(false);
            dragStartRef.current = null;
        }
    }, []);

    // Prevent default wheel on the container to avoid page scroll
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const prevent = (e: WheelEvent) => e.preventDefault();
        el.addEventListener("wheel", prevent, { passive: false });
        return () => el.removeEventListener("wheel", prevent);
    }, []);

    return (
        <div
            ref={containerRef}
            className={`canvas-container${isDragging ? " is-dragging" : ""}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div
                className="canvas-transform-layer"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                }}
            >
                {/* Layer 1: Groups (lowest z) */}
                {groups.map(node => (
                    <CanvasNodeComponent
                        key={node.id}
                        node={node}
                        onNodeClick={onNodeClick}
                        onWikiLinkClick={onWikiLinkClick}
                    />
                ))}

                {/* Layer 2: SVG Edges */}
                <svg
                    className="canvas-edge-layer"
                    style={{
                        left: svgBounds.minX,
                        top: svgBounds.minY,
                        width: svgBounds.w,
                        height: svgBounds.h,
                        color: "hsl(var(--foreground))",
                    }}
                    viewBox={`${svgBounds.minX} ${svgBounds.minY} ${svgBounds.w} ${svgBounds.h}`}
                >
                    {edges.map(edge => (
                        <CanvasEdgeComponent
                            key={edge.id}
                            edge={edge}
                            nodeMap={nodeMap}
                        />
                    ))}
                </svg>

                {/* Layer 3: Regular Nodes */}
                {regularNodes.map(node => (
                    <CanvasNodeComponent
                        key={node.id}
                        node={node}
                        onNodeClick={onNodeClick}
                        onWikiLinkClick={onWikiLinkClick}
                    />
                ))}
            </div>
        </div>
    );
}
