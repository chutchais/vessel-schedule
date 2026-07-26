Implement the Vessel Schedule module for this Next.js App Router, TypeScript, Prisma, and Supabase project.

First inspect the existing Company, Port, Terminal, Vessel, and Berth modules. Follow their current folder structure, coding style, API response format, UI styling, Prisma conventions, and naming patterns.

Keep the implementation simple and beginner-friendly:

* Use direct Next.js route handlers.
* Use simple `if` statement validation.
* Do not use Zod.
* Do not introduce repository or service layers.
* Import Prisma using `import { prisma } from "@/lib/db/prisma";`.
* Do not modify unrelated modules.

## 1. Prisma schema

Add this enum:

```prisma
enum ScheduleStatus {
  PLANNED
  CONFIRMED
  ARRIVED
  BERTHED
  DEPARTED
  CANCELLED
}
```

Add a `VesselSchedule` model with:

```prisma
model VesselSchedule {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  vesselId String @db.Uuid
  vessel   Vessel @relation(fields: [vesselId], references: [id])

  terminalId String   @db.Uuid
  terminal   Terminal @relation(fields: [terminalId], references: [id])

  berthId String? @db.Uuid
  berth   Berth?  @relation(fields: [berthId], references: [id])

  voyageNumber String? @db.VarChar(50)

  eta DateTime
  etb DateTime?
  etd DateTime

  ata DateTime?
  atb DateTime?
  atd DateTime?

  status  ScheduleStatus @default(PLANNED)
  remarks String?

  berthPositionMeters Int?
  headingReverse      Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([vesselId])
  @@index([terminalId])
  @@index([berthId])
  @@index([eta])
  @@index([etd])
  @@index([status])
  @@map("vessel_schedules")
}
```

Add reverse relations:

```prisma
// Vessel
schedules VesselSchedule[]

// Terminal
schedules VesselSchedule[]

// Berth
schedules VesselSchedule[]
```

Adapt relation names only if required by the existing schema.

Create the migration with the name:

```bash
npx prisma migrate dev --name add_vessel_schedule
```

## 2. Schedule APIs

Create:

```text
GET  /api/schedules
POST /api/schedules
PATCH /api/schedules/[id]
```

### GET requirements

Return all schedules with these relationships:

* Vessel: `id`, `imoNumber`, `name`, and `callSign`
* Terminal: `id`, `code`, and `name`
* Terminal’s port: `id`, `code`, `name`, and `timezone`
* Berth: `id`, `code`, `name`, `color`, and `zeroOriginSide`

Sort schedules by `eta` ascending.

Use this response shape:

```json
{
  "data": []
}
```

### POST and PATCH validation

Validate the following:

* `vesselId` is required and must reference an existing vessel.
* `terminalId` is required and must reference an existing terminal.
* `berthId` is optional.
* If `berthId` is provided, the berth must exist.
* The selected berth must belong to the selected terminal.
* `eta` is required and must be a valid date.
* `etd` is required and must be a valid date.
* `etd` must be later than `eta`.
* `etb` is optional, but when provided it must be a valid date between `eta` and `etd`.
* `ata`, `atb`, and `atd` are optional but must be valid dates when provided.
* `status` must be one of the values in `ScheduleStatus`.
* Trim `voyageNumber` and `remarks`.
* Convert empty optional strings to `null`.

Only active vessels, terminals, and berths may be selected when creating a schedule. When editing an existing schedule, allow its currently selected records even if they have since become inactive.

### Berth overlap validation

When a berth is selected, reject schedules whose planned berth period overlaps another non-cancelled schedule assigned to the same berth.

Use `etb` as the planned start when available; otherwise use `eta`. Use `etd` as the planned end.

An overlap exists when:

```text
newStart < existingEnd AND newEnd > existingStart
```

For PATCH, exclude the current schedule ID from the overlap query.

Ignore schedules with status `CANCELLED`.

Return HTTP `409` with:

```json
{
  "error": "The selected berth already has an overlapping schedule"
}
```

Use suitable status codes:

* `400` for invalid input
* `404` for missing related records or schedule
* `409` for duplicate/conflicting schedules
* `500` for unexpected errors

## 3. Schedule management UI

Create:

```text
app/schedules/page.tsx
components/schedules/schedule-manager.tsx
```

The page should support:

* Loading the schedule list
* Loading vessels, terminals, and berths
* Creating schedules
* Editing schedules
* Searching schedules
* Filtering by status
* Filtering by terminal
* Filtering by date range
* Clear/reset filters
* Success and error messages
* Loading and saving states

### Form fields

Include:

* Vessel dropdown
* Voyage number
* Terminal dropdown
* Berth dropdown
* ETA
* ETB
* ETD
* ATA
* ATB
* ATD
* Status dropdown
* Remarks

Use `datetime-local` inputs.

The berth dropdown must show only berths belonging to the selected terminal. Clear `berthId` when the user changes the terminal and the selected berth does not belong to the new terminal.

Show active records in dropdowns. While editing, also show the schedule’s currently selected inactive records.

Convert `datetime-local` values to ISO UTC strings before sending them to the API. Convert API date strings into the correct `datetime-local` format when starting an edit.

### Schedule list

Display these columns:

* Vessel
* IMO number
* Voyage number
* Port
* Terminal
* Berth
* ETA
* ETB
* ETD
* Status
* Actions

Display dates using the port’s timezone when possible. Fall back to the browser timezone if the port timezone is missing or invalid.

Provide an Edit button for each schedule.

Use clear status badges:

* Planned
* Confirmed
* Arrived
* Berthed
* Departed
* Cancelled

Do not build the graphical berth timeline or calendar yet. This task is only the schedule database model, CRUD APIs, validation, filters, and list UI.

## 4. Final checks

After implementation, run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run lint
npm run build
git status
```

Fix all errors caused by the new Vessel Schedule module. Do not change unrelated existing code merely to remove pre-existing warnings.

Finally, summarize:

* Files created
* Files modified
* Migration created
* Validation rules implemented
* Results of Prisma validation, lint, and build
