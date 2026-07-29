Remediate MVP release blocker RB-4: known dependency vulnerabilities.

Read AGENTS.md if present, PROJECT_HANDOFF.md, CHANGELOG.md,
MVP_RELEASE_CHECKLIST.md, package.json and package-lock.json.

Do not address other audit findings in this task.

Before editing:

1. Run:
   npm audit --audit-level=low
   npm audit --omit=dev --audit-level=low
2. Separate runtime and development-only findings.
3. Trace each advisory to its direct or transitive dependency.
4. Identify the installed version, vulnerable range, patched version and which
   direct dependency controls it.
5. Check official package release notes and security advisories for compatible
   fixes.
6. Report a proposed upgrade plan before changing dependencies.

Requirements:

- Prioritize all high-severity runtime findings.
- Prefer the smallest supported compatible upgrades.
- Upgrade direct dependencies explicitly rather than adding arbitrary overrides
  where possible.
- Use package overrides only when compatibility is verified and explain why.
- Do not use npm audit fix --force.
- Do not accept surprising package downgrades.
- Do not perform an unreviewed major Next.js, React, Prisma or authentication upgrade.
- If a major upgrade is required, stop and report:
  - Why it is required
  - Breaking changes
  - Required source changes
  - Migration plan
  - Whether the advisory is exploitable in this application
- Keep package.json and package-lock.json synchronized.
- Do not remove security-related packages merely to silence the audit.
- Do not change application behavior or perform unrelated refactoring.

After approved compatible upgrades, run:

- npm install
- npm audit --omit=dev --audit-level=low
- npm audit --audit-level=low
- npx prisma validate
- npx tsc --noEmit
- npm run lint
- All existing tests
- npm run build
- git diff --check

Also smoke-test:

- Authentication pages
- Static assets, fonts and images
- Prisma client generation and database access
- Berth Planner
- Weekly PDF export

Report:

1. Before-and-after vulnerability counts
2. Every package version changed
3. Advisories resolved
4. Advisories still present
5. Runtime versus development-only remaining risk
6. Test and build results
7. Any required follow-up or major upgrade

Update MVP_RELEASE_CHECKLIST.md, PROJECT_HANDOFF.md and CHANGELOG.md with the
RB-4 status. Mark RB-4 resolved only if all high runtime vulnerabilities are
removed or a specific non-exploitable exception is documented and explicitly
approved.

Do not commit, push, deploy or access production data.