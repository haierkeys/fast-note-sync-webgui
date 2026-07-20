import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { useCallback, useMemo, useState } from "react";
import env from "@/env.ts";

export interface TokenInfo {
  id: number;
  scope: string;
  vaults?: string;
  clientType: string;
  boundIp: string;
  userAgent: string;
  expiredAt: string;
  createdAt: string;
  lastUsedAt?: string;
  issueType: number;
  isWsOnline: boolean;
  activeClients?: string[];
}

export interface TokenLog {
  id: number;
  protocol: string;
  client: string;
  clientName: string;
  clientVersion: string;
  path: string;
  method: string;
  ip: string;
  ua: string;
  statusCode: number;
  createdAt: string;
}

export function useTokenHandle() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem("token")!;

  const handleListTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(addCacheBuster(env.API_URL + "/api/tokens"), {
        method: "GET",
        headers: buildApiHeaders({ token }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tokens");
      }

      const res = await response.json();
      if (res.code > 0 && res.data) {
        setTokens(res.data);
      }
    } catch (e) {
      console.error("Fetch tokens failed", e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleFetchTokenLogs = useCallback(async (tokenId: number, page: number = 1, pageSize: number = 10) => {
    try {
      const response = await fetch(addCacheBuster(env.API_URL + `/api/token/${tokenId}/logs?page=${page}&pageSize=${pageSize}`), {
        method: "GET",
        headers: buildApiHeaders({ token }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch token logs");
      }

      const res = await response.json();
      if (res.code > 0 && res.data) {
        return {
          logs: res.data.list as TokenLog[],
          pager: res.data.pager as { page: number, pageSize: number, totalRows: number }
        };
      }
      return null;
    } catch (e) {
      console.error("Fetch token logs failed", e);
      return null;
    }
  }, [token]);

  const handleRevokeToken = useCallback(async (tokenId: number) => {
    try {
      const response = await fetch(addCacheBuster(env.API_URL + `/api/token/${tokenId}`), {
        method: "DELETE",
        headers: buildApiHeaders({ token }),
      });

      if (!response.ok) {
        throw new Error("Failed to revoke token");
      }

      const res = await response.json();
      if (res.code > 0) {
        // Refresh list
        handleListTokens();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Revoke token failed", e);
      return false;
    }
  }, [token, handleListTokens]);

  const handleCreateToken = useCallback(async (
    clientType: string,
    scope: string,
    expiredDays: number,
    boundIp?: string,
    userAgent?: string,
    protocol?: string,
    client?: string,
    functionScope?: string,
    vaults?: string
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(addCacheBuster(env.API_URL + "/api/token"), {
        method: "POST",
        headers: buildApiHeaders({ token }),
        body: JSON.stringify({
          clientType,
          scope,
          expiredDays,
          boundIp,
          userAgent,
          protocol,
          client,
          function: functionScope,
          vaults,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create token");
      }

      const res = await response.json();
      if (res.code > 0 && res.data) {
        // Refresh list if needed, but return the new token string
        return res.data.token as string;
      }
      return null;
    } catch (e) {
      console.error("Create token failed", e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleUpdateToken = useCallback(async (
    tokenId: number,
    clientType: string,
    scope: string,
    expiredDays: number,
    boundIp?: string,
    userAgent?: string,
    protocol?: string,
    client?: string,
    functionScope?: string,
    vaults?: string
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(addCacheBuster(env.API_URL + `/api/token/${tokenId}`), {
        method: "PUT",
        headers: buildApiHeaders({ token }),
        body: JSON.stringify({
          clientType,
          scope,
          expiredDays,
          boundIp,
          userAgent,
          protocol,
          client,
          function: functionScope,
          vaults,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update token");
      }

      const res = await response.json();
      if (res.code > 0) {
        handleListTokens();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Update token failed", e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, handleListTokens]);

  const handleRotateToken = useCallback(async (tokenId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(addCacheBuster(env.API_URL + `/api/token/${tokenId}/rotate`), {
        method: "POST",
        headers: buildApiHeaders({ token }),
      });

      if (!response.ok) {
        throw new Error("Failed to rotate token");
      }

      const res = await response.json();
      if (res.code > 0 && res.data) {
        handleListTokens();
        return res.data.token as string;
      }
      return null;
    } catch (e) {
      console.error("Rotate token failed", e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token, handleListTokens]);

  const handleCleanExpiredTokens = useCallback(async (issueType: number = 1) => {
    setIsLoading(true);
    try {
      const response = await fetch(addCacheBuster(env.API_URL + `/api/tokens/clean-expired?issueType=${issueType}`), {
        method: "DELETE",
        headers: buildApiHeaders({ token }),
      });

      if (!response.ok) {
        throw new Error("Failed to clean expired tokens");
      }

      const res = await response.json();
      if (res.code > 0) {
        // Refresh list
        handleListTokens();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Clean expired tokens failed", e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, handleListTokens]);

  const currentTokenID = useMemo(() => {
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      return payload.tokenId || payload.tokenID || payload.tid; 
    } catch {
      return null;
    }
  }, [token]);

  return useMemo(() => ({
    tokens,
    isLoading,
    currentTokenID,
    handleListTokens,
    handleRevokeToken,
    handleCreateToken,
    handleUpdateToken,
    handleFetchTokenLogs,
    handleRotateToken,
    handleCleanExpiredTokens
  }), [tokens, isLoading, currentTokenID, handleListTokens, handleRevokeToken, handleCreateToken, handleUpdateToken, handleFetchTokenLogs, handleRotateToken, handleCleanExpiredTokens]);
}
