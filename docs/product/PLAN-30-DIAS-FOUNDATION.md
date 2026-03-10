# Condoos - Plano Operacional de 30 Dias (Foundation)

## Metadata

- Versao: `1.0`
- Data de criacao: `2026-02-13`
- Janela do plano: `2026-02-16` ate `2026-03-17` (30 dias corridos)
- Dono: `CTO + Product`
- Estado: `proposto`

## 1. Objetivo do ciclo de 30 dias

Levar Condoos de `Prototype+` para `Foundation pronta para piloto interno`, com backend e frontend conectados nos fluxos core e com baseline de qualidade, seguranca e operacao.

## 2. Resultados obrigatorios no Dia 30

1. Frontend integrado com API para:
   - autenticacao e sessao;
   - dashboard;
   - fracoes;
   - encargos/pagamentos;
   - ocorrencias.
2. `src/App.jsx` parcialmente modularizado, com primeira fatia de dominios extraida.
3. Testes automáticos minimos ativos:
   - unit (regras financeiras e RBAC);
   - integration API (auth + tenant + fluxos core);
   - e2e para 3 jornadas criticas.
4. Pipeline CI minima ativa (build + smoke tests).
5. Baseline de seguranca e observabilidade:
   - rate limiting nas rotas de auth;
   - request-id e logs estruturados;
   - healthcheck e checklist de incidente.

## 3. Escopo deste plano

## Incluido

- Sprint 0 completo e Sprint 1/2/3 em fatias de maior risco.
- Integracao frontend-backend nos modulos core.
- Hardening minimo para piloto interno.

## Excluido

- Integracoes comerciais finais (pagamentos externos em producao).
- Funcionalidade avancada de assembleias e documentos.
- Migracao para PostgreSQL neste ciclo (fica preparada no desenho tecnico).

## 4. Equipa e ownership

- `CTO/Tech Lead`: arquitetura, decisões tecnicas, risco, qualidade final.
- `Eng. Backend`: APIs, RBAC, tenant scope, auditoria, testes integration.
- `Eng. Frontend`: integracao API, sessao, tenant context, modularizacao UI.
- `Fullstack/QA`: e2e, smoke tests, ambiente, quality gates.
- `Product`: priorizacao, aceitacao funcional, validacao de fluxos.

## 5. Workstreams (W)

## W1 - API Core e contratos

- Fechar contratos das rotas core.
- Padronizar erros HTTP e payloads.
- Endurecer auth e tenant resolution.

## W2 - Frontend integration e modularizacao

- Criar camada `api client`.
- Implementar `auth session` e `tenant context`.
- Migrar fluxos locais para API por dominio.
- Extrair modulos de `src/App.jsx`.

## W3 - Qualidade e testes

- Unit tests regras financeiras e RBAC.
- Integration tests API.
- E2E de jornadas criticas.

## W4 - Operacao e seguranca

- CI minima.
- Logging basico e request-id.
- Checklist de incidente e runbook curto.

## 6. Plano semanal (milestones)

## Semana 1 (`2026-02-16` a `2026-02-22`)

Objetivo: alinhar contratos e infraestrutura de integracao.

Entregas:

- Contrato API v1 para modulos core documentado.
- Camada inicial `api client` no frontend.
- Sessao auth (login/logout/token) funcional em ambiente local.
- Tenant context no frontend (header `x-tenant-id`).
- Estrutura inicial de testes no repositorio.

Gate:

- Login via UI usando backend e acesso a `/api/auth/me`.

## Semana 2 (`2026-02-23` a `2026-03-01`)

Objetivo: migrar dashboard + fracoes + ocorrencias para fonte de verdade server-side.

Entregas:

- Dashboard a ler da API.
- Lista/criacao de fracoes via API.
- Lista/criacao/atualizacao de estado de ocorrencias via API.
- Primeiro corte de modularizacao do frontend:
  - componentes por dominio;
  - estado central separado da vista.

Gate:

- Fluxos core funcionam sem depender de `localStorage` para dados primarios.

## Semana 3 (`2026-03-02` a `2026-03-08`)

Objetivo: fechar financeiro base + cobertura de testes integration.

Entregas:

- Encargos/pagamentos totalmente via API.
- Recalculo de estado de encargo validado por testes.
- Audit log validado para operacoes sensiveis.
- Integration tests para auth/tenant/finance/issues.

Gate:

- Smoke test end-to-end de cobranca/pagamento passa sem erros.

## Semana 4 (`2026-03-09` a `2026-03-15`)

Objetivo: hardening e readiness de piloto interno.

Entregas:

- E2E de 3 jornadas:
  - gestao: login -> criar encargo -> registar pagamento;
  - operacoes: abrir ocorrencia -> avancar estado;
  - controlo: validar audit trail.
- CI minima ativa (build + tests).
- Rate limiting auth + request-id + logs estruturados.
- Runbook v1 de incidente.

Gate:

- Build e quality gates verdes em branch principal.

## Buffer de estabilizacao (`2026-03-16` a `2026-03-17`)

Objetivo: resolver regressões, documentar estado final e preparar ciclo seguinte.

