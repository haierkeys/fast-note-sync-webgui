import "./markdown-editor.css";

import { markdown } from "@codemirror/lang-markdown";
import { EditorView, placeholder as cmPlaceholder } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useTranslation } from "react-i18next";
import remarkGfm from "remark-gfm";

import {
    AlertTriangle, Bug, Check, CheckCircle2, ClipboardList, Flame,
    HelpCircle, Info, List, Pencil, Quote, X, Zap, type LucideIcon,
} from "lucide-react";

import { toast } from "@/components/common/Toast";
import { useTheme } from "@/components/context/theme-context";
import { cn } from "@/lib/utils";
import env from "@/env.ts";

const CALLOUT_ICONS: Record<string, LucideIcon> = {
    "pencil": Pencil,
    "clipboard-list": ClipboardList,
    "info": Info,
    "check-circle-2": CheckCircle2,
    "flame": Flame,
    "check": Check,
    "help-circle": HelpCircle,
    "alert-triangle": AlertTriangle,
    "x": X,
    "zap": Zap,
    "bug": Bug,
    "list": List,
    "quote": Quote,
};

// ─── 类型定义 ───────────────────────────────────────────────

export interface MarkdownEditorRef {
    getValue: () => string;
    setValue: (value: string) => void;
    exportPDF: () => void;
    exportHTML: () => void;
}

interface MarkdownEditorProps {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    placeholder?: string;
    vault?: string;
    fileLinks?: Record<string, string>;
    initialMode?: "edit" | "preview";
    ariaLabel?: string;
    onWikiLinkClick?: (target: string) => void;
}

type AttachmentType = "image" | "video" | "audio" | "file";

// ─── 常量 ───────────────────────────────────────────────────

const EMPTY_FILE_LINKS: Record<string, string> = {};
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|mkv|avi|ogv)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;

