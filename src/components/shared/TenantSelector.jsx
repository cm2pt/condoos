import Icon from "./Icon.jsx";

/**
 * Seletor de condominio - visivel apenas quando o utilizador tem acesso a 2+ condominios.
 * Mostra nome + cidade de cada tenant num dropdown.
 */
export default function TenantSelector({ tenants, selectedTenantId, onTenantChange }) {
  if (!tenants || tenants.length < 2) {
    return null;
  }

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];

  return (
    <div className="tenant-selector">
      <label className="tenant-selector-label" htmlFor="tenant-select">
        <Icon name="ArrowLeftRight" size={12} />
        <span>Mudar condominio</span>
      </label>
      <select
        id="tenant-select"
        className="tenant-selector-select"
        value={selectedTenant.id}
        onChange={(e) => onTenantChange(e.target.value)}
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}{tenant.city ? ` — ${tenant.city}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
