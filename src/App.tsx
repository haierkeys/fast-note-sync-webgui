import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { useUserHandle } from "@/components/api-handle/user-handle";
import { useAuth } from "@/components/context/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { useUrlSync } from "@/hooks/use-url-sync";
import { toast } from "@/components/common/Toast";
import { useAppStore } from "@/stores/app-store";
import { useTranslation } from "react-i18next";
import { getBrowserLang } from "@/i18n/utils";
import env from "@/env.ts";


// 懒加载核心业务模块
const NoteManager = lazy(() => import("@/components/note/note-manager").then(m => ({ default: m.NoteManager })));
const FileManager = lazy(() => import("@/components/file/file-manager").then(m => ({ default: m.FileManager })));
const SystemSettings = lazy(() => import("@/components/layout/system-settings").then(m => ({ default: m.SystemSettings })));
const VaultList = lazy(() => import("@/components/vault/vault-list").then(m => ({ default: m.VaultList })));
const AuthForm = lazy(() => import("@/components/user/auth-form").then(m => ({ default: m.AuthForm })));
const SyncBackup = lazy(() => import("@/components/layout/sync-backup").then(m => ({ default: m.SyncBackup })));
const GitAutomation = lazy(() => import("@/components/layout/git-automation").then(m => ({ default: m.GitAutomation })));
const SettingManager = lazy(() => import("@/components/setting/setting-manager").then(m => ({ default: m.SettingManager })));

// 加载占位符
const PageLoading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function App() {
  const { t } = useTranslation()
  const { isLoggedIn, login, logout } = useAuth()
  const { handleVaultList } = useVaultHandle()
  const { handleUserInfo } = useUserHandle()

  const currentModule = useAppStore(state => state.currentModule)
  const setModule = useAppStore(state => state.setModule)
  const zenMode = useAppStore(state => state.zenMode)
  const setZenMode = useAppStore(state => state.setZenMode)
  const resetState = useAppStore(state => state.resetState)
  const trashType = useAppStore(state => state.trashType)

  const [activeVault, setActiveVault] = useState<string | null>(null)
  // 通过 ref 读取 activeVault，避免其出现在 loadVaults effect 的依赖数组中
  const activeVaultRef = useRef<string | null>(null)
  useEffect(() => {
    activeVaultRef.current = activeVault
  }, [activeVault])

  useUrlSync(activeVault, setActiveVault)

  const [vaultsLoaded, setVaultsLoaded] = useState(false)
  const [registerIsEnable, setRegisterIsEnable] = useState(true)
  const [adminUid, setAdminUid] = useState<number | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const currentUid = localStorage.getItem("uid") ? parseInt(localStorage.getItem("uid")!) : null
  const isAdmin = adminUid !== null && currentUid !== null && (adminUid === 0 || adminUid === currentUid)

  useEffect(() => {
    if (isLoggedIn) {
      handleUserInfo(logout)
    }
  }, [isLoggedIn, handleUserInfo, logout])

  useEffect(() => {
    if ((currentModule !== "notes" && currentModule !== "files" && currentModule !== "trash" && currentModule !== "settings") || !isLoggedIn) return

    let isMounted = true
    setVaultsLoaded(false)

    const loadVaults = async () => {
      try {
        await handleVaultList((vaults) => {
          if (!isMounted) return

          if (vaults.length > 0) {
            // 通过 ref 读取最新 activeVault，避免此 effect 依赖 activeVault
            const currentVault = activeVaultRef.current
            const vaultExists = currentVault && vaults.some(v => v.vault === currentVault)
            if (!vaultExists) {
              setActiveVault(vaults[0].vault)
            }
            setVaultsLoaded(true)
            return
          }

          toast.warning(t("ui.vault.pleaseCreateVault"))
          setModule("vaults")
          setVaultsLoaded(true)
        })
      } catch (error: unknown) {
        if (!isMounted) return
        toast.error(error instanceof Error ? error.message : String(error))
        setVaultsLoaded(true)
      }
    }

    void loadVaults()

    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModule, isLoggedIn, handleVaultList, t, setModule])

  useEffect(() => {
    if (isLoggedIn && currentModule === "config" && configLoaded && !isAdmin) {
      toast.warning(t("ui.settings.onlyAdminAccess"))
      setModule("vaults")
    }
  }, [isLoggedIn, currentModule, configLoaded, isAdmin, setModule, t])

  const handleFontsUpdate = useCallback((fontUrl: string) => {
    const oldLink = document.getElementById("dynamic-font-link")
    if (oldLink) oldLink.remove()
    const oldStyle = document.getElementById("dynamic-font-style")
    if (oldStyle) oldStyle.remove()
    document.body.style.fontFamily = ""

    if (!fontUrl) return

    let finalUrl = fontUrl
    if (!fontUrl.includes("/") && !fontUrl.includes("://")) {
      finalUrl = `/static/fonts/${fontUrl}.css`
    }

    const fullUrl = finalUrl
    const pathOnly = finalUrl.split('?')[0].split('#')[0]
    const isCss = pathOnly.toLowerCase().endsWith(".css") || finalUrl.includes("fonts.googleapis.com")
    const isDirectFont = /\.(woff2|woff|ttf|otf)$/i.test(pathOnly)

    if (isCss) {
      const link = document.createElement("link")
      link.id = "dynamic-font-link"
      link.rel = "stylesheet"
      link.href = fullUrl
      link.crossOrigin = "anonymous"
      document.head.appendChild(link)

      if (fullUrl.includes("fonts.googleapis.com")) {
        const familyMatch = fullUrl.match(/family=([^&:]+)/)
        if (familyMatch) {
          const familyName = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ')
          document.body.style.fontFamily = `'${familyName}', sans-serif`
        }
      }
    } else if (isDirectFont) {
      const style = document.createElement("style")
      style.id = "dynamic-font-style"
      const familyName = "DynamicCustomFont"
      style.textContent = `
        @font-face {
          font-family: '${familyName}';
          src: url('${fullUrl}');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        body { font-family: '${familyName}', sans-serif !important; }
      `
      document.head.appendChild(style)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchConfig = async () => {
      try {
        const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL
        const response = await fetch(addCacheBuster(`${apiUrl}/api/webgui/config`), {
          headers: {
            "Lang": getBrowserLang()
          }
        })
        if (response.ok && isMounted) {
          const res = await response.json()
          if (res.code > 0 && res.data) {
            handleFontsUpdate(res.data.fontSet || res.data.FontSet || "")
            if (res.data.registerIsEnable !== undefined) {
              setRegisterIsEnable(res.data.registerIsEnable)
            }
            if (res.data.adminUid !== undefined) {
              setAdminUid(res.data.adminUid)
            }
          }
        }
      } catch (error: unknown) {
        if (isMounted) {
          toast.error(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (isMounted) {
          setConfigLoaded(true)
        }
      }
    }

    fetchConfig()

    return () => {
      isMounted = false
    }
  }, [handleFontsUpdate])

  const handleAuthSuccess = useCallback(() => {
    login()
  }, [login])

  const handleLogout = useCallback(() => {
    logout()
    resetState()
  }, [logout, resetState])

  const handleToggleZenMode = useCallback(() => {
    setZenMode(!zenMode)
  }, [zenMode, setZenMode])

  const handleNavigateToVaults = useCallback(() => {
    setModule("vaults")
  }, [setModule])

  if (!isLoggedIn) {
    return (
      <div className="w-full min-h-screen">
        <Suspense fallback={<PageLoading />}>
          <AuthForm onSuccess={handleAuthSuccess} registerIsEnable={registerIsEnable} />
        </Suspense>
      </div>
    )
  }

  const renderModuleContent = () => {
    switch (currentModule) {
      case "dashboard":
        return (
          <SystemSettings isDashboard={true} onBack={handleNavigateToVaults} />
        )

      case "notes":
        if (!vaultsLoaded || !activeVault) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )
        }
        return (
          <NoteManager
            key="notes"
            vault={activeVault}
            onVaultChange={setActiveVault}
            onNavigateToVaults={() => setModule("vaults")}
            isMaximized={zenMode}
            onToggleMaximize={handleToggleZenMode}
          />
        )

      case "files":
        if (!vaultsLoaded || !activeVault) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )
        }
        return (
          <FileManager
            vault={activeVault}
            onVaultChange={setActiveVault}
            onNavigateToVaults={() => setModule("vaults")}
          />
        )

      case "trash":
        if (!vaultsLoaded || !activeVault) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )
        }
        if (trashType === "files") {
          return (
            <FileManager
              vault={activeVault}
              onVaultChange={setActiveVault}
              onNavigateToVaults={() => setModule("vaults")}
              isRecycle={true}
            />
          )
        }
        return (
          <NoteManager
            key="trash"
            vault={activeVault}
            onVaultChange={setActiveVault}
            onNavigateToVaults={() => setModule("vaults")}
            isMaximized={zenMode}
            onToggleMaximize={handleToggleZenMode}
            isRecycle={true}
          />
        )

      case "config":
        if (!configLoaded) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )
        }
        if (!isAdmin) {
          return null
        }
        return (
          <SystemSettings onBack={handleNavigateToVaults} />
        )

      case "sync":
        return <SyncBackup />

      case "git":
        return <GitAutomation />

      case "settings":
        return (
          <SettingManager
            vault={activeVault || ""}
            onVaultChange={setActiveVault}
            onNavigateToVaults={() => setModule("vaults")}
          />
        )

      case "vaults":
      default:
        return (
          <VaultList
            onNavigateToNotes={(vaultName) => {
              setActiveVault(vaultName)
              setModule("notes")
            }}
            onNavigateToAttachments={(vaultName) => {
              setActiveVault(vaultName)
              setModule("files")
            }}
          />
        )
    }
  }

  return (
    <AppLayout isAdmin={isAdmin} onLogout={handleLogout}>
      <Suspense fallback={<PageLoading />}>
        {renderModuleContent()}
      </Suspense>
    </AppLayout>
  )
}

export default App
