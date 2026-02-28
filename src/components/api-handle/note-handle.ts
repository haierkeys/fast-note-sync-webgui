import { Note, NoteDetail, NoteResponse, NoteHistoryDetail, NoteHistoryListResponse, NoteListResponse } from "@/lib/types/note";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { toast } from "@/components/common/Toast";
import { getBrowserLang } from "@/i18n/utils";
import { useCallback, useMemo } from "react";
import { Folder } from "@/lib/types/folder";
import env from "@/env.ts";


export function useNoteHandle() {
    const token = localStorage.getItem("token")!

    const getHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        Domain: window.location.origin,
        Lang: getBrowserLang(),
    }), [token])

    const handleTokenExpired = useCallback(() => {
        localStorage.removeItem("token")
        window.location.reload()
    }, [])

    const handleNoteList = useCallback(async (
        vault: string,
        page: number,
        pageSize: number,
        keyword: string = "",
        isRecycle: boolean = false,
        searchMode: string = "path",
        searchContent: boolean = false,
        sortBy: string = "mtime",
        sortOrder: string = "desc",
        callback: (data: { list: Note[], pager: { page: number, pageSize: number, totalRows: number } } | null) => void
    ) => {
        try {
            // Ensure page and pageSize are integers strings
            const pageStr = Math.floor(page).toString();
            const pageSizeStr = Math.floor(pageSize).toString();

            let url = `${env.API_URL}/api/notes?vault=${encodeURIComponent(vault)}&page=${pageStr}&pageSize=${pageSizeStr}`;
            if (keyword) {
                url += `&keyword=${encodeURIComponent(keyword)}`;
            }
            if (isRecycle) {
                url += `&isRecycle=1`;
            }
            if (searchMode && searchMode !== "path") {
                url += `&searchMode=${searchMode}`;
            }
            if (searchContent) {
                url += `&searchContent=1`;
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
            })
            if (!response.ok) {
                if (response.status === 508) {
                    handleTokenExpired()
                } else {
                    toast.error("Network response was not ok")
                }
                callback(null)
                return
            }
            const res: NoteResponse<{ list: Note[], pager: { page: number, pageSize: number, totalRows: number } }> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                const data = res.data || { list: [], pager: { page: 1, pageSize: pageSize, totalRows: 0 } };
                if (!data.list) data.list = [];
                callback(data)
            } else {
                if (res.code === 508) {
                    handleTokenExpired()
                } else {
                    toast.error(res.message)
                }
                callback(null)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null)
        }
    }, [getHeaders, handleTokenExpired])


    const handleGetNote = useCallback(async (vault: string, path: string, pathHash: string | undefined, isRecycle: boolean = false, callback: (note: NoteDetail) => void) => {
        try {
            let url = `${env.API_URL}/api/note?vault=${encodeURIComponent(vault)}&path=${encodeURIComponent(path)}`;
            if (pathHash) {
                url += `&pathHash=${pathHash}`;
            }
            if (isRecycle) {
                url += `&isRecycle=1`;
            }
            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<NoteDetail> = await response.json()
            if (res.code > 0 && res.code <= 200 && res.data) {
                callback(res.data)
            } else if (res.code > 0 && res.code <= 200) {
                // handle empty data
                console.warn("GetNote returned 200 but data is null");
            } else {
                toast.error(res.message)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    const handleSaveNote = useCallback(async (
        vault: string,
        path: string,
        content: string,
        options: { pathHash?: string; srcPath?: string; srcPathHash?: string; contentHash?: string } = {},
        onSuccess: () => void,
        onError?: (error: string) => void,
        silent: boolean = false
    ) => {
        try {
            const body = {
                vault,
                path,
                content,
                ...options,
            }
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/note`), {
                method: "POST",
                body: JSON.stringify(body),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                if (!silent) {
                    toast.success(res.message)
                }
                onSuccess()
            } else {
                const errMsg = res.message + (res.details ? ": " + res.details.join(", ") : "");
                toast.error(errMsg)
                if (onError) onError(errMsg)
            }
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            toast.error(errMsg)
            if (onError) onError(errMsg)
        }
    }, [getHeaders])

    const handleDeleteNote = useCallback(async (vault: string, path: string, pathHash: string | undefined, callback: () => void) => {
        try {
            const body = {
                vault,
                path,
                pathHash,
            }
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/note`), {
                method: "DELETE",
                body: JSON.stringify(body),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback()
            } else {
                toast.error(res.message + (res.details ? ": " + res.details.join(", ") : ""))
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    const handleRestoreNote = useCallback(async (vault: string, path: string, pathHash: string | undefined, callback: () => void) => {
        try {
            const body = {
                vault,
                path,
                pathHash,
            }
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/note/restore`), {
                method: "PUT",
                body: JSON.stringify(body),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback()
            } else {
                toast.error(res.message + (res.details ? ": " + res.details.join(", ") : ""))
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    const handleNoteHistoryList = useCallback(async (vault: string, notePath: string, pathHash: string | undefined, page: number, pageSize: number, isRecycle: boolean = false, callback: (data: NoteHistoryListResponse | null) => void) => {
        try {
            const pageStr = Math.floor(page).toString();
            const pageSizeStr = Math.floor(pageSize).toString();
            let url = `${env.API_URL}/api/note/histories?vault=${encodeURIComponent(vault)}&path=${encodeURIComponent(notePath)}&page=${pageStr}&pageSize=${pageSizeStr}`;
            if (pathHash) {
                url += `&pathHash=${pathHash}`;
            }
            if (isRecycle) {
                url += `&isRecycle=1`;
            }
            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                if (response.status === 508) {
                    handleTokenExpired()
                } else {
                    toast.error("Network response was not ok")
                }
                callback(null)
                return
            }
            const res: NoteResponse<NoteHistoryListResponse> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                const data = res.data || { list: [], pager: { page: 1, pageSize: pageSize, totalRows: 0 } };
                if (!data.list) data.list = [];
                callback(data)
            } else {
                if (res.code === 508) {
                    handleTokenExpired()
                } else {
                    toast.error(res.message)
                }
                callback(null)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null)
        }
    }, [getHeaders, handleTokenExpired])

    const handleNoteHistoryDetail = useCallback(async (vault: string, id: number, callback: (data: NoteHistoryDetail) => void) => {
        try {
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/note/history?vault=${encodeURIComponent(vault)}&id=${id}`), {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<NoteHistoryDetail> = await response.json()
            if (res.code > 0 && res.code <= 200 && res.data) {
                callback(res.data)
            } else {
                toast.error(res.message)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    // 从历史版本恢复笔记
    const handleRestoreFromHistory = useCallback(async (vault: string, historyId: number, callback: () => void) => {
        try {
            const body = { vault, historyId }
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/note/history/restore`), {
                method: "PUT",
                body: JSON.stringify(body),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: NoteResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback()
            } else {
                toast.error(res.message + (res.details ? ": " + res.details.join(", ") : ""))
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    // 获取目录列表
    const handleFolderList = useCallback(async (vault: string, path: string = "", pathHash: string = "", callback: (data: Folder[] | null) => void) => {
        try {
            let url = `${env.API_URL}/api/folders?vault=${encodeURIComponent(vault)}`;
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
                    handleTokenExpired()
                } else {
                    toast.error("Network response was not ok")
                }
                callback(null)
                return
            }
            const res: NoteResponse<Folder[]> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                callback(res.data || [])
            } else {
                if (res.code === 508) {
                    handleTokenExpired()
                } else {
                    toast.error(res.message)
                }
                callback(null)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null)
        }
    }, [getHeaders, handleTokenExpired])

    // 获取目录下笔记列表
    const handleFolderNotes = useCallback(async (
        vault: string,
        path: string = "",
        pathHash: string = "",
        page: number,
        pageSize: number,
        sortBy: string = "mtime",
        sortOrder: string = "desc",
        callback: (data: NoteListResponse | null) => void
    ) => {
        try {
            const pageStr = Math.floor(page).toString();
            const pageSizeStr = Math.floor(pageSize).toString();
            let url = `${env.API_URL}/api/folder/notes?vault=${encodeURIComponent(vault)}&page=${pageStr}&pageSize=${pageSizeStr}`;
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
                    handleTokenExpired()
                } else {
                    toast.error("Network response was not ok")
                }
                callback(null)
                return
            }
            const res: NoteResponse<NoteListResponse> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                const data = res.data || { list: [], pager: { page, pageSize, totalRows: 0 } };
                if (!data.list) data.list = [];
                callback(data)
            } else {
                if (res.code === 508) {
                    handleTokenExpired()
                } else {
                    toast.error(res.message)
                }
                callback(null)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            callback(null)
        }
    }, [getHeaders, handleTokenExpired])

    return useMemo(() => ({
        handleNoteList,
        handleFolderList,
        handleFolderNotes,
        handleGetNote,
        handleSaveNote,
        handleDeleteNote,
        handleRestoreNote,
        handleNoteHistoryList,
        handleNoteHistoryDetail,
        handleRestoreFromHistory,
    }), [
        handleNoteList,
        handleFolderList,
        handleFolderNotes,
        handleGetNote,
        handleSaveNote,
        handleDeleteNote,
        handleRestoreNote,
        handleNoteHistoryList,
        handleNoteHistoryDetail,
        handleRestoreFromHistory,
    ])
}
