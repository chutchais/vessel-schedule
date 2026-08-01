import assert from "node:assert/strict";
import test from "node:test";
import {
  VESSEL_LABEL_PLACEHOLDER_GROUPS,
  normalizeStoredVesselLabelConfig,
  validateVesselLabelConfigInput,
} from "./vessel-label";

test("legacy multi-line template is converted to structured lines with defaults", () => {
  const { config, migratedFromLegacy } = normalizeStoredVesselLabelConfig("{{vesselName}}\n{{serviceName}}\n{{voyageNumber}}");

  assert.equal(migratedFromLegacy, true);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.lines.length, 3);
  assert.equal(config.lines[0]?.fontWeight, "BOLD");
  assert.equal(config.lines[1]?.fontWeight, "REGULAR");
  assert.equal(config.lines[0]?.fontSize, "AUTO");
  assert.equal(config.lines[0]?.textAlign, "CENTER");
  assert.equal(config.lines[0]?.textColor, "AUTO");
});

test("server validation rejects invalid style enum values", () => {
  const invalid = validateVesselLabelConfigInput({
    lines: [
      {
        template: "{{vesselName}}",
        fontWeight: "BOLD",
        fontSize: "AUTO",
        textAlign: "MIDDLE",
        textColor: "AUTO",
      },
    ],
  });

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.match(invalid.error, /invalid textAlign/);
  }
});

test("server validation accepts BIG and BIGGER font sizes", () => {
  const valid = validateVesselLabelConfigInput({
    lines: [
      {
        template: "{{vesselName}}",
        fontWeight: "BOLD",
        fontSize: "BIG",
        textAlign: "CENTER",
        textColor: "AUTO",
      },
      {
        template: "{{serviceName}}",
        fontWeight: "REGULAR",
        fontSize: "BIGGER",
        textAlign: "CENTER",
        textColor: "AUTO",
      },
    ],
  });

  assert.equal(valid.ok, true);
});

test("VesselSchedule placeholder list includes remarks and berth duration", () => {
  const vesselSchedule = VESSEL_LABEL_PLACEHOLDER_GROUPS.find((group) => group.model === "VesselSchedule");
  assert.ok(vesselSchedule);
  const keys = new Set(vesselSchedule.placeholders.map((item) => item.key));
  assert.equal(keys.has("{{remarks}}"), true);
  assert.equal(keys.has("{{berthDuration}}"), true);
});
