import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

vi.mock("react-i18next", async importOriginal => ({
  ...await importOriginal<typeof import("react-i18next")>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/context/theme-context", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/api-handle/use-auth", () => ({ useAuth: () => ({ isLoading: false, login: vi.fn(), registerUser: vi.fn() }) }));
vi.mock("@/components/user/animated-background", () => ({ AnimatedBackground: () => null }));
vi.mock("@/components/layout/language-switcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/layout/theme-switcher", () => ({ ThemeSwitcher: () => null }));

function mockConfig(capability: boolean | undefined, oidcEnabled = true, failConfig = false) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const oidc = url.includes("/oidc/config");
    if (!oidc && failConfig) throw new Error("unavailable");
    return {
      ok: true,
      json: async () => ({ code: 1, data: oidc ? {
        enabled: oidcEnabled,
        providers: [
          { id: "first", displayName: "First SSO", startUrl: "/api/user/auth/oidc/start/first" },
          { id: "second", displayName: "Second SSO", startUrl: "/api/user/auth/oidc/start/second" },
        ],
      } : { passwordLoginIsEnable: capability } }),
    };
  }));
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("password login capability", () => {
  it("removes local login and registration, keeping every OIDC provider", async () => {
    mockConfig(false);
    const { container } = render(<AuthForm onSuccess={vi.fn()} registerIsEnable />);
    await screen.findByRole("status");
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button", { name: "ui.auth.registerButton" })).toBeNull();
    expect(await screen.findByRole("button", { name: "First SSO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second SSO" })).toBeInTheDocument();
  });

  it.each([true, undefined])("retains login and registration for capability %s", async capability => {
    mockConfig(capability);
    render(<AuthForm onSuccess={vi.fn()} registerIsEnable />);
    expect(await screen.findByLabelText("ui.auth.credentials")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ui.auth.registerButton" }));
    expect(await screen.findByLabelText("ui.auth.username")).toBeInTheDocument();
  });

  it("also hides passwords in the OAuth authorization login form", async () => {
    mockConfig(false);
    const { container } = render(<AuthForm onSuccess={vi.fn()} registerIsEnable={false} />);
    await screen.findByRole("status");
    expect(container.querySelector("form")).toBeNull();
    expect(await screen.findByRole("button", { name: "First SSO" })).toBeInTheDocument();
  });

  it("does not offer a password fallback if no OIDC provider is enabled", async () => {
    mockConfig(false, false);
    const { container } = render(<AuthForm onSuccess={vi.fn()} />);
    await screen.findByRole("status");
    expect(container.querySelector("form")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("button", { name: "First SSO" })).toBeNull());
  });

  it("keeps the legacy form if capability discovery fails", async () => {
    mockConfig(undefined, true, true);
    render(<AuthForm onSuccess={vi.fn()} />);
    expect(await screen.findByLabelText("ui.auth.credentials")).toBeInTheDocument();
  });
});
