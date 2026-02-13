# PRD V1 - Plataforma de Gestao de Condominios (Portugal)

## 1. Objetivo

Criar uma plataforma web/mobile para gestao de condominios em Portugal com foco em simplicidade de uso e cobertura equilibrada dos pilares:

- financeiro (quotas, dividas, recibos),
- operacional (ocorrencias e manutencao),
- governance (assembleias e comunicacao).

## 2. Publico-alvo

- Administradores profissionais de condominios (multi-condominio).
- Condominios autonomos (gestao interna).
- Condominos/proprietarios/arrendatarios (self-service).
- Fornecedores (intervencoes e orcamentos).

## 3. Metas da V1

- Registar e gerir um condominio completo em menos de 2 horas.
- Emitir quota em menos de 60 segundos.
- Abrir e classificar ocorrencia em menos de 45 segundos.
- Publicar convocatoria e ata de assembleia num fluxo unico.
- Disponibilizar portal de condomino com pagamentos e documentos.

## 4. Escopo funcional da V1

### 4.1 Gestao base

- Condominios, blocos, fracoes, lugares, arrecadacoes.
- Perfis e papeis: admin plataforma, gestor, condomino, fornecedor.
- Contactos e historico por fracao.

### 4.2 Financeiro

- Plano de quotas por fracao (mensal/trimestral/anual).
- Fundo comum de reserva.
- Lancamentos: quotas, pagamentos, juros, acertos.
- Conta-corrente por fracao.
- Recibos e comprovativos.
- Exportacao de relatorios (CSV/PDF).

### 4.3 Ocorrencias e manutencao

- Abertura de ticket com foto/anexo.
- Priorizacao, SLA, estados e responsavel.
- Ordem de trabalho e registo de custos.
- Encerramento com evidencias e feedback.

### 4.4 Assembleias e governance

- Convocatoria com ordem de trabalhos.
- Registo de presencas e procuracoes.
- Minuta de ata.
- Votacoes simples por ponto.

### 4.5 Documentos e comunicacao

- Repositorio documental por condominio e categoria.
- Controlo de visibilidade por perfil.
- Envio de comunicacoes por email.
- Log de notificacoes.

### 4.6 Portal do condomino

- Dashboard de saldo e pagamentos.
- Historico de quotas e recibos.
- Abertura e acompanhamento de ocorrencias.
- Consulta de documentos e avisos.

## 5. Fora de escopo da V1

- IA generativa para atendimento automatico.
- Assinatura eletronica qualificada.
- Motor completo de workflow low-code.
- Integracoes contabilisticas profundas com ERPs externos.

## 6. Integracoes alvo

- Pagamentos: MB Way, Referencia Multibanco, SEPA.
- Comunicacao: email, SMS, WhatsApp.
- Faseamento: preparar interfaces na V1 e ligar gateways comerciais apos selecao final de fornecedores.

## 7. Requisitos nao funcionais

- Multi-tenant por condominio/empresa gestora.
- Audit trail em operacoes sensiveis.
- Permissoes por papel e por recurso.
- Backups diarios.
- Disponibilidade alvo: 99.5%.
- Tempo medio de resposta API: < 400ms para operacoes comuns.

## 8. Compliance (rascunho tecnico)

- RGPD: minimizacao de dados, base legal por tratamento, direitos do titular.
- Registo de consentimentos quando aplicavel.
- Politica de retencao e apagamento.
- Encriptacao em transito e em repouso.
- DPA com subprocessadores.

## 9. KPI de produto

- Taxa de conclusao sem apoio > 90% nas tarefas criticas.
- Erro de utilizacao < 3% por tarefa critica.
- Reducao de chamadas administrativas > 35% em 6 meses.
- NPS > 50 apos 90 dias de uso ativo.
