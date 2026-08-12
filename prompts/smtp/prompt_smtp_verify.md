Task: Create a secure platform-admin page for checking and testing FlowPort SMTP configuration.

Suggested route:
`/platform-administration/smtp`

Authorization:
- Only authenticated Platform Admin users may access the page or its API/actions.
- Do not allow Organization Owner/Admin roles unless they are also Platform Admin.
- Return 404 or access denied for unauthorized users.
- Keep the normal Platform Administration sidebar/layout visible.

Page content:

1. SMTP Configuration Status
Show only whether each required setting is configured:
- SMTP host
- SMTP port
- Secure/TLS mode
- SMTP username
- SMTP password
- Sender email
- Sender name

Display `Configured` or `Missing`. Never display, return, log, or expose the actual values.

2. Connection Check
Add a “Check SMTP Connection” button that:
- Runs only on the server.
- Verifies connection/authentication using the configured SMTP transport.
- Does not send an email.
- Returns a safe success or error message.
- Sanitizes provider errors so credentials and connection strings cannot leak.

3. Send Test Email
Add a “Send Test Email” button.
- Send only to the signed-in Platform Admin’s verified account email.
- Display the destination before confirmation.
- Do not allow an arbitrary recipient to prevent misuse as a mail relay.
- Use subject: `FlowPort SMTP test`
- Include the environment name, application URL and send timestamp.
- Do not include secrets or sensitive database information.
- Show a clear success/failure result without exposing raw SMTP errors.

Security requirements:
- Read SMTP credentials from server-side environment variables only.
- Never use `NEXT_PUBLIC_` variables for SMTP credentials.
- Never save SMTP passwords in the database or browser storage.
- Never include credentials in client bundles, API responses, logs, audit metadata or error messages.
- Add CSRF protection consistent with existing server actions/APIs.
- Add durable rate limiting to connection checks and test emails.
- Add an audit-log event for connection checks and test-email attempts, recording actor, time and success/failure only.
- Do not record SMTP credentials, complete provider errors or email content.
- Prevent caching with `Cache-Control: private, no-store`.

UX:
- Use existing FlowPort components and Platform Administration styling.
- Include a short explanation that configuration values must be changed through production environment settings and application redeployment.
- Provide a link or text reference to `support@getflowport.com`.
- Disable actions and explain why when required configuration is missing.

Implementation:
- Reuse the application’s existing email transport/service if present.
- Do not create a second SMTP implementation unnecessarily.
- Centralize safe SMTP error sanitization.
- Do not modify authentication, invitation or request-access behavior.
- Update `.env.example` with placeholder SMTP variable names only—never real values.
- Briefly update `CHANGELOG.md`.

Add focused tests for Platform Admin authorization, secret redaction, recipient restriction, rate limiting and safe error handling. Report files changed and test results.