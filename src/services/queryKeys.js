export const queryKeys = {
  fractions: (tenantId) => ["fractions", { tenantId }],
  people: (tenantId) => ["people", { tenantId }],
  fractionParties: (tenantId) => ["fraction-parties", { tenantId }],
  charges: (tenantId) => ["charges", { tenantId }],
  payments: (tenantId) => ["payments", { tenantId }],
  issues: (tenantId) => ["issues", { tenantId }],
  documents: (tenantId) => ["documents", { tenantId }],
  auditLog: (tenantId) => ["audit-log", { tenantId }],
};
