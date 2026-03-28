import { useMemo } from "react";

/**
 * Computa a lista de comandos da command palette.
 *
 * @param {object} params
 * @param {Array} params.availableModules - módulos acessíveis ao perfil
 * @param {Array} params.availableQuickActionTypes - tipos de criação rápida permitidos
 * @param {string} params.activeProfileLabel - label do perfil ativo
 * @param {string} params.commandQuery - termo de pesquisa na palette
 * @param {Function} params.navigateToContext - callback de navegação por contexto
 * @param {Function} params.openQuickActionType - callback para abrir quick action
 * @param {Function} params.handleExportCsv - callback de exportação CSV
 * @param {number} params.unreadCount - contagem de notificações não lidas
 * @param {Function} params.setIsCommandPaletteOpen - setter de estado da palette
 * @param {Function} params.setIsNotificationsOpen - setter de estado de notificações
 * @param {Function} params.setGlobalQuery - setter da pesquisa global
 * @returns {Array} lista de ações filtradas para a palette
 */
export function useCommandActions({
  availableModules,
  availableQuickActionTypes,
  activeProfileLabel,
  commandQuery,
  navigateToContext,
  openQuickActionType,
  handleExportCsv,
  unreadCount,
  setIsCommandPaletteOpen,
  setIsNotificationsOpen,
  setGlobalQuery,
}) {
  return useMemo(() => {
    const moduleActions = availableModules.map((module) => ({
      id: `cmd-module-${module.id}`,
      label: `Abrir ${module.label}`,
      detail: `Navegar para o módulo ${module.label}`,
      search: `${module.label} módulo navegar`,
      onSelect: () => navigateToContext({ module: module.id }),
    }));

    const quickCreateActions = availableQuickActionTypes.map((typeOption) => ({
      id: `cmd-create-${typeOption.id}`,
      label: `Criar ${typeOption.label.toLowerCase()}`,
      detail: "Abre o painel de registo rápido",
      search: `${typeOption.label} criar novo rápido`,
      onSelect: () => openQuickActionType(typeOption.id),
    }));

    const utilityActions = [
      {
        id: "cmd-export",
        label: "Exportar CSV do módulo atual",
        detail: `Preset ${activeProfileLabel}`,
        search: "csv exportar excel",
        onSelect: handleExportCsv,
      },
      {
        id: "cmd-notifications",
        label: "Abrir centro de alertas",
        detail: `${unreadCount} alertas por ler`,
        search: "alertas notificações inbox",
        onSelect: () => {
          setIsCommandPaletteOpen(false);
          setIsNotificationsOpen(true);
        },
      },
      {
        id: "cmd-clear-search",
        label: "Limpar pesquisa global",
        detail: "Remove termo de pesquisa e fecha resultados",
        search: "limpar pesquisa global",
        onSelect: () => {
          setGlobalQuery("");
          setIsCommandPaletteOpen(false);
        },
      },
    ];

    const term = commandQuery.trim().toLowerCase();
    const allActions = [...moduleActions, ...quickCreateActions, ...utilityActions];

    if (!term) {
      return allActions.slice(0, 12);
    }

    return allActions
      .filter((action) => `${action.label} ${action.detail} ${action.search}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [
    availableModules,
    availableQuickActionTypes,
    activeProfileLabel,
    commandQuery,
    navigateToContext,
    openQuickActionType,
    handleExportCsv,
    unreadCount,
    setIsCommandPaletteOpen,
    setIsNotificationsOpen,
    setGlobalQuery,
  ]);
}
