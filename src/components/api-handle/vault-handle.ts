import { addCacheBuster } from "@/lib/utils/cache-buster";
import { toast } from "@/components/common/Toast";
import { VaultType } from "@/lib/types/vault";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { useCallback, useMemo } from "react";
import env from "@/env.ts";


export function useVaultHandle() {
  const token = localStorage.getItem("token")!

  const handleVaultList = useCallback(async (callback: (key: VaultType[]) => void) => {
    const response = await fetch(addCacheBuster(env.API_URL + "/api/vault?limit=100"), {
      method: "GET",
      headers: buildApiHeaders({ token }),
    })
    if (!response.ok) {
      throw new Error("Network response was not ok")
    }
    const res = await response.json()
    if (res.code < 100 && res.code > 0) {
      callback(res.data || [])
    } else {
      const details = Array.isArray(res.details) ? res.details.join(", ") : res.details
      const message = res.message || "Failed to load vault list"
      throw new Error(details
        ? `${message}: ${details}`
        : message)
    }
  }, [token])

  const handleVaultDelete = useCallback(async (id: string) => {
    const data = {
      id: id,
    }
    const response = await fetch(addCacheBuster(env.API_URL + "/api/vault"), {
      method: "DELETE",
      body: JSON.stringify(data),
      headers: buildApiHeaders({ token }),
    })
    if (!response.ok) {
      // Network error / 网络请求错误
      throw new Error("Network response was not ok")
    }
    const res = await response.json()
    if (res.code < 100 && res.code > 0) {
      return res
    } else {
      const details = Array.isArray(res.details) ? res.details.join(", ") : res.details
      const message = res.message || "Failed to delete vault"
      // Throw error if delete failed / 如果删除失败则抛出错误
      throw new Error(details ? `${message}: ${details}` : message)
    }
  }, [token])

  const handleVaultUpdate = useCallback(async (data: Partial<VaultType>, callback: (data2: VaultType) => void) => {
    const response = await fetch(addCacheBuster(env.API_URL + "/api/vault"), {
      method: "POST",
      body: JSON.stringify(data),
      headers: buildApiHeaders({ token }),
    })
    if (!response.ok) {
      throw new Error("Network response was not ok")
    }
    const res = await response.json()
    if (res.code < 100 && res.code > 0) {
      toast.success(res.message)
      callback(res.data)
    } else {
      toast.error(res.message + ": " + res.details)
    }
  }, [token])

  const handleVaultRebuildIndex = useCallback(async (id: string | number) => {
    const data = {
      id: typeof id === "string" ? parseInt(id) : id,
    }
    const response = await fetch(addCacheBuster(env.API_URL + "/api/vault/rebuild-index"), {
      method: "POST",
      body: JSON.stringify(data),
      headers: buildApiHeaders({ token }),
    })
    if (!response.ok) {
      throw new Error("Network response was not ok")
    }
    const res = await response.json()
    if (res.code < 100 && res.code > 0) {
      toast.success(res.message)
    } else {
      toast.error(res.message + ": " + res.details)
    }
  }, [token])

  const handleVaultForceDeleteItem = useCallback(async (vaultId: number, type: 'note' | 'file', id: number) => {
    const response = await fetch(addCacheBuster(env.API_URL + "/api/vault/force-delete-item"), {
      method: "POST",
      body: JSON.stringify({ vaultId, type, id }),
      headers: buildApiHeaders({ token }),
    })
    if (!response.ok) {
      throw new Error("Network response was not ok")
    }
    const res = await response.json()
    if (res.code < 100 && res.code > 0) {
      toast.success(res.message)
    } else {
      throw new Error(res.message + (res.details ? ": " + res.details : ""))
    }
  }, [token])

  return useMemo(() => ({
    handleVaultList,
    handleVaultDelete,
    handleVaultUpdate,
    handleVaultRebuildIndex,
    handleVaultForceDeleteItem,
  }), [handleVaultList, handleVaultDelete, handleVaultUpdate, handleVaultRebuildIndex, handleVaultForceDeleteItem])
}
