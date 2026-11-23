# Security Policy

## Supported versions

Only the latest version of the `main` branch is currently supported with security updates. Releases are not currently versioned.

## Reporting a vulnerability

Please report security vulnerabilities privately through GitHub Security Advisories:

1. Open this repository on GitHub.
2. Open the **Security** tab.
3. Select **Report a vulnerability**.

Do not open a public issue for a security vulnerability. Include a clear description, affected route or component, reproduction steps, impact, and any relevant logs or proof of concept. Please avoid accessing, changing, or deleting another user's data.

## Response targets

We aim to acknowledge reports within 7 days and provide a status update within 14 days. Resolution timing depends on severity and complexity. When a fix is released, we may credit the reporter if they agree.

## Safe handling

- Keep Cloudflare, Brevo, Turnstile, Formspree, and D1 credentials out of source control.
- Use Wrangler secrets for server-only configuration.
- Apply database migrations before deploying changes that depend on new tables or columns.
- Use HTTPS and keep `TURNSTILE_SECRET_KEY` configured in deployed environments.

## Known hardening areas

Security improvements are planned for account abuse resistance, including login attempt throttling, OTP verification attempt limits, and session revocation after password changes. Until these controls are implemented, operators should configure Turnstile and monitor application and D1 activity.
