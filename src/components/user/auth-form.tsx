import "../../styles/auth.css";

import { createLoginSchema, createRegisterSchema, type LoginFormData, type RegisterFormData } from "@/lib/validations/user-schema";
import { AnimatedBackground } from "@/components/user/animated-background";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { normalizeOIDCProviders, type OIDCProvider } from "@/components/user/auth-oidc";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { Github, KeyRound, Wifi } from "lucide-react";
import { useTheme } from "@/components/context/theme-context";
import { useAuth } from "@/components/api-handle/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/common/Toast";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import env from "@/env.ts";


interface AuthFormProps {
  onSuccess: () => void
  registerIsEnable?: boolean
}

const formVariants: Variants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    }
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: { duration: 0.2 }
  }
};

export function AuthForm({ onSuccess, registerIsEnable = true }: AuthFormProps) {
  const { t } = useTranslation()
  const { isLoading, login, registerUser } = useAuth()
  const { resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [oidcProviders, setOIDCProviders] = useState<OIDCProvider[]>([])
  const [passwordLoginIsEnable, setPasswordLoginIsEnable] = useState(true)
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false)

  const loginSchema = createLoginSchema(t)
  const registerSchema = createRegisterSchema(t)

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSoft = () => {
    window.open("https://github.com/haierkeys/fast-note-sync-service", "_blank", "noopener,noreferrer")
  }

  useEffect(() => {
    let cancelled = false
    // Also used on the OAuth authorization page, which does not load App's config.
    const loadLoginCapabilities = async () => {
      try {
        const response = await fetch(addCacheBuster(env.API_URL + "/api/webgui/config"), {
          headers: buildApiHeaders({ token: null, includeContentType: false }),
        })
        if (!response.ok) return
        const res = await response.json()
        if (!cancelled && res.code > 0 && res.code < 100) {
          // Older backends omit this capability: keep password login available.
          setPasswordLoginIsEnable(res.data?.passwordLoginIsEnable !== false)
        }
      } catch (_error) {
        // The backend remains responsible for enforcing disabled password login.
      } finally {
        if (!cancelled) setCapabilitiesLoaded(true)
      }
    }
    const loadOIDCConfig = async () => {
      try {
        const response = await fetch(addCacheBuster(env.API_URL + "/api/user/auth/oidc/config"), {
          headers: buildApiHeaders({ token: null, includeContentType: false }),
        })
        if (!response.ok) return
        const res = await response.json()
        if (!cancelled && res.code < 100 && res.code > 0) {
          setOIDCProviders(normalizeOIDCProviders(res.data))
        }
      } catch (_error) {
        if (!cancelled) {
          setOIDCProviders([])
        }
      }
    }
    loadOIDCConfig()
    loadLoginCapabilities()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoginSubmit = async (data: LoginFormData) => {
    const result = await login(data)
    if (result.success) {
      onSuccess()
    } else {
      toast.error(result.error!)
    }
  }

  const handleRegisterSubmit = async (data: RegisterFormData) => {
    const result = await registerUser(data)
    if (result.success) {
      onSuccess()
    } else {
      toast.error(result.error!)
    }
  }

  const handleOIDCLogin = (provider: OIDCProvider) => {
    const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL
    const redirectTo = window.location.pathname + window.location.search + window.location.hash
    window.location.href = `${apiUrl}${provider.startUrl}?redirectTo=${encodeURIComponent(redirectTo)}`
  }

  const toggleTab = (tab: 'login' | 'register') => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  return (
    <div className={`auth-page-container ${resolvedTheme}`}>
      {/* Restore Animated Background */}
      <div className="auth-background-layer">
        <AnimatedBackground />
      </div>

      {/* Floating Actions (Top Right) */}
      <div className="auth-floating-actions">
        <button
          onClick={onSoft}
          className="auth-floating-switcher"
          title={t("ui.common.sourceCode")}
        >
          <Github size={18} />
        </button>
        <ThemeSwitcher asPlainButton className="auth-floating-switcher" />
        <LanguageSwitcher
          showText={false}
          className="auth-floating-switcher"
        />
      </div>

      <main className="relative z-50 w-full px-6 py-12 flex flex-col items-center">
        {/* Header Section */}
        <div className="auth-logo-wrapper">
          <div className="auth-logo-box">
            <Wifi size={40} className="auth-logo-icon" />
          </div>
          <h1 className="auth-title">Fast Note Sync</h1>
          <p className="auth-subtitle">
            {t("ui.common.subtitle")}
          </p>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          {/* Tabs Switcher at Top */}
          {capabilitiesLoaded && passwordLoginIsEnable && registerIsEnable && <div className="auth-tabs-container">
            <div className="auth-tabs">
              <button
                onClick={() => toggleTab('login')}
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              >
                {t("ui.auth.login")}
              </button>
              <button
                onClick={() => toggleTab('register')}
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              >
                {t("ui.auth.registerButton")}
              </button>
            </div>
          </div>}

          {capabilitiesLoaded && passwordLoginIsEnable && <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.form
                key="login"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
              >
                <div>
                  <div className="relative group">
                    <label htmlFor="login-credentials" className="sr-only">
                      {t("ui.auth.credentials")}
                    </label>
                    <Input
                      id="login-credentials"
                      placeholder={t("ui.auth.credentialsPlaceholder")}
                      {...loginForm.register("credentials")}
                      className="auth-input"
                    />
                    {loginForm.formState.errors.credentials && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {loginForm.formState.errors.credentials.message}
                      </p>
                    )}
                  </div>

                  <div className="relative group">
                    <label htmlFor="login-password" className="sr-only">
                      {t("ui.auth.password")}
                    </label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder={t("ui.auth.passwordPlaceholder")}
                      {...loginForm.register("password")}
                      className="auth-input"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="auth-button-primary"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    t("ui.auth.login")
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={registerForm.handleSubmit(handleRegisterSubmit)}
              >
                <div className="space-y-0">
                  <div className="relative group">
                    <label htmlFor="register-username" className="sr-only">
                      {t("ui.auth.username")}
                    </label>
                    <Input
                      id="register-username"
                      placeholder={t("ui.auth.usernamePlaceholder")}
                      {...registerForm.register("username")}
                      className="auth-input"
                    />
                    {registerForm.formState.errors.username && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {registerForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="relative group">
                    <Input
                      type="email"
                      placeholder={t("ui.auth.emailPlaceholder")}
                      {...registerForm.register("email")}
                      className="auth-input"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="relative group">
                    <label htmlFor="register-password" className="sr-only">
                      {t("ui.auth.password")}
                    </label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder={t("ui.auth.passwordPlaceholder")}
                      {...registerForm.register("password")}
                      className="auth-input"
                    />
                    {registerForm.formState.errors.password && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="relative group">
                    <label htmlFor="register-confirm-password" className="sr-only">
                      {t("ui.auth.confirmPassword")}
                    </label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder={t("ui.auth.confirmPasswordPlaceholder")}
                      {...registerForm.register("confirmPassword")}
                      className="auth-input"
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-1 ml-1 mb-2">
                        {registerForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="auth-button-primary"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : t("ui.auth.registerButton")}
                </button>
              </motion.form>
            )}
          </AnimatePresence>}

          {capabilitiesLoaded && !passwordLoginIsEnable && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("ui.auth.passwordLoginDisabled", { defaultValue: "Password login is disabled. Use an identity provider below, or contact your administrator if none is available." })}
            </p>
          )}

          {(!passwordLoginIsEnable || activeTab === 'login') && oidcProviders.length > 0 && (
            <div className="auth-oidc-section">
              {passwordLoginIsEnable && <div className="auth-divider" />}
              {oidcProviders.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleOIDCLogin(provider)}
                  className="auth-button-secondary"
                >
                  <KeyRound size={16} />
                  <span>{provider.displayName}</span>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Footer info & GitHub Link */}
        <div className="auth-footer-wrapper">
          <footer
            className="auth-brand-footer"
            dangerouslySetInnerHTML={{ __html: t("ui.common.footerTitle") }}
          />
        </div>
      </main>
    </div>
  )
}