// Callout 类型 -> 颜色映射（text 必须显式声明，不能动态拼接，否则 Tailwind JIT 扫描不到）
const CALLOUT_STYLES: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    note:     { border: "border-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-400",   icon: "pencil" },
    abstract: { border: "border-cyan-400",   bg: "bg-cyan-50 dark:bg-cyan-950/30",    text: "text-cyan-400",   icon: "clipboard-list" },
    summary:  { border: "border-cyan-400",   bg: "bg-cyan-50 dark:bg-cyan-950/30",    text: "text-cyan-400",   icon: "clipboard-list" },
    tldr:     { border: "border-cyan-400",   bg: "bg-cyan-50 dark:bg-cyan-950/30",    text: "text-cyan-400",   icon: "clipboard-list" },
    info:     { border: "border-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-400",   icon: "info" },
    todo:     { border: "border-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-400",   icon: "check-circle-2" },
    tip:      { border: "border-teal-400",   bg: "bg-teal-50 dark:bg-teal-950/30",    text: "text-teal-400",   icon: "flame" },
    hint:     { border: "border-teal-400",   bg: "bg-teal-50 dark:bg-teal-950/30",    text: "text-teal-400",   icon: "flame" },
    important:{ border: "border-teal-400",   bg: "bg-teal-50 dark:bg-teal-950/30",    text: "text-teal-400",   icon: "flame" },
    success:  { border: "border-green-400",  bg: "bg-green-50 dark:bg-green-950/30",  text: "text-green-400",  icon: "check" },
    check:    { border: "border-green-400",  bg: "bg-green-50 dark:bg-green-950/30",  text: "text-green-400",  icon: "check" },
    done:     { border: "border-green-400",  bg: "bg-green-50 dark:bg-green-950/30",  text: "text-green-400",  icon: "check" },
    question: { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30",text: "text-yellow-400", icon: "help-circle" },
    help:     { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30",text: "text-yellow-400", icon: "help-circle" },
    faq:      { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30",text: "text-yellow-400", icon: "help-circle" },
    warning:  { border: "border-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-400", icon: "alert-triangle" },
    caution:  { border: "border-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-400", icon: "alert-triangle" },
    attention:{ border: "border-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-400", icon: "alert-triangle" },
    failure:  { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "x" },
    fail:     { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "x" },
    missing:  { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "x" },
    danger:   { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "zap" },
    error:    { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "zap" },
    bug:      { border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-400",    icon: "bug" },
    example:  { border: "border-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30",text: "text-purple-400", icon: "list" },
    quote:    { border: "border-gray-400",   bg: "bg-gray-50 dark:bg-gray-950/30",    text: "text-gray-400",   icon: "quote" },
    cite:     { border: "border-gray-400",   bg: "bg-gray-50 dark:bg-gray-950/30",    text: "text-gray-400",   icon: "quote" },
};

const CM6_BASIC_SETUP = {
    lineNumbers: false,
    foldGutter: false,
    highlightActiveLineGutter: false,
};

const REMARK_PLUGINS: NonNullable<React.ComponentProps<typeof ReactMarkdown>["remarkPlugins"]> = [[remarkGfm, { singleTilde: false }]];
const OBSIDIAN_SANITIZE_SCHEMA = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
    attributes: {
        ...(defaultSchema.attributes ?? {}),
        span: [...(defaultSchema.attributes?.span ?? []), "className", "title"],
        img: [...(defaultSchema.attributes?.img ?? []), "width"],
    },
};

const EXPORT_STYLE = `
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #222;
  line-height: 1.75;
}
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}
img, video {
  max-width: 100%;
  border-radius: 10px;
}
pre {
  overflow-x: auto;
  background: #f6f8fa;
  border-radius: 10px;
  padding: 14px;
}
code {
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  text-align: left;
}
blockquote {
  margin: 0;
  padding-left: 12px;
  border-left: 4px solid #e5e7eb;
  color: #6b7280;
}
mark {
  background: #fef08a;
  padding: 0 2px;
  border-radius: 2px;
}
.callout {
  border-left: 4px solid #60a5fa;
  background: #eff6ff;
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
}
.callout-title {
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: capitalize;
}
.hljs-comment, .hljs-quote { color: #6b7280; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #2563eb; }
.hljs-title, .hljs-section, .hljs-name { color: #16a34a; }
.hljs-string, .hljs-attr, .hljs-template-tag { color: #b45309; }
.hljs-number, .hljs-built_in, .hljs-type { color: #9333ea; }
`;

// ─── 工具函数 ───────────────────────────────────────────────

function buildFileApiUrl(vault: string, path: string, token: string): string {
    const params = new URLSearchParams({ vault, path, token });
    return `${env.API_URL}/api/file?${params.toString()}`;
}

function resolveAttachmentType(path: string): AttachmentType {
    if (IMAGE_EXTENSIONS.test(path)) return "image";
    if (VIDEO_EXTENSIONS.test(path)) return "video";
    if (AUDIO_EXTENSIONS.test(path)) return "audio";
    return "file";
}

function parseAttachmentPathFromHref(href?: string): string {
    if (!href) return "";
    try {
        const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
        const url = new URL(href, base);
        return (url.searchParams.get("path") ?? href).toLowerCase();
    } catch {
        return href.toLowerCase();
    }
}

function escapeMarkdownText(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REHYPE_PLUGINS: any[] = [
    rehypeRaw,
    [rehypeSanitize, OBSIDIAN_SANITIZE_SCHEMA],
    rehypeHighlight,
];

// ─── Obsidian 语法转换 ─────────────────────────────────────

function transformObsidianSyntax(
    content: string,
    vault: string,
    fileLinks: Record<string, string>,
    token: string
): string {
    if (!content) return content;

    let result = content;

    // 0. 保护代码块和行内代码：提取后用占位符替换，转换完再还原
    const codeBlocks: string[] = [];
    const CODE_PLACEHOLDER = "\x00CODE_BLOCK_";

    // 先提取围栏代码块（```...``` 或 ~~~...~~~），按行匹配开闭标记
    result = result.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1\s*$/gm, (match) => {
        const index = codeBlocks.length;
        codeBlocks.push(match);
        return `${CODE_PLACEHOLDER}${index}\x00`;
    });

    // 再提取行内代码（`...` 或 ``...``），避免匹配已提取的占位符
    result = result.replace(/(`+)(?!\x00)(.+?)\1/g, (match) => {
        const index = codeBlocks.length;
        codeBlocks.push(match);
        return `${CODE_PLACEHOLDER}${index}\x00`;
    });

    // 1. 移除 %%comment%% 注释（含跨行）
    result = result.replace(/%%[\s\S]*?%%/g, "");

    // 2. ![[file]] 附件嵌入
    result = result.replace(/!\[\[([^\]]+)\]\]/g, (match, inner: string) => {
        const [rawTarget = "", ...metaParts] = inner.split("|");
        const rawPath = rawTarget.split("#")[0].trim();
        if (!rawPath) return match;

        const resolvedPath = fileLinks[rawPath] || rawPath;
        const apiUrl = buildFileApiUrl(vault, resolvedPath, token);
        const displayName = escapeMarkdownText((metaParts[0] || rawPath).trim());
        const attachmentType = resolveAttachmentType(resolvedPath.toLowerCase());

        if (attachmentType === "image") {
            const widthMatch = metaParts[0]?.match(/^(\d+)$/);
            if (widthMatch) {
                return `<img src="${apiUrl}" alt="${rawPath}" width="${widthMatch[1]}" />`;
            }
            return `![${displayName}](${apiUrl})`;
        }
        if (attachmentType === "video") {
            return `[🎬 ${displayName}](${apiUrl})`;
        }
        if (attachmentType === "audio") {
            return `[🎵 ${displayName}](${apiUrl})`;
        }
        return `[📎 ${displayName}](${apiUrl})`;
    });

    // 3. [[page]] wiki link -> <span class="obsidian-wiki-link">
    result = result.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
        const parts = inner.split("|");
        const display = (parts[1] || parts[0]).trim();
        return `<span class="obsidian-wiki-link" title="${parts[0].trim()}">${display}</span>`;
    });

    // 4. ==highlight== 高亮
    result = result.replace(/==(.*?)==/g, "<mark>$1</mark>");

    // 5. #tag 标签（不匹配行首的标题 #，前缀仅允许空白或行首）
    result = result.replace(/(^|[\s])#([a-zA-Z\u4e00-\u9fff][\w/\u4e00-\u9fff-]*)/gm, (_, prefix, tag) => {
        return `${prefix}<span class="obsidian-tag">#${tag}</span>`;
    });

    // 6. 还原代码块占位符
    result = result.replace(new RegExp(`${CODE_PLACEHOLDER.replace(/\x00/g, "\\x00")}(\\d+)\\x00`, "g"), (_, index) => {
        return codeBlocks[parseInt(index, 10)];
    });

    return result;
}

// ─── Callout 检测工具 ───────────────────────────────────────

const CALLOUT_REGEX = /^\[!(\w+)\]([+-])?\s*(.*)?$/;

function extractCalloutInfo(children: React.ReactNode): {
    type: string;
    title: string;
    foldable: boolean;
    defaultOpen: boolean;
    restChildren: React.ReactNode[];
} | null {
    const childArray = Array.isArray(children) ? children : [children];
    if (childArray.length === 0) return null;

    // 跳过字符串 children（如 "\n"），找到第一个 React 元素
    let firstChildIndex = -1;
    for (let i = 0; i < childArray.length; i++) {
        const child = childArray[i];
        if (child && typeof child === "object" && "props" in child) {
            firstChildIndex = i;
            break;
        }
    }
    if (firstChildIndex === -1) return null;

    const firstChild = childArray[firstChildIndex] as { props: Record<string, unknown> };
    const pChildren = firstChild.props?.children;
    if (!pChildren) return null;

    // 提取第一段的文本内容
    // pChildren 可能是 string 或 array，例如：
    //   "[!note] title\nbody text"
    //   ["\n", "[!note] title", "\nbody text", <br/>, ...]
    let firstText = "";
    let bodyFromSameParagraph: React.ReactNode[] = [];

    if (typeof pChildren === "string") {
        // 整个段落是一个字符串，可能含换行
        const lines = pChildren.split("\n");
        firstText = lines[0].trimStart();
        if (lines.length > 1) {
            const bodyText = lines.slice(1).join("\n").trimStart();
            if (bodyText) bodyFromSameParagraph = [bodyText];
        }
    } else if (Array.isArray(pChildren)) {
        // 找到第一个包含 callout 标记的字符串
        let foundIndex = -1;
        for (let i = 0; i < pChildren.length; i++) {
            const item = pChildren[i];
            if (typeof item === "string") {
                const trimmed = item.trimStart();
                if (trimmed) {
                    // 可能含换行：[!note] title\nbody
                    const lines = trimmed.split("\n");
                    firstText = lines[0];
                    foundIndex = i;
                    if (lines.length > 1) {
                        const bodyText = lines.slice(1).join("\n").trimStart();
                        if (bodyText) bodyFromSameParagraph.push(bodyText);
                    }
                    break;
                }
            }
        }
        // 保留同段中 callout 行之后的其他 children
        if (foundIndex >= 0 && foundIndex + 1 < pChildren.length) {
            bodyFromSameParagraph.push(...pChildren.slice(foundIndex + 1));
        }
    }

    const match = firstText.match(CALLOUT_REGEX);
    if (!match) return null;

    const [, type, foldMarker, customTitle] = match;
    const normalizedType = type.toLowerCase();

    // 合并同段正文和后续 blockquote children
    const restChildren: React.ReactNode[] = [];
    if (bodyFromSameParagraph.length > 0) {
        restChildren.push(<p key="callout-body">{bodyFromSameParagraph}</p>);
    }
    restChildren.push(...childArray.slice(firstChildIndex + 1));

    return {
        type: normalizedType,
        title: customTitle?.trim() || type.charAt(0).toUpperCase() + type.slice(1),
        foldable: foldMarker === "+" || foldMarker === "-",
        defaultOpen: foldMarker !== "-",
        restChildren,
    };
}

// ─── React Markdown 自定义组件 ──────────────────────────────

const markdownComponents: Components = {
    h1: ({ node: _node, className, ...props }) => (
        <h1 className={cn("mt-8 mb-4 text-3xl font-bold first:mt-0", className)} {...props} />
    ),
    h2: ({ node: _node, className, ...props }) => (
        <h2 className={cn("mt-7 mb-3 text-2xl font-semibold first:mt-0", className)} {...props} />
    ),
    h3: ({ node: _node, className, ...props }) => (
        <h3 className={cn("mt-6 mb-3 text-xl font-semibold first:mt-0", className)} {...props} />
    ),
    p: ({ node: _node, className, ...props }) => (
        <p className={cn("my-3 leading-7 text-foreground/90", className)} {...props} />
    ),
    ul: ({ node: _node, className, ...props }) => (
        <ul className={cn("my-3 list-disc pl-6", className)} {...props} />
    ),
    ol: ({ node: _node, className, ...props }) => (
        <ol className={cn("my-3 list-decimal pl-6", className)} {...props} />
    ),
    li: ({ node: _node, className, ...props }) => (
        <li className={cn("my-1.5", className)} {...props} />
    ),
    blockquote: ({ node: _node, className, children, ref: _ref, ...props }) => {
        // 检测 Obsidian Callout 语法
        const callout = extractCalloutInfo(children);
        if (callout) {
            const style = CALLOUT_STYLES[callout.type] || CALLOUT_STYLES.note;
            const IconComponent = CALLOUT_ICONS[style.icon] || Info;
            const titleColor = style.text;

            const titleContent = (
                <div className={cn("flex items-center gap-1.5 font-semibold mb-1 capitalize", titleColor)}>
                    <IconComponent className="size-4 shrink-0" />
                    {callout.title}
                </div>
            );

            if (callout.foldable) {
                return (
                    <details open={callout.defaultOpen} className={cn("my-4 border-l-4 rounded-r-lg px-4 py-3", style.border, style.bg, className)}>
                        <summary className={cn("flex items-center gap-1.5 font-semibold cursor-pointer capitalize", titleColor)}>
                            <IconComponent className="size-4 shrink-0" />
                            {callout.title}
                        </summary>
                        <div className="mt-2">{callout.restChildren}</div>
                    </details>
                );
            }

            return (
                <div className={cn("my-4 border-l-4 rounded-r-lg px-4 py-3", style.border, style.bg, className)}>
                    {titleContent}
                    {callout.restChildren}
                </div>
            );
        }

        // 普通 blockquote
        return (
            <blockquote className={cn("my-4 border-l-4 border-border pl-4 text-muted-foreground", className)} {...props}>
                {children}
            </blockquote>
        );
    },
    hr: ({ node: _node, className, ...props }) => (
        <hr className={cn("my-6 border-border", className)} {...props} />
    ),
    table: ({ node: _node, className, ...props }) => (
        <div className="my-4 overflow-x-auto">
            <table className={cn("w-full border-collapse text-sm", className)} {...props} />
        </div>
    ),
    thead: ({ node: _node, className, ...props }) => (
        <thead className={cn("bg-muted/50", className)} {...props} />
    ),
    th: ({ node: _node, className, ...props }) => (
        <th className={cn("border border-border px-3 py-2 text-left font-semibold", className)} {...props} />
    ),
    td: ({ node: _node, className, ...props }) => (
        <td className={cn("border border-border px-3 py-2 align-top", className)} {...props} />
    ),
    img: ({ node: _node, className, alt, ...props }) => (
        <img
            className={cn("my-4 max-w-full rounded-lg border border-border/60", className)}
            alt={alt ?? ""}
            loading="lazy"
            {...props}
        />
    ),
    a: ({ node: _node, href, children, className, ...props }) => {
        const attachmentType = resolveAttachmentType(parseAttachmentPathFromHref(href));

        if (href && attachmentType === "video") {
            return <video src={href} controls className="my-4 w-full rounded-lg border border-border/60" />;
        }
        if (href && attachmentType === "audio") {
            return <audio src={href} controls className="my-4 w-full" />;
        }

        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={cn("text-primary underline underline-offset-4 hover:opacity-80", className)}
                {...props}
            >
                {children}
            </a>
        );
    },
    pre: ({ node: _node, className, ...props }) => (
        <pre className={cn("my-4 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-4", className)} {...props} />
    ),
    code: ({ node: _node, className, children, ...props }) => {
        const value = String(children);
        const isInline = !className && !value.includes("\n");

        if (isInline) {
            return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]" {...props}>
                    {children}
                </code>
            );
        }

        return (
            <code className={cn("text-sm", className)} {...props}>
                {children}
            </code>
        );
    },
    input: ({ node: _node, className, ...props }) => {
        if (props.type === "checkbox") {
            return <input {...props} disabled className={cn("mr-2 accent-primary", className)} />;
        }
        return <input {...props} className={className} />;
    },
};

