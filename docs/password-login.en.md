# Passwordless / SSO-only login

The service's public `GET /api/webgui/config` response can include
`data.passwordLoginIsEnable: false`. The shared login component then removes
local username/password login and registration forms, even when local
registration is otherwise enabled, while retaining every configured OIDC
provider button. This applies to the main WebGUI and OAuth authorization login.

Missing capability fields (older servers) or failed capability discovery retain
the legacy password form. The service must enforce the policy server-side;
hiding a form is not an authentication boundary. No provider is enabled by this
UI change. If passwords are disabled without a working OIDC provider, the UI
shows an administrator-contact hint rather than offering password fallback.

Configure the companion service feature with `user.password-login-is-enable:
false` and restart the service. Configure and verify OIDC and administrator
access first to avoid lockout. This change does not revoke sessions or API
tokens, and does not alter plugin token issuance.

The backend embeds built WebGUI assets. Maintainers need to publish/integrate
this frontend change through their normal asset workflow; this PR does not
replace the service's compiled asset bundle.
