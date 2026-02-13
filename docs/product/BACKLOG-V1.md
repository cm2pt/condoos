# Backlog V1 por Sprints (2 semanas)

## Sprint 0 - Fundacao tecnica

- [ ] Setup projeto backend/frontend.
- [ ] Autenticacao base e RBAC.
- [ ] Multi-tenant (escopo por condominio).
- [ ] Logging, metricas e auditoria minima.

Criterios de aceitacao:
- [ ] Login funcional por papel.
- [ ] Utilizador nao acede a dados de outro condominio.
- [ ] Operacoes sensiveis ficam registadas em audit_log.

## Sprint 1 - Cadastros nucleares

- [ ] CRUD de condominio.
- [ ] CRUD de fracao.
- [ ] CRUD de pessoas (proprietario/arrendatario/condomino).
- [ ] Associacao pessoa-fracao.

Criterios de aceitacao:
- [ ] Criar condominio e importar 30 fracoes via CSV.
- [ ] Consultar ficha de fracao com historico e contactos.

## Sprint 2 - Financeiro base

- [ ] Configurar plano de quotas.
- [ ] Gerar quotas periodicas.
- [ ] Registar pagamento manual.
- [ ] Emitir recibo e extrato de conta-corrente.

Criterios de aceitacao:
- [ ] Quotas geradas por periodo e por fracao.
- [ ] Saldo em aberto atualizado automaticamente.
- [ ] Recibo em PDF disponivel ao condomino.

## Sprint 3 - Ocorrencias e manutencao

- [ ] Abertura de ocorrencia com anexos.
- [ ] SLA, prioridade, atribuido, estados.
- [ ] Ordem de trabalho para fornecedor.
- [ ] Encerramento com custo e evidencia.

Criterios de aceitacao:
- [ ] Ticket percorre ciclo completo com historico.
- [ ] Gestor visualiza pendencias por prioridade.

## Sprint 4 - Assembleias e documentos

- [ ] Template de convocatoria.
- [ ] Registo de presencas/procuracoes.
- [ ] Template de ata.
- [ ] Repositorio documental com permissoes.

Criterios de aceitacao:
- [ ] Convocatoria e ata geradas para download.
- [ ] Documentos visiveis apenas por papeis permitidos.

## Sprint 5 - Portal do condomino

- [ ] Dashboard de saldo e avisos.
- [ ] Consulta de quotas, pagamentos e recibos.
- [ ] Abertura de ocorrencias pelo portal.
- [ ] Area de documentos e comunicacoes.

Criterios de aceitacao:
- [ ] Condomino executa tarefas criticas sem suporte.
- [ ] Tempo medio das tarefas abaixo dos objetivos da V1.

## Sprint 6 - Hardening e lancamento piloto

- [ ] Testes E2E dos fluxos principais.
- [ ] Ajustes UX a partir de testes reais.
- [ ] Politicas RGPD no produto.
- [ ] Preparacao de ambiente piloto.

Criterios de aceitacao:
- [ ] Build estavel e sem erros criticos.
- [ ] Checklist de go-live concluido.
- [ ] Base de dados sintetica disponivel para demo e QA.
