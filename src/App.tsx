import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { useUserHandle } from "@/components/api-handle/user-handle";
import { useAuth } from "@/components/context/auth-context";
import { AppLayout } from "@/components/layout/AppLayout";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { useUrlSync } from "@/hooks/use-url-sync";
import { toast } from "@/components/common/Toast";
import { useAppStore } from "@/stores/app-store";
import { useTranslation } from "react-i18next";
import env from "@/env.ts";
import { handleFontsUpdate } from "@/lib/utils/font-loader";


// 懒加载核心业务模块
const NoteManager = lazy(() => import("@/components/note/note-manager").then(m => ({ default: m.NoteManager })));
const FileManager = lazy(() => import("@/components/file/file-manager").then(m => ({ default: m.FileManager })));
const SystemSettings = lazy(() => import("@/components/layout/system-settings").then(m => ({ default: m.SystemSettings })));
const VaultList = lazy(() => import("@/components/vault/vault-list").then(m => ({ default: m.VaultList })));
const AuthForm = lazy(() => import("@/components/user/auth-form").then(m => ({ default: m.AuthForm })));
const SyncBackup = lazy(() => import("@/components/layout/sync-backup").then(m => ({ default: m.SyncBackup })));
const GitAutomation = lazy(() => import("@/components/layout/git-automation").then(m => ({ default: m.GitAutomation })));
const SettingManager = lazy(() => import("@/components/setting/setting-manager").then(m => ({ default: m.SettingManager })));
const SyncLogManager = lazy(() => import("@/components/sync-log/sync-log-manager").then(m => ({ default: m.SyncLogManager })));
const AdminSetupDialog = lazy(() => import("@/components/user/admin-setup-dialog").then(m => ({ default: m.AdminSetupDialog })));


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
  const { handleUserInfo, handleLogout: apiLogout } = useUserHandle()

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
  const [ftsBleveEnabled, setFtsBleveEnabled] = useState(true)
  const [adminUid, setAdminUid] = useState<number | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const [isAdminByCheck, setIsAdminByCheck] = useState<boolean | null>(null)
  const isAdmin = isAdminByCheck === true

  useEffect(() => {
    if (isLoggedIn) {
      handleUserInfo(logout)
    }
  }, [isLoggedIn, handleUserInfo, logout])

  const fetchAdminInfo = useCallback(async () => {
    if (!isLoggedIn) {
      setAdminUid(null)
      setIsAdminByCheck(null)
      return
    }

    const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL
    const token = localStorage.getItem("token") || ""
    try {
      const response = await fetch(addCacheBuster(`${apiUrl}/api/admin/check`), {
        headers: buildApiHeaders({ token, includeDomain: false, includeContentType: false }),
      })
      if (response.ok) {
        const res = await response.json()
        if (res.code > 0 && res.data) {
          setIsAdminByCheck(res.data.isAdmin)
          if (res.data.isAdmin) {
            const configRes = await fetch(addCacheBuster(`${apiUrl}/api/admin/config`), {
              headers: buildApiHeaders({ token, includeDomain: false, includeContentType: false }),
            })
            if (configRes.ok) {
              const configData = await configRes.json()
              if (configData.code > 0 && configData.data) {
                setAdminUid(configData.data.adminUid)
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Fetch admin info failed", e)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoggedIn) {
      void fetchAdminInfo()
    } else {
      setAdminUid(null)
      setIsAdminByCheck(null)
    }
  }, [isLoggedIn, fetchAdminInfo])

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
  }, [currentModule, isLoggedIn, handleVaultList, t, setModule])

  useEffect(() => {
    if (isLoggedIn && currentModule === "config" && configLoaded && !isAdmin) {
      toast.warning(t("ui.settings.onlyAdminAccess"))
      setModule("vaults")
    }
  }, [isLoggedIn, currentModule, configLoaded, isAdmin, setModule, t])

  // Unsaved changes: beforeunload + navigation guard
  const dirtyState = useAppStore(state => state.dirtyState)
  const pendingNavigation = useAppStore(state => state.pendingNavigation)
  const confirmNavigation = useAppStore(state => state.confirmNavigation)
  const cancelNavigation = useAppStore(state => state.cancelNavigation)

  const hasDirty = Object.values(dirtyState).some(Boolean)

  useEffect(() => {
    if (hasDirty) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault()
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [hasDirty])

  const onFontsUpdate = useCallback((fontUrl: string) => {
    handleFontsUpdate(fontUrl)
  }, [])

  const fetchConfig = useCallback(async (isMounted = true) => {
    try {
      const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL
      const response = await fetch(addCacheBuster(`${apiUrl}/api/webgui/config`), {
        headers: buildApiHeaders({
          token: null,
          includeContentType: false,
          includeDomain: false,
        }),
      })
      if (response.ok && isMounted) {
        const res = await response.json()
        if (res.code > 0 && res.data) {
          onFontsUpdate(res.data.fontSet || res.data.FontSet || "")
          if (res.data.registerIsEnable !== undefined) {
            setRegisterIsEnable(res.data.registerIsEnable)
          }
          if (res.data.ftsBleveEnabled !== undefined) {
            setFtsBleveEnabled(res.data.ftsBleveEnabled)
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
  }, [onFontsUpdate])

  useEffect(() => {
    let isMounted = true
    fetchConfig(isMounted)
    return () => {
      isMounted = false
    }
  }, [fetchConfig])

  const handleAuthSuccess = useCallback(() => {
    login()
  }, [login])

  const handleLogout = useCallback(() => {
    void apiLogout()
    logout()
    resetState()
  }, [logout, resetState, apiLogout])

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
          <SystemSettings isDashboard={true} isAdmin={isAdmin} onBack={handleNavigateToVaults} />
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
          <SystemSettings onBack={handleNavigateToVaults} isAdmin={isAdmin} />
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

      case "sync-logs":
        return (
          <SyncLogManager
            vault={activeVault}
            onVaultChange={setActiveVault}
          />
        )



      case "vaults":
      default:
        return (
          <VaultList
            ftsBleveEnabled={ftsBleveEnabled}
            onNavigateToNotes={(vaultName, mode = "folder") => {
              setActiveVault(vaultName)
              localStorage.setItem("noteViewMode", mode)
              setModule("notes")
            }}
            onNavigateToAttachments={(vaultName) => {
              setActiveVault(vaultName)
              localStorage.setItem("noteViewMode", "flat-file")
              setModule("notes")
            }}
          />
        )
    }
  }

  return (
    <>
      <AppLayout isAdmin={isAdmin} onLogout={handleLogout}>
        <Suspense fallback={<PageLoading />}>
          {renderModuleContent()}
        </Suspense>
        {isLoggedIn && adminUid === 0 && isAdmin && (
          <Suspense>
            <AdminSetupDialog onDone={() => {
              void fetchAdminInfo()
              fetchConfig()
            }} />
          </Suspense>
        )}
      </AppLayout>

      <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => { if (!open) cancelNavigation() }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.unsaved.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.unsaved.message")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("ui.unsaved.stay")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation} className="rounded-xl">
              {t("ui.unsaved.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default App
