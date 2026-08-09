Task: Revise the public landing page to accurately present the current Vessel Schedule MVP.

First inspect the existing landing page, shared layout/components, and current application routes. Read AGENTS.md if present. Do not redesign the whole application or change authenticated functionality.

Update the landing page with:

1. Hero section
- Title: “Plan Berth Operations with Confidence”
- Explain that the system provides a visual weekly berth plan for terminals.
- Primary action: “Request Access”
- Secondary action: “Sign In”
- If the database has no platform admin, preserve the existing first-time setup flow and show “Set Up Platform”.

2. Main capabilities
- Visual weekly Berth Planner
- Position-domain and datetime-domain views
- Drag-and-drop scheduling and duration resizing
- Berth/vessel overlap detection
- Operational filters and search
- Recent-change highlighting and undo
- Configurable vessel labels
- Print, PDF and schedule export
- Organization users, roles and invitations
- Object-level audit history
- Secure read-only planner sharing with expiration

3. Workflow section
Show a simple flow:
Set up organization → Add terminal, berth, vessel and service → Create schedules → Operate from the Berth Planner → Share or export the plan.

4. Security section
Explain:
- Organization data isolation
- Role-based permissions
- Audit logs
- Expiring and revocable read-only sharing links

5. Pilot status
Present the product honestly as an invite-only pilot. Do not claim enterprise readiness, guaranteed uptime, real-time synchronization, or completed compliance certifications.

6. UI requirements
- Reuse the existing design system, colors, typography and responsive components.
- Make it professional for port and terminal operators.
- Keep the page concise and mobile/tablet friendly.
- Do not expose authenticated navigation or organization data.
- Avoid invented statistics and customer testimonials.
- Add accessible headings, buttons, focus states and semantic HTML.
- Preserve request-access, sign-in and first-time setup routes.

7. Verification
Run TypeScript checking, lint and production build. Add or update lightweight tests for landing-page actions and first-time setup visibility.

Update PROJECT_HANDOFF.md and CHANGELOG.md briefly without reading their entire history. Report changed files, test results and any assumptions.