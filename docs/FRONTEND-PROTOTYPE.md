# Frontend Prototype - Estado Atual

Esta nota descreve o prototipo funcional de UI para a plataforma de gestao de condominios.

## Ecras implementados

- Painel de controlo com KPI, agenda, mapa por piso e atividade recente.
- Fracoes e titulares com filtros e tabela de saldos.
- Financeiro com cobranca mensal, distribuicao por metodo e encargos pendentes.
- Ocorrencias com kanban operacional e painel de detalhe (timeline, anexos e custos).
- Assembleias e votacoes com templates legais.
- Portal do condomino com conta-corrente, pagamentos, ocorrencias e documentos visiveis.
- Repositorio documental com pesquisa e visibilidade.
- Compliance RGPD com checklist e trilho de auditoria.
- Centro de alertas operacional (quotas em atraso, criticidade e proximas assembleias).
- Command palette com atalhos de teclado para navegar e executar acoes.
- Checklist de onboarding operacional dentro do painel de controlo.
- RBAC visual por perfil (modulos bloqueados e acoes rapidas filtradas).

## Acoes rapidas implementadas (drawer)

A app suporta criacao local de:

- Nova fracao.
- Novo encargo.
- Nova ocorrencia.
- Nova assembleia.

## Persistencia local

Os dados de sessao ficam guardados em `localStorage` com a chave `condoos_runtime_v1`.

Isto inclui:

- dados de fracoes/pessoas/encargos/ocorrencias/assembleias,
- atividade recente,
- ocorrencia atualmente selecionada no detalhe,
- fracao e encargo selecionados nos paines laterais,
- fracao ativa no portal do condomino,
- perfil ativo de exportacao,
- alertas ja lidos no centro de notificacoes.

## Exportacao CSV

O botao `Exportar CSV` esta funcional e exporta o dataset do modulo ativo.

A exportacao aplica preset por perfil operacional:

- `Gestao`
- `Contabilidade`
- `Operacoes`

Modulos suportados:

- Painel
- Fracoes
- Financeiro
- Ocorrencias
- Assembleias
- Portal do condomino
- Documentos
- Compliance

## Fluxo de ocorrencias (novo)

No modulo de ocorrencias:

- click num card do kanban abre detalhe na coluna lateral;
- botao `Mover para ...` avanca o estado no fluxo;
- quando vai para `Fornecedor`, cria ordem de trabalho automaticamente se nao existir;
- ao resolver/fechar, preenche dados finais de custo no registo da ordem.

## Atalhos de produtividade

- `Cmd+K` / `Ctrl+K` abre command palette.
- `Cmd+Shift+N` / `Ctrl+Shift+N` abre centro de alertas.
- `Esc` fecha overlays (comandos/alertas).

## Como testar manualmente

1. Abrir a app (`npm run dev`).
2. Criar registos pelas acoes rapidas.
3. Atualizar a pagina e validar persistencia.
4. Exportar CSV em cada modulo e validar ficheiro descarregado.
5. Em `Ocorrencias`, selecionar uma ocorrencia e avancar estados para validar timeline/custos.

## Modo de captura de ecras

Para screenshots automatizados, a app suporta query params:

- `?module=dashboard|fractions|finance|issues|assemblies|portal|documents|compliance`
- `&profile=manager|accounting|operations` define preset ativo no topo.
- `&q=texto` preenche pesquisa global para capturar dropdown de resultados.
- `&notifications=1` abre o centro de alertas no load.
- `&command=1` abre command palette no load.
- `&cmdq=texto` preenche pesquisa da command palette.
- `&capture=1` desativa animacoes para captura deterministica.
- `&quickAction=1&actionType=fractions|finance|issues|assemblies` abre o drawer automaticamente.

Exemplo:

`http://127.0.0.1:4174/?module=dashboard&profile=operations&q=infiltra&capture=1`

## Capturas recentes

- `artifacts/screens/25-dashboard-search-profile.png`
- `artifacts/screens/26-fractions-detail-panel-v2.png`
- `artifacts/screens/27-finance-detail-panel-v2.png`
- `artifacts/screens/28-issues-detail-panel-v3.png`
- `artifacts/screens/29-issues-drawer-profile.png`
- `artifacts/screens/30-mobile-dashboard-search-profile.png`
- `artifacts/screens/31-mobile-finance-v2.png`
- `artifacts/screens/32-mobile-issues-drawer.png`
- `artifacts/screens/33-dashboard-onboarding-v3.png`
- `artifacts/screens/34-dashboard-notifications.png`
- `artifacts/screens/35-dashboard-command-palette.png`
- `artifacts/screens/36-command-filtered-encargo.png`
- `artifacts/screens/37-mobile-dashboard-onboarding-v3.png`
- `artifacts/screens/38-mobile-notifications.png`
- `artifacts/screens/39-mobile-command-palette.png`
- `artifacts/screens/40-issues-notification-jump-ready.png`
- `artifacts/screens/41-dashboard-rbac-accounting.png`
- `artifacts/screens/42-portal-manager-desktop.png`
- `artifacts/screens/43-compliance-audit-desktop.png`
- `artifacts/screens/44-command-palette-accounting-rbac.png`
- `artifacts/screens/45-quick-action-operations-rbac.png`
- `artifacts/screens/46-mobile-portal-manager.png`
- `artifacts/screens/47-mobile-compliance-audit.png`
- `artifacts/screens/48-mobile-rbac-notifications-accounting.png`

## Limitacoes atuais

- Sem backend/API nesta fase (apenas estado local no browser).
- RBAC ainda e visual/local (sem enforcement de backend, autenticacao real ou sessao por utilizador).
- Presets CSV estao definidos por perfil base e ainda nao sao personalizaveis por utilizador individual.