## 7. Plano diario (D1-D30)

- `D1 (2026-02-16)`: kick-off tecnico, congelar escopo, criar board de execucao.
- `D2`: definir contrato de erro API e convencoes de payload.
- `D3`: implementar `api client` base no frontend.
- `D4`: implementar auth session (login/logout/token refresh placeholder).
- `D5`: tenant context no frontend com seletor e persistencia de tenant ativo.
- `D6`: ligar `auth/me` e controlo de permissao basico na UI.
- `D7`: review semanal e corte de backlog.

- `D8 (2026-02-23)`: integrar dashboard com endpoint server-side.
- `D9`: integrar listagem de fracoes.
- `D10`: integrar criacao de fracao com feedback de erro/sucesso.
- `D11`: integrar listagem de ocorrencias.
- `D12`: integrar criacao de ocorrencia.
- `D13`: integrar transicao de estado de ocorrencia.
- `D14`: review semanal e estabilizacao.

- `D15 (2026-03-02)`: integrar listagem de encargos.
- `D16`: integrar criacao de encargo.
- `D17`: integrar listagem de pagamentos.
- `D18`: integrar criacao de pagamento e reflexo no estado do encargo.
- `D19`: validar trilho de auditoria na UI/backoffice tecnico.
- `D20`: escrever integration tests para finance/issues.
- `D21`: review semanal e hardening tecnico.

- `D22 (2026-03-09)`: montar suite E2E das 3 jornadas criticas.
- `D23`: configurar CI minima no repositorio.
- `D24`: adicionar rate limit em auth + politicas de falha segura.
- `D25`: request-id e logs estruturados em rotas core.
- `D26`: runbook de incidente v1 + checklist operacional.
- `D27`: bug bash interno + correcoes.
- `D28`: review semanal e go/no-go para fecho do ciclo.

- `D29 (2026-03-16)`: buffer para regressões e cleanup final.
- `D30 (2026-03-17)`: demo executiva, retro do ciclo e plano de proximos 30 dias.

## 8. Backlog priorizado deste ciclo

- `P30-001`: frontend auth session + tenant context.
- `P30-002`: dashboard server-driven.
- `P30-003`: fractions list/create via API.
- `P30-004`: issues list/create/status via API.
- `P30-005`: charges list/create via API.
- `P30-006`: payments list/create via API.
- `P30-007`: frontend modularizacao (extrair dominio dashboard/fractions/finance/issues).
- `P30-008`: contrato de erro padrao (API + frontend handlers).
- `P30-009`: integration tests auth/tenant/RBAC.
- `P30-010`: integration tests finance/issues/audit.
- `P30-011`: e2e 3 jornadas criticas.
- `P30-012`: CI pipeline minima.
- `P30-013`: rate limiting auth.
- `P30-014`: request-id + logging estruturado.
- `P30-015`: runbook incidente v1.

## 9. Definition of Done (DoD) para tarefas deste ciclo

- Codigo implementado com validacao basica de erro.
- Testes da camada correspondente escritos e a passar.
- Sem regressao funcional nos fluxos core.
- Documentacao atualizada (endpoint/fluxo afetado).
- Validado em ambiente local por outro membro da equipa.

## 10. Dashboard de acompanhamento (semanal)

- `% de tarefas concluidas no plano`.
- `% de fluxos core ja server-driven`.
- `numero de testes automatizados por tipo`.
- `tempo medio de resposta API p95 (local/staging)`.
- `defeitos P0/P1 abertos`.
- `risco geral do ciclo (baixo/medio/alto)`.

## 11. Riscos do ciclo e resposta

1. Risco: integracao frontend travar por arquitetura monolitica atual.
Resposta: modularizacao por fatias de dominio em paralelo com migracao de dados.

2. Risco: aumento de bugs por migracao simultanea de varios modulos.
Resposta: rollout por modulo, feature flags simples e smoke tests diarios.

3. Risco: qualidade insuficiente para fechar ciclo.
Resposta: congelar novas features no D22 e priorizar estabilizacao ate D30.

4. Risco: sobrecarga da equipa.
Resposta: limitar WIP, review quinzenal de escopo e kill-list de tarefas nao criticas.

## 12. Criterios de saida (Dia 30)

Plano concluido quando todos os pontos abaixo forem verdade:

- Fluxos core operam com backend como fonte de verdade.
- CI executa build + testes e bloqueia regressao obvia.
- RBAC e tenant scope validados em testes integration.
- Existe runbook operacional minimo para incidente.
- Existe plano fechado para os proximos 30 dias (com base na retro).

## 13. Template de atualizacao (documento vivo)

Atualizar este documento semanalmente com:

- `estado`: on-track | em-risco | atrasado.
- `percentagem concluida`.
- `bloqueios`.
- `decisoes tomadas`.
- `ajustes de escopo`.

## Changelog

| Versao | Data       | Mudanca                                   | Autor         |
|--------|------------|-------------------------------------------|---------------|
| 1.0    | 2026-02-13 | Primeira versao do plano operacional 30d  | CTO + Product |

