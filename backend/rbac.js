export const ROLE_PERMISSIONS = {
  manager: {
    tenants: ["read", "create", "update"],
    dashboard: ["read"],
    fractions: ["read", "create", "update", "delete"],
    people: ["read", "create", "update", "delete"],
    finance: ["read", "create", "update"],
    issues: ["read", "create", "update", "delete"],
    assemblies: ["read", "create", "update", "delete"],
    documents: ["read", "create", "update"],
    audit: ["read"],
  },
  accounting: {
    tenants: ["read"],
    dashboard: ["read"],
    fractions: ["read"],
    people: ["read"],
    finance: ["read", "create", "update"],
    issues: ["read"],
    documents: ["read", "create", "update"],
    audit: ["read"],
  },
  operations: {
    tenants: ["read"],
    dashboard: ["read"],
    fractions: ["read", "create"],
    people: ["read"],
    finance: ["read"],
    issues: ["read", "create", "update"],
    assemblies: ["read", "create", "update"],
    documents: ["read", "create"],
    audit: [],
  },
  resident: {
    tenants: ["read"],
    dashboard: ["read"],
    fractions: ["read"],
    people: ["read"],
    finance: ["read"],
    issues: ["read", "create"],
    documents: ["read"],
    audit: [],
  },
};

export const ROLE_UI_CAPABILITIES = {
  manager: {
    modules: ["dashboard", "fractions", "finance", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance", "issues", "assemblies"],
  },
  accounting: {
    modules: ["dashboard", "fractions", "finance", "portal", "documents", "compliance"],
    quickActions: ["fractions", "finance"],
  },
  operations: {
    modules: ["dashboard", "fractions", "finance", "issues", "assemblies", "portal", "documents", "compliance"],
    quickActions: ["fractions", "issues", "assemblies"],
  },
  resident: {
    modules: ["dashboard", "finance", "issues", "portal", "documents"],
    quickActions: ["issues"],
  },
};

export function can(role, resource, action) {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }

  return rolePermissions[resource]?.includes(action) ?? false;
}

export function getUiCapability(role) {
  const capability = ROLE_UI_CAPABILITIES[role];
  if (!capability) {
    return { modules: [], quickActions: [] };
  }

  return {
    modules: [...capability.modules],
    quickActions: [...capability.quickActions],
  };
}
