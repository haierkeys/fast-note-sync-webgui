import { addCacheBuster } from "@/lib/utils/cache-buster";
import { FileListResponse } from "@/lib/types/file";
import { toast } from "@/components/common/Toast";
import { getBrowserLang } from "@/i18n/utils";
import { useCallback, useMemo } from "react";
import { Folder } from "@/lib/types/folder";
import env from "@/env.ts";


/**
 * 附件 API 处理 Hook
 * 提供附件列表查询和删除功能
 */
export function useFileHandle() {
    const getHeaders = useCallback(() => {
        const currentToken = localStorage.getItem("token") || "";
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`,
            Domain: window.location.origin,
            Lang: getBrowserLang(),
        };
    }, []);

    const handleTokenExpired = useCallback(() => {
        localStorage.removeItem("token");
        window.location.reload();
    }, []);

    /**
     * 获取附件列表
     * @param vault 仓库名称
     * @param page 页码
     * @param pageSize 每页条数
     * @param isRecycle 是否为回收站
     * @param keyword 搜索关键词
     * @param sortBy 排序字段: mtime(默认), ctime, path
     * @param sortOrder 排序方向: desc(默认), asc
     * @param callback 成功回调
     */
    const handleFileList = useCallback(async (
        vault: string,
        page: number,
        pageSize: number,
        isRecycle: boolean = false,
        keyword: string = "",
        sortBy: string = "mtime",
        sortOrder: string = "desc",
        callback: (data: FileListResponse | null) => void
    ) => {
        try {
            const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
            const pageStr = Math.floor(page).toString();
            const pageSizeStr = Math.floor(pageSize).toString();
            let url = `${apiUrl}/api/files?vault=${encodeURIComponent(vault)}&page=${pageStr}&pageSize=${pageSizeStr}`;

            if (isRecycle) {
                url += `&isRecycle=1`;
            }
            if (keyword) {
                url += `&keyword=${encodeURIComponent(keyword)}`;
            }
            if (sortBy && sortBy !== "mtime") {
                url += `&sortBy=${sortBy}`;
            }
            if (sortOrder && sortOrder !== "desc") {
                url += `&sortOrder=${sortOrder}`;
            }

            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: getHeaders(),
            });

            if (!response.ok) {
                if (response.status === 508) {
                    handleTokenExpired();
                } else {
                    toast.error("Network response was not ok");
                }
                callback(null);
                return;
            }

            const res: { code: number; message: string; data?: FileListResponse } = await response.json();

            if (res.code > 0 && res.code <= 200) {
                const data = res.data || { list: [], pager: { page: 1, pageSize: pageSize, totalRows: 0, totalPages: 0 } };
                callback(data);
            } else {
                if (res.code === 508) {
                    handleTokenExpired();
                } else {
                    toast.error(res.message);
                }
                callback(null);
            }
        } catch (error: unknown) {
            console.error("handleFileList error:", error);
            toast.error(error instanceof Error ? error.message : String(error));
            callback(null);
        }
    }, [getHeaders, handleTokenExpired]);

    /**
     * 删除附件
     * @param vault 仓库名称
     * @param path 文件路径
     * @param pathHash 路径哈希值
     * @param callback 成功回调
     */
    const handleDeleteFile = useCallback(async (
        vault: string,
        path: string,
        pathHash: string | undefined,
        callback: () => void
    ) => {
        try {
            const body = {
                vault,
                path,
                pathHash,
            };
            const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
            const response = await fetch(addCacheBuster(`${apiUrl}/api/file`), {
                method: "DELETE",
                body: JSON.stringify(body),
                headers: getHeaders(),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const res: { code: number; message: string; details?: string[] } = await response.json();

            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message);
                callback();
            } else {
                toast.error(res.message + (res.details ? ": " + res.details.join(", ") : ""));
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    }, [getHeaders]);

    /**
     * 恢复附件
     * @param vault 仓库名称
     * @param path 文件路径
     * @param pathHash 路径哈希值
     * @param callback 成功回调
     */
    const handleRestoreFile = useCallback(async (
        vault: string,
        path: string,
        pathHash: string | undefined,
        callback: () => void
    ) => {
        try {
            const body = {
                vault,
                path,
                pathHash,
            };
            const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
            const response = await fetch(addCacheBuster(`${apiUrl}/api/file/restore`), {
                method: "PUT",
                body: JSON.stringify(body),
                headers: getHeaders(),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const res: { code: number; message: string; details?: string[] } = await response.json();

            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message);
                callback();
            } else {
                toast.error(res.message + (res.details ? ": " + res.details.join(", ") : ""));
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    }, [getHeaders]);

    /**
     * 获取文件原始内容 URL (带 token)
     */
    const getRawFileUrl = useCallback((vault: string, path: string, pathHash?: string) => {
        const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
        const currentToken = localStorage.getItem("token") || "";
        const lang = getBrowserLang();
        let url = `${apiUrl}/api/file?vault=${encodeURIComponent(vault)}&path=${encodeURIComponent(path)}&token=${encodeURIComponent(currentToken)}&lang=${lang}`;
        if (pathHash) {
            url += `&pathHash=${pathHash}`;
        }
        return url;
    }, []);

    /**
     * 获取仓库下的文件夹列表
     */
    const handleFolderList = useCallback(async (vault: string, path: string = "", pathHash: string = "", callback: (data: Folder[] | null) => void) => {
        try {
            const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
            let url = `${apiUrl}/api/folders?vault=${encodeURIComponent(vault)}`;
            if (path) {
                url += `&path=${encodeURIComponent(path)}`;
            }
            if (pathHash) {
                url += `&path_hash=${encodeURIComponent(pathHash)}`;
            }
            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                if (response.status === 508) {
                    handleTokenExpired();
                } else {
                    toast.error("Network response was not ok");
                }
                callback(null);
                return;
            }
            const res: { code: number; message: string; data?: Folder[] } = await response.json()
            if (res.code > 0 && res.code <= 200) {
                callback(res.data || [])
            } else {
                if (res.code === 508) {
                    handleTokenExpired();
                } else {
                    toast.error(res.message);
                }
                callback(null);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null);
        }
    }, [getHeaders, handleTokenExpired])

    /**
     * 获取目录下附件列表
     */
    const handleFolderFiles = useCallback(async (
        vault: string,
        path: string = "",
        pathHash: string = "",
        page: number,
        pageSize: number,
        sortBy: string = "mtime",
        sortOrder: string = "desc",
        callback: (data: FileListResponse | null) => void
    ) => {
        try {
            const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
            const pageStr = Math.floor(page).toString();
            const pageSizeStr = Math.floor(pageSize).toString();
            let url = `${apiUrl}/api/folder/files?vault=${encodeURIComponent(vault)}&page=${pageStr}&pageSize=${pageSizeStr}`;
            if (path) {
                url += `&path=${encodeURIComponent(path)}`;
            }
            if (pathHash) {
                url += `&path_hash=${encodeURIComponent(pathHash)}`;
            }
            if (sortBy) url += `&sortBy=${sortBy}`;
            if (sortOrder) url += `&sortOrder=${sortOrder}`;

            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                if (response.status === 508) {
                    handleTokenExpired();
                } else {
                    toast.error("Network response was not ok");
                }
                callback(null);
                return;
            }
            const res: { code: number; message: string; data?: FileListResponse } = await response.json()
            if (res.code > 0 && res.code <= 200) {
                const data = res.data || { list: [], pager: { page, pageSize, totalRows: 0, totalPages: 0 } };
                if (!data.list) data.list = [];
                callback(data)
            } else {
                if (res.code === 508) {
                    handleTokenExpired();
                } else {
                    toast.error(res.message);
                }
                callback(null);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null);
        }
    }, [getHeaders, handleTokenExpired])

    return useMemo(() => ({
        handleFileList,
        handleDeleteFile,
        handleRestoreFile,
        getRawFileUrl,
        handleFolderList,
        handleFolderFiles,
    }), [
        handleFileList,
        handleDeleteFile,
        handleRestoreFile,
        getRawFileUrl,
        handleFolderList,
        handleFolderFiles,
    ]);
}
