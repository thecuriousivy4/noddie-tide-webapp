// Forseti policy registry.
//
// In the real build (section 6), these ids come from the two committed Forseti policies
// and `getPolicyBytes(label)` reads the signed bytes from the template's policy table.
// Here we keep the same label -> role mapping so the swap to the real SDK is a local change.

export type PolicyLabel = "custodian-records" | "restricted-women";

export interface PolicyDefinition {
  label: PolicyLabel;
  /** Realm role a caller must hold to ENCRYPT under this policy. */
  encryptRole: string;
  /** Realm role a caller must hold to DECRYPT — enforced at key release (the "network refusal"). */
  decryptRole: string;
  /** The data tag, matching the template's `doEncrypt` tags. */
  tag: string;
}

export const POLICIES: Record<PolicyLabel, PolicyDefinition> = {
  "custodian-records": {
    label: "custodian-records",
    encryptRole: "custodian",
    decryptRole: "custodian",
    tag: "site",
  },
  "restricted-women": {
    label: "restricted-women",
    encryptRole: "custodian-women",
    decryptRole: "custodian-women",
    tag: "restricted",
  },
};

export function policyForTag(tag: string): PolicyDefinition | undefined {
  return Object.values(POLICIES).find((p) => p.tag === tag);
}

export function isPolicyLabel(value: string): value is PolicyLabel {
  return value === "custodian-records" || value === "restricted-women";
}
