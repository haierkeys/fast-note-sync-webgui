import { X, ExternalLink, Download, FileText, FileCode, Paperclip, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { File } from "@/lib/types/file";
import { buildApiHeaders } from "@/lib/utils/api-headers";


interface FilePreviewProps {
    file: File;
    url: string;
    onClose: () => void;
    variant?: "floating" | "panel";
}

interface PreviewSize {
    width: number;
    height: number;
}

const HTML_EXTENSIONS = ["htm", "html"];
const TEXT_EXTENSIONS = ["txt", "md", "csv", "log", "xml", "yaml", "yml", "ini", "js", "ts", "jsx", "tsx", "py", "sh", "bat", "go", "css", "json", "c", "cpp", "rs", "php"];

export function FilePreview({ file, url, onClose, variant = "floating" }: FilePreviewProps) {
    const { t } = useTranslation();
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
    const isAudio = ['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext);
    const isVideo = ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext);
    const isPdf = ext === 'pdf';
    const isHtml = HTML_EXTENSIONS.includes(ext);
    const isText = TEXT_EXTENSIONS.includes(ext);
    const isCode = isHtml || isText;
    const hasLoadablePreview = isImage || isAudio || isVideo || isPdf || isHtml || isText;
    const isFloating = variant === "floating";

    const fileName = file.path.split('/').pop() || file.path;
    const mediaRef = useRef<HTMLMediaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const resizeStartRef = useRef<{ x: number; y: number; size: PreviewSize } | null>(null);
    const [isLoading, setIsLoading] = useState(hasLoadablePreview);
    const [previewSize, setPreviewSize] = useState<PreviewSize | null>(null);
    const [textContent, setTextContent] = useState("");
    const [textLoadFailed, setTextLoadFailed] = useState(false);

    // 只有实际嵌入的媒体会触发加载事件，其他类型直接显示文件操作。
    useEffect(() => {
        setIsLoading(hasLoadablePreview);
    }, [url, hasLoadablePreview]);

    useEffect(() => {
        if (!isText) {
            setTextContent("");
            setTextLoadFailed(false);
            return;
        }

        const controller = new AbortController();
        setTextContent("");
        setTextLoadFailed(false);

        fetch(url, {
            cache: "no-store",
            signal: controller.signal,
            headers: buildApiHeaders({
                token: localStorage.getItem("token"),
                includeContentType: false,
                includeDomain: false,
                includeLang: false,
            }),
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(content => {
                if (!controller.signal.aborted) setTextContent(content);
            })
            .catch(() => {
                if (!controller.signal.aborted) setTextLoadFailed(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [isText, url]);

    // 加载记忆的音量
    useEffect(() => {
        const savedVolume = localStorage.getItem('preview-volume');
        if (savedVolume && mediaRef.current) {
            mediaRef.current.volume = parseFloat(savedVolume);
        }
    }, [url]);

    // 处理音量变化并保存
    const handleVolumeChange = (e: React.SyntheticEvent<HTMLMediaElement>) => {
        localStorage.setItem('preview-volume', e.currentTarget.volume.toString());
    };

    const handleLoaded = () => {
        setIsLoading(false);
    };

    const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse" || !previewRef.current) return;

        event.preventDefault();
        const { width, height } = previewRef.current.getBoundingClientRect();
        resizeStartRef.current = { x: event.clientX, y: event.clientY, size: { width, height } };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const resizeStart = resizeStartRef.current;
        if (!resizeStart) return;

        const maxWidth = Math.max(320, window.innerWidth - 48);
        const maxHeight = Math.max(200, window.innerHeight * 0.8);
        setPreviewSize({
            width: Math.min(maxWidth, Math.max(320, resizeStart.size.width - (event.clientX - resizeStart.x))),
            height: Math.min(maxHeight, Math.max(200, resizeStart.size.height - (event.clientY - resizeStart.y))),
        });
    };

    const handleResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        resizeStartRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className={`bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isFloating
                    ? "fixed bottom-6 right-6 z-100 w-[320px] sm:w-100 max-h-[80vh]"
                    : "h-full min-h-[420px] w-full"
                }`}
                ref={previewRef}
                style={isFloating ? previewSize ?? undefined : undefined}
            >
                {isFloating && (
                    <div
                        aria-hidden="true"
                        className="absolute -left-1 -top-1 z-20 h-5 w-5 cursor-nwse-resize touch-none"
                        onPointerDown={handleResizeStart}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeEnd}
                        onPointerCancel={handleResizeEnd}
                    />
                )}
                {/* 头部 */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {isImage ? t("ui.file.imagePreview") : isAudio ? t("ui.file.audioPreview") : isVideo ? t("ui.file.videoPreview") : isPdf ? t("ui.file.pdfPreview") : isCode ? t("ui.file.codePreview") : t("ui.file.detail")}
                        </span>
                        <h3 className="text-sm font-semibold truncate pr-2" title={fileName}>
                            {fileName}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl"
                            aria-label={t("ui.file.openInNewWindow")}
                            onClick={() => window.open(url, '_blank')}
                        >
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t("ui.common.close")}
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="relative p-4 flex items-center justify-center bg-black/5 min-h-50 overflow-hidden text-center">
                    {/* 加载动画过度层 */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm pointer-events-none"
                            >
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isImage && (
                        <img
                            key={url}
                            src={url}
                            alt={fileName}
                            className={`max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={handleLoaded}
                            onError={handleLoaded}
                        />
                    )}
                    {isAudio && (
                        <div key={url} className="w-full py-8">
                            <div className="mb-4 flex justify-center">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                    </svg>
                                </div>
                            </div>
                            <audio
                                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                                src={url}
                                controls
                                autoPlay
                                className="w-full"
                                onVolumeChange={handleVolumeChange}
                                onLoadedMetadata={handleLoaded}
                                onCanPlay={handleLoaded}
                                onError={handleLoaded}
                            />
                        </div>
                    )}
                    {isVideo && (
                        <video
                            key={url}
                            ref={mediaRef as React.RefObject<HTMLVideoElement>}
                            src={url}
                            controls
                            autoPlay
                            className={`max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                            onVolumeChange={handleVolumeChange}
                            onLoadedMetadata={handleLoaded}
                            onCanPlay={handleLoaded}
                            onError={handleLoaded}
                        />
                    )}
                    {isPdf && (
                        <iframe
                            key={url}
                            src={url}
                            title={fileName}
                            className="h-[70vh] min-h-80 w-full rounded-lg border-0 bg-white"
                            onLoad={handleLoaded}
                        />
                    )}
                    {isHtml && (
                        <iframe
                            key={url}
                            src={url}
                            title={fileName}
                            sandbox=""
                            referrerPolicy="no-referrer"
                            className="h-[70vh] min-h-80 w-full rounded-lg border-0 bg-white"
                            onLoad={handleLoaded}
                        />
                    )}
                    {isText && !textLoadFailed && (
                        <pre className="max-h-[70vh] min-h-80 w-full overflow-auto rounded-lg border bg-background p-4 text-left font-mono text-xs leading-5 whitespace-pre-wrap break-words">
                            {textContent}
                        </pre>
                    )}
                    {(!isImage && !isAudio && !isVideo && !isPdf && !isHtml && (!isText || textLoadFailed)) && (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/10">
                                {isPdf ? <FileText className="w-10 h-10" /> : isCode ? <FileCode className="w-10 h-10" /> : <Paperclip className="w-10 h-10" />}
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground">{t("ui.file.unsupportedPreview")}</p>
                                <Button
                                    variant="link"
                                    className="text-primary mt-1 h-auto p-0"
                                    onClick={() => window.open(url, '_blank')}
                                >
                                    {t("ui.file.openInNewWindow")}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 底部操作 */}
                <div className="p-3 border-t border-border bg-muted/30 flex justify-end">
                    <Button
                        variant="default"
                        size="sm"
                        className="rounded-xl gap-2 text-xs"
                        onClick={() => window.open(url, '_blank')}
                    >
                        <Download className="h-3.5 w-3.5" />
                        {t("ui.file.browserDownload")}
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
