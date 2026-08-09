Task: Update the landing page branding to “FlowPort” and reuse the logo from the V1 project.

References:
- Current repository: https://github.com/chutchais/vessel-schedule.git
- V1 repository: https://github.com/chutchais/vessel-schedule-v1.git
- V1 logo reference: app/page.tsx
- Product domain: https://getflowport.com

Instructions:

1. Read AGENTS.md if present, then inspect the current landing page and shared branding components.

2. Inspect `app/page.tsx` in the V1 repository and identify how its FlowPort logo is built:
   - Reuse the same logo appearance and brand identity.
   - If the logo is implemented with JSX/CSS, create a reusable component such as `FlowPortLogo`.
   - If it references an image or font asset, copy only the required asset and preserve its proportions.
   - Do not copy the complete V1 landing page or obsolete application code.

3. Replace the current landing-page logo and product name with:
   - Brand: FlowPort
   - Domain: getflowport.com
   - Suggested description: “Visual berth planning for modern terminal operations.”

4. Use the reusable FlowPort logo consistently in:
   - Landing-page header
   - Hero section, if appropriate
   - Footer
   - Sign-in and request-access pages where existing branding is shown
   - Application sidebar/header, but do not disrupt compact or collapsed sidebar layouts

5. Preserve:
   - Request Access and Sign In actions
   - First-time platform setup detection and action
   - Existing authenticated routes and authorization
   - Responsive desktop, tablet and mobile behavior
   - Existing application design system

6. Branding requirements:
   - Add accessible logo text or `aria-label="FlowPort"`
   - Keep sufficient color contrast
   - Do not stretch or rasterize a vector/CSS logo
   - Do not hard-code `localhost` links
   - Use `NEXT_PUBLIC_APP_URL` for absolute URLs where needed
   - Set metadata title to `FlowPort | Berth Planning`
   - Set metadata description to a concise, accurate product description
   - Add canonical URL `https://getflowport.com`
   - Do not invent customers, statistics, certifications or testimonials

7. Verification:
   - Check the landing page at desktop, tablet and mobile widths
   - Check expanded and collapsed application sidebars
   - Run TypeScript check, lint and production build
   - Update CHANGELOG.md briefly without reading its complete history

Report:
- How the V1 logo was implemented
- Files created or changed
- Pages receiving the new branding
- Verification and test results
- Any V1 assets that could not be reused