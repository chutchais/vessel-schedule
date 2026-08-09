import { expect, test, type Page } from "@playwright/test";
import { AuthBatch1Fixture } from "./support/auth-batch1-fixture";

const fixture = new AuthBatch1Fixture();

async function signIn(page: Page, email: string, password: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe.serial("Authentication E2E Batch 1", () => {
  test.beforeAll(() => {
    fixture.assertEnvironment();
  });

  test.afterAll(async () => {
    await fixture.dispose();
  });

  test("protected-route redirect, invalid credentials, and safe return URL", async ({ page }) => {
    const org = await fixture.createOrganization("redirect");
    const user = await fixture.createUser("redirect-owner");
    await fixture.addMembership(user.id, org.id, "OWNER");

    await page.goto("/companies");
    await expect(page).toHaveURL(/\/login\?next=%2Fcompanies/);

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();

    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/companies$/);

    await page.goto("/login?next=https://evil.example");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("sign-in/sign-out and request approval workflow", async ({ page }) => {
    const platformOrg = await fixture.createOrganization("platform-admin-org");
    const superAdmin = await fixture.createUser("super-admin", { platformRole: "SUPER_ADMIN" });
    await fixture.addMembership(superAdmin.id, platformOrg.id, "OWNER");

    const requestOrgName = `${fixture.runId}-request-org`;
    const requesterEmail = `${fixture.emailPrefix}-requester@example.test`;

    await page.goto("/request-access");
    await page.getByLabel("Organization Name *").fill(requestOrgName);
    await page.getByLabel("Your Name *").fill(`${fixture.runId}-requester`);
    await page.getByLabel("Email *").fill(requesterEmail);
    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.getByText("Request Submitted Successfully")).toBeVisible();

    await signIn(page, superAdmin.email, superAdmin.password, "/admin/organization-requests");
    await expect(page.getByRole("heading", { name: "Organization Requests" })).toBeVisible();
    await page.getByRole("row", { name: new RegExp(requestOrgName) }).click();
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByLabel("Slug *").fill(`${fixture.emailPrefix}-approved`);
    await page.getByRole("button", { name: "Confirm Approval" }).click();

    await expect
      .poll(async () => fixture.getOrganizationRequestStatus(requestOrgName))
      .toBe("APPROVED");

    await signOut(page);
    await page.goto("/companies");
    await expect(page).toHaveURL(/\/login\?next=%2Fcompanies/);
  });

  test("new invited user registers and accepts invitation", async ({ page }) => {
    const org = await fixture.createOrganization("new-invite-org");
    const owner = await fixture.createUser("new-invite-owner");
    await fixture.addMembership(owner.id, org.id, "OWNER");

    const invitedEmail = `${fixture.emailPrefix}-new-invite@example.test`;
    const invitedPassword = `${fixture.defaultPassword}A1`;

    await signIn(page, owner.email, owner.password, "/settings/members");
    await page.getByRole("button", { name: "Invite Member" }).click();
    await page.getByLabel("Email *").fill(invitedEmail);
    await page.getByLabel("Role *").selectOption("VIEWER");
    await page.getByRole("button", { name: "Send Invitation" }).click();
    const invitationUrl = await page.getByLabel("Invitation URL").inputValue();

    await signOut(page);
    await page.goto(invitationUrl);
    await page.getByRole("link", { name: "Create invited account" }).click();
    await page.getByLabel("Your name").fill(`${fixture.runId}-invitee`);
    await page.getByLabel("Password").fill(invitedPassword);
    await page.getByRole("button", { name: "Create invited account" }).click();

    const confirmMessage = page.getByText(/check your email to confirm your account/i);
    if (await confirmMessage.isVisible()) {
      await fixture.confirmUserByEmail(invitedEmail);
      await signIn(page, invitedEmail, invitedPassword, new URL(invitationUrl).pathname + new URL(invitationUrl).search);
    } else {
      await expect(page).toHaveURL(/\/invitations\/accept\?token=/);
    }

    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/$/);

    const acceptedUserId = await fixture.findUserIdByEmail(invitedEmail);
    expect(acceptedUserId).toBeTruthy();
    await expect
      .poll(async () => fixture.membershipCount(acceptedUserId!, org.id))
      .toBe(1);
  });

  test("existing user invitation, role boundaries, and tenant isolation controls", async ({ page, context }) => {
    const orgA = await fixture.createOrganization("org-a");
    const orgB = await fixture.createOrganization("org-b");
    const ownerA = await fixture.createUser("owner-a");
    const adminA = await fixture.createUser("admin-a");
    const viewerA = await fixture.createUser("viewer-a");
    const invitedExisting = await fixture.createUser("invited-existing");
    const dualUser = await fixture.createUser("dual-user");
    const wrongUser = await fixture.createUser("wrong-user");

    await fixture.addMembership(ownerA.id, orgA.id, "OWNER");
    await fixture.addMembership(adminA.id, orgA.id, "ADMIN");
    await fixture.addMembership(viewerA.id, orgA.id, "VIEWER");
    await fixture.addMembership(dualUser.id, orgA.id, "OWNER");
    await fixture.addMembership(dualUser.id, orgB.id, "VIEWER");

    const orgACompany = await fixture.createCompany(orgA.id, `${fixture.runId.slice(-5)}A`, `${fixture.runId}-A-Company`);
    const orgBCompany = await fixture.createCompany(orgB.id, `${fixture.runId.slice(-5)}B`, `${fixture.runId}-B-Company`);

    await signIn(page, ownerA.email, ownerA.password, "/settings/members");
    await page.getByRole("button", { name: "Invite Member" }).click();
    await page.locator('input[placeholder="user@example.com"]').fill(invitedExisting.email);
    await page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Select role…" }) })
      .first()
      .selectOption("VIEWER");
    await page.getByRole("button", { name: "Send Invitation" }).click();
    const invitationUrl = await page.getByLabel("Invitation URL").inputValue();
    await signOut(page);

    await signIn(page, wrongUser.email, wrongUser.password, "/");
    await page.goto(invitationUrl);
    await expect(page.getByText("This invitation is for")).toBeVisible();
    await signOut(page);

    await signIn(page, invitedExisting.email, invitedExisting.password, "/");
    await page.goto(invitationUrl);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () => fixture.membershipCount(invitedExisting.id, orgA.id))
      .toBe(1);
    await signOut(page);

    await signIn(page, viewerA.email, viewerA.password, "/companies");
    const createForbidden = await page.request.post("/api/companies", {
      data: { code: `${fixture.runId.slice(-5)}X`, name: `${fixture.runId}-forbidden`, type: "SHIPPING_LINE" },
    });
    expect(createForbidden.status()).toBe(403);
    await signOut(page);

    await signIn(page, adminA.email, adminA.password, "/");
    const ownerRoleAttempt = await page.request.patch(`/api/organization/members/${viewerA.id}`, {
      data: { role: "OWNER" },
    });
    expect(ownerRoleAttempt.status()).toBe(403);
    await signOut(page);

    await signIn(page, dualUser.email, dualUser.password, "/companies");
    await expect(page.getByText(orgACompany.name)).toBeVisible();
    await expect(page.getByText(orgBCompany.name)).toHaveCount(0);
    await page.getByLabel("Organization").selectOption(orgB.id);
    await expect(page.getByText(orgBCompany.name)).toBeVisible();
    await expect(page.getByText(orgACompany.name)).toHaveCount(0);

    const guessedForeignPatch = await page.request.patch(`/api/companies/${orgACompany.id}`, {
      data: { code: orgACompany.code, name: `${orgACompany.name}-updated` },
    });
    expect(guessedForeignPatch.status()).toBe(404);
    await signOut(page);

    await signIn(page, viewerA.email, viewerA.password, "/");
    await context.addCookies([
      {
        name: "active_organization_id",
        value: orgB.id,
        url: fixture.baseUrl,
      },
    ]);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    const meBody = (await me.json()) as { data: { activeOrganization: { id: string } } };
    expect(meBody.data.activeOrganization.id).toBe(orgA.id);

    const forgedSwitch = await page.request.post("/api/auth/active-organization", {
      data: { organizationId: orgB.id },
    });
    expect(forgedSwitch.status()).toBe(403);
  });
});
