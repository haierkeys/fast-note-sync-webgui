import { SettingItem, SettingResponse, SettingListRes } from "@/lib/types/setting";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { toast } from "@/components/common/Toast";
import { getBrowserLang } from "@/i18n/utils";
import { useCallback, useMemo } from "react";
import env from "@/env.ts";


export function useSettingHandle() {
    const token = localStorage.getItem("token")!

    const getHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        Domain: window.location.origin,
        Lang: getBrowserLang(),
    }), [token])

    /**
     * 获取配置列表 (支持分页和关键词)
     */
    const handleSettingList = useCallback(async (
        vault: string,
        callback: (data: SettingListRes) => void,
        failCallback?: () => void,
        keyword?: string,
        page: number = 1,
        pageSize: number = 24
    ) => {
        try {
            const url = addCacheBuster(`${env.API_URL}/api/settings?vault=${encodeURIComponent(vault)}&page=${page}&pageSize=${pageSize}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`);
            const response = await fetch(url, {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: SettingResponse<SettingListRes> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                // 确保返回完整的分页数据结构，适配包含 pager 字段的后端格式
                const data = res.data || { list: [], pager: { totalRows: 0, page, pageSize } };
                callback(data);
            } else {
                toast.error(res.message)
                if (failCallback) failCallback()
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            if (failCallback) failCallback()
        }
    }, [getHeaders])

    /**
     * 获取单个配置详情
     */
    const handleGetSetting = useCallback(async (
        vault: string,
        path: string,
        pathHash?: string,
        callback?: (data: SettingItem) => void
    ) => {
        try {
            const url = addCacheBuster(`${env.API_URL}/api/setting?vault=${encodeURIComponent(vault)}&path=${encodeURIComponent(path)}${pathHash ? `&pathHash=${pathHash}` : ''}`);
            const response = await fetch(url, {
                method: "GET",
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: SettingResponse<SettingItem> = await response.json()
            if (res.code > 0 && res.code <= 200 && res.data) {
                callback?.(res.data)
                return res.data
            } else {
                toast.error(res.message)
                return null
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
            return null
        }
    }, [getHeaders])

    /**
     * 保存配置 (创建或更新)
     */
    const handleSaveSetting = useCallback(async (
        vault: string,
        data: Partial<SettingItem> & { path: string },
        callback: () => void
    ) => {
        try {
            const body = { ...data, vault };
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/setting`), {
                method: "POST",
                body: JSON.stringify(body),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: SettingResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback()
            } else {
                toast.error(res.message)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    /**
     * 删除配置
     */
    const handleDeleteSetting = useCallback(async (
        vault: string,
        path: string,
        pathHash?: string,
        callback?: () => void
    ) => {
        try {
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/setting`), {
                method: "DELETE",
                body: JSON.stringify({ vault, path, pathHash }),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: SettingResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback?.()
            } else {
                toast.error(res.message)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    /**
     * 重命名配置
     */
    const handleRenameSetting = useCallback(async (
        vault: string,
        oldPath: string,
        newPath: string,
        oldPathHash?: string,
        callback?: () => void
    ) => {
        try {
            const response = await fetch(addCacheBuster(`${env.API_URL}/api/setting/rename`), {
                method: "POST",
                body: JSON.stringify({ vault, oldPath, newPath, oldPathHash }),
                headers: getHeaders(),
            })
            if (!response.ok) {
                throw new Error("Network response was not ok")
            }
            const res: SettingResponse<unknown> = await response.json()
            if (res.code > 0 && res.code <= 200) {
                toast.success(res.message)
                callback?.()
            } else {
                toast.error(res.message)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : String(error))
        }
    }, [getHeaders])

    return useMemo(() => ({
        handleSettingList,
        handleGetSetting,
        handleSaveSetting,
        handleDeleteSetting,
        handleRenameSetting,
    }), [handleSettingList, handleGetSetting, handleSaveSetting, handleDeleteSetting, handleRenameSetting])
}
