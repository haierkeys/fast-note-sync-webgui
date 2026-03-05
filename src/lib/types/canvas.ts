export interface CanvasData {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
}

export interface CanvasNode {
    id: string;
    type: "text" | "file" | "link" | "group";
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    file?: string;
    url?: string;
    label?: string;
    color?: string;
}

export interface CanvasEdge {
    id: string;
    fromNode: string;
    fromSide: "top" | "right" | "bottom" | "left";
    toNode: string;
    toSide: "top" | "right" | "bottom" | "left";
    fromEnd?: "none" | "arrow";
    toEnd?: "none" | "arrow";
    color?: string;
    label?: string;
}

export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export const CANVAS_COLORS: Record<string, string> = {
    "1": "#fb464c",
    "2": "#e9973f",
    "3": "#e0de71",
    "4": "#44cf6e",
    "5": "#53dfdd",
    "6": "#a882ff",
};
