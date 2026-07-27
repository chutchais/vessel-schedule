Keep the existing Default Organization and create the first Super Admin through Supabase Auth plus the bootstrap script from Prompt 2.

1. Create the Auth user

In Supabase Dashboard:

Open Authentication → Users.
Click Add user → Create new user.
Enter the administrator email.
Enter a strong temporary password.
Enable Auto Confirm User for this manually created administrator.
Create the user.
Copy the user’s UUID.

Supabase Admin user creation must remain server-side; never expose the secret/service-role key in browser code. Supabase documentation

2. Confirm the Default Organization slug

Open Prisma Studio:

npx prisma studio

Check the Organization table. It should contain something similar to:

name: Default Organization
slug: default
isActive: true

Use the actual slug if it differs from default.

3. Configure bootstrap variables

Add these to the local environment file loaded by the bootstrap script:

BOOTSTRAP_AUTH_USER_ID="uuid-copied-from-supabase"
BOOTSTRAP_USER_EMAIL="admin@example.com"
BOOTSTRAP_USER_DISPLAY_NAME="Platform Administrator"
BOOTSTRAP_ORGANIZATION_SLUG="default"

Do not add the administrator’s password. The password exists only in Supabase Auth.

Confirm the environment file is ignored:

git check-ignore .env.local

If the script loads .env rather than .env.local, use that file and confirm it is also ignored.

4. Run the bootstrap

Check that the command exists:

npm run

Then run:

npm run bootstrap:super-admin

Expected result:

User
├── id = Supabase Auth UUID
├── platformRole = SUPER_ADMIN
└── isActive = true

OrganizationMember
├── organization = Default Organization
├── role = OWNER
└── isActive = true

Run it once more to test idempotency:

npm run bootstrap:super-admin

It should not create duplicate users or memberships.

5. Verify

Using Prisma Studio, check:

User
id           = exact Supabase Auth UUID
email        = administrator email
platformRole = SUPER_ADMIN
isActive     = true
OrganizationMember
userId         = administrator UUID
organizationId = Default Organization ID
role           = OWNER
isActive       = true
6. Test login

Start the application:

npm run dev

Open:

http://localhost:3000/login

Sign in using the Supabase email and password.

Verify:

Login succeeds.
Default Organization is active.
Organization role is Owner.
Platform administration navigation appears.
Organization Requests are accessible.
Other organization data remains isolated.
7. Clean up

After successful bootstrap, remove these temporary local variables:

BOOTSTRAP_AUTH_USER_ID
BOOTSTRAP_USER_EMAIL
BOOTSTRAP_USER_DISPLAY_NAME
BOOTSTRAP_ORGANIZATION_SLUG

Keep the bootstrap script for controlled recovery, but it must remain idempotent and must never contain hardcoded credentials.