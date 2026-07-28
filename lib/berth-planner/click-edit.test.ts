import test from "node:test";
import assert from "node:assert/strict";
import { buildEditFormValues, type EditableSchedule } from "./click-edit";

const baseSchedule: EditableSchedule = {
  id: "s1",
  vesselId: "v1",
  serviceId: "svc1",
  voyageNumber: "V001",
  terminalId: "t1",
  berthId: "b1",
  eta: "2024-01-15T08:00:00.000Z",
  etb: "2024-01-15T09:00:00.000Z",
  etd: "2024-01-15T12:00:00.000Z",
  ata: null,
  atb: null,
  atd: null,
  status: "PLANNED",
  remarks: "Test remarks",
  berthPositionMeters: 50,
  headingReverse: false,
};

test("maps required non-date fields to form values", () => {
  const form = buildEditFormValues(baseSchedule);
  assert.equal(form.vesselId, "v1");
  assert.equal(form.serviceId, "svc1");
  assert.equal(form.voyageNumber, "V001");
  assert.equal(form.terminalId, "t1");
  assert.equal(form.berthId, "b1");
  assert.equal(form.status, "PLANNED");
  assert.equal(form.remarks, "Test remarks");
  assert.equal(form.berthPositionMeters, "50");
  assert.equal(form.headingReverse, false);
});

test("converts null optional fields to empty strings", () => {
  const form = buildEditFormValues({
    ...baseSchedule,
    serviceId: null,
    voyageNumber: null,
    berthId: null,
    ata: null,
    atb: null,
    atd: null,
    remarks: null,
    berthPositionMeters: null,
  });
  assert.equal(form.serviceId, "");
  assert.equal(form.voyageNumber, "");
  assert.equal(form.berthId, "");
  assert.equal(form.ata, "");
  assert.equal(form.atb, "");
  assert.equal(form.atd, "");
  assert.equal(form.remarks, "");
  assert.equal(form.berthPositionMeters, "");
});

test("converts berthPositionMeters number to string", () => {
  assert.equal(buildEditFormValues({ ...baseSchedule, berthPositionMeters: 0 }).berthPositionMeters, "0");
  assert.equal(buildEditFormValues({ ...baseSchedule, berthPositionMeters: 123 }).berthPositionMeters, "123");
  assert.equal(buildEditFormValues({ ...baseSchedule, berthPositionMeters: null }).berthPositionMeters, "");
});

test("preserves headingReverse boolean", () => {
  assert.equal(buildEditFormValues({ ...baseSchedule, headingReverse: true }).headingReverse, true);
  assert.equal(buildEditFormValues({ ...baseSchedule, headingReverse: false }).headingReverse, false);
});

test("maps all valid schedule statuses", () => {
  for (const status of ["PLANNED", "CONFIRMED", "ARRIVED", "BERTHED", "DEPARTED", "CANCELLED"]) {
    assert.equal(buildEditFormValues({ ...baseSchedule, status }).status, status);
  }
});

test("eta and etd produce non-empty datetime-local strings from valid ISO dates", () => {
  const form = buildEditFormValues(baseSchedule);
  assert.match(form.eta, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.match(form.etd, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test("null etb produces empty string", () => {
  assert.equal(buildEditFormValues({ ...baseSchedule, etb: null }).etb, "");
});

test("non-null ata/atb/atd produce datetime-local strings", () => {
  const form = buildEditFormValues({
    ...baseSchedule,
    ata: "2024-01-15T08:30:00.000Z",
    atb: "2024-01-15T09:00:00.000Z",
    atd: "2024-01-15T12:00:00.000Z",
  });
  assert.match(form.ata, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.match(form.atb, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.match(form.atd, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