// ─── 共用渲染器 ─────────────────────────────────────────────

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={markdownComponents}
            allowedElements={undefined}
            unwrapDisallowed
        >
            {content}
        </ReactMarkdown>
    );
});

// ─── 编辑器组件 ─────────────────────────────────────────────

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
    (
        {
            value,
            onChange,
            readOnly = false,
            placeholder = "",
            vault = "",
            fileLinks = EMPTY_FILE_LINKS,
            initialMode = "edit",
            ariaLabel,
            onWikiLinkClick,
        },
        ref
    ) => {
        const { resolvedTheme } = useTheme();
        const { t } = useTranslation();
        const editorViewRef = useRef<EditorView | null>(null);
        const valueRef = useRef(value);
        const editorAriaLabel = ariaLabel ?? t("ui.note.editNote");
        const tokenRef = useRef(typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "");
        const mode = initialMode;

        const handlePreviewClick = useCallback((e: React.MouseEvent) => {
            const el = (e.target as HTMLElement).closest('.obsidian-wiki-link');
            if (!el) return;
            e.preventDefault();
            const target = el.getAttribute('title');
            if (target && onWikiLinkClick) {
                onWikiLinkClick(target);
            }
        }, [onWikiLinkClick]);

        const highlightClass = resolvedTheme === "dark"
            ? "[&_.hljs-comment]:text-zinc-500 [&_.hljs-quote]:text-zinc-500 [&_.hljs-keyword]:text-sky-300 [&_.hljs-selector-tag]:text-sky-300 [&_.hljs-literal]:text-sky-300 [&_.hljs-title]:text-emerald-300 [&_.hljs-section]:text-emerald-300 [&_.hljs-name]:text-emerald-300 [&_.hljs-string]:text-amber-300 [&_.hljs-attr]:text-amber-300 [&_.hljs-template-tag]:text-amber-300 [&_.hljs-number]:text-fuchsia-300 [&_.hljs-built_in]:text-violet-300 [&_.hljs-type]:text-violet-300"
            : "[&_.hljs-comment]:text-zinc-500 [&_.hljs-quote]:text-zinc-500 [&_.hljs-keyword]:text-blue-600 [&_.hljs-selector-tag]:text-blue-600 [&_.hljs-literal]:text-blue-600 [&_.hljs-title]:text-green-700 [&_.hljs-section]:text-green-700 [&_.hljs-name]:text-green-700 [&_.hljs-string]:text-amber-700 [&_.hljs-attr]:text-amber-700 [&_.hljs-template-tag]:text-amber-700 [&_.hljs-number]:text-purple-700 [&_.hljs-built_in]:text-purple-700 [&_.hljs-type]:text-purple-700";

        // 外部 value 变化时同步 ref
        useEffect(() => {
            valueRef.current = value;
        }, [value]);

        // 刷新 token
        useEffect(() => {
            tokenRef.current = typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
        }, [vault]);

        useEffect(() => {
            return () => {
                editorViewRef.current = null;
            };
        }, []);

        const editorExtensions = useMemo(() => {
            const extensions = [
                markdown(),
                EditorView.lineWrapping,
                EditorView.editable.of(!readOnly),
                EditorView.contentAttributes.of({ "aria-label": editorAriaLabel }),
            ];
            if (placeholder) {
                extensions.push(cmPlaceholder(placeholder));
            }
            return extensions;
        }, [editorAriaLabel, placeholder, readOnly]);

        const handleEditorChange = useCallback(
            (nextValue: string) => {
                valueRef.current = nextValue;
                onChange?.(nextValue);
            },
            [onChange]
        );

        const getCurrentValue = useCallback((): string => {
            const view = editorViewRef.current;
            if (view) {
                return view.state.doc.toString();
            }
            return valueRef.current;
        }, []);

        const setCurrentValue = useCallback((nextValue: string) => {
            valueRef.current = nextValue;

            const view = editorViewRef.current;
            if (!view) return;
            if (view.state.doc.toString() === nextValue) return;

            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: nextValue },
            });
        }, []);

        // 预览转换：首次同步计算（避免白屏），后续变化 debounce 150ms
        const [previewMarkdown, setPreviewMarkdown] = useState(() =>
            mode === "preview" ? transformObsidianSyntax(value, vault, fileLinks, tokenRef.current) : ""
        );

        useEffect(() => {
            if (mode !== "preview") return;
            const timer = setTimeout(() => {
                setPreviewMarkdown(transformObsidianSyntax(value, vault, fileLinks, tokenRef.current));
            }, 150);
            return () => clearTimeout(timer);
        }, [mode, value, vault, fileLinks]);

        const handleExportHTML = useCallback(() => {
            try {
                const markdownValue = getCurrentValue();
                const transformed = transformObsidianSyntax(markdownValue, vault, fileLinks, tokenRef.current);
                const rendered = renderToStaticMarkup(
                    <main>
                        <MarkdownRenderer content={transformed} />
                    </main>
                );

                const htmlDocument = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Export</title>
<style>${EXPORT_STYLE}</style>
</head>
<body>${rendered}</body>
</html>`;

                const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `note-${new Date().toISOString().replace(/[:.]/g, "-")}.html`;
                anchor.click();
                URL.revokeObjectURL(url);
                toast.success(t("ui.note.exportHtmlSuccess", { defaultValue: "HTML exported successfully" }));
            } catch {
                toast.error(t("ui.note.exportHtmlFailed", { defaultValue: "Failed to export HTML" }));
            }
        }, [fileLinks, getCurrentValue, t, vault]);

        const handleExportPDF = useCallback(() => {
            toast.info(t("ui.note.exportPdfPlanned"));
        }, [t]);

        useImperativeHandle(
            ref,
            () => ({
                getValue: getCurrentValue,
                setValue: setCurrentValue,
                exportPDF: handleExportPDF,
                exportHTML: handleExportHTML,
            }),
            [getCurrentValue, handleExportHTML, handleExportPDF, setCurrentValue]
        );

        if (mode === "preview") {
            return (
                <div className={cn("markdown-preview h-full overflow-y-auto", highlightClass)} onClick={handlePreviewClick}>
                    <article className="mx-auto max-w-[900px] px-5 py-10">
                        <MarkdownRenderer content={previewMarkdown} />
                    </article>
                </div>
            );
        }

        return (
            <div className="h-full [&_.cm-editor]:h-full [&_.cm-gutters]:h-full [&_.cm-scroller]:overflow-auto">
                <CodeMirror
                    value={value}
                    height="100%"
                    theme={resolvedTheme === "dark" ? "dark" : "light"}
                    extensions={editorExtensions}
                    basicSetup={CM6_BASIC_SETUP}
                    onChange={handleEditorChange}
                    onCreateEditor={(view) => {
                        editorViewRef.current = view;
                    }}
                    className="h-full text-sm"
                />
            </div>
        );
    }
);

MarkdownEditor.displayName = "MarkdownEditor";
