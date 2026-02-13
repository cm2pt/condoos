# Modelo de Dados V1 (Rascunho)

## Entidades principais

### condominium
- id (uuid)
- name
- tax_number
- address
- postal_code
- city
- country
- management_type (internal | professional)
- created_at
- updated_at

### fraction
- id (uuid)
- condominium_id (fk)
- code (ex: 5B)
- floor_number
- type (habitacao | loja | arrecadacao | estacionamento)
- typology (T0, T1, T2, T3, T4, N/A)
- private_area_m2
- permillage
- monthly_fee_amount
- status (active | inactive)

### person
- id (uuid)
- full_name
- tax_number
- email
- phone
- role_type (owner | tenant | resident | manager | supplier)
- gdpr_consent_at
- gdpr_deleted_at

### fraction_party
- id (uuid)
- fraction_id (fk)
- person_id (fk)
- relationship (owner | tenant | resident)
- start_date
- end_date
- is_primary

### charge
- id (uuid)
- condominium_id (fk)
- fraction_id (fk)
- kind (quota | reserve_fund | adjustment | penalty)
- period_start
- period_end
- due_date
- amount
- status (open | partially_paid | paid | overdue)

### payment
- id (uuid)
- condominium_id (fk)
- fraction_id (fk)
- charge_id (fk, nullable)
- method (bank_transfer | mbway | multibanco | sepa | cash)
- amount
- paid_at
- reference
- source (manual | imported)

### issue
- id (uuid)
- condominium_id (fk)
- fraction_id (fk, nullable)
- created_by_person_id (fk)
- category
- priority (low | medium | high | critical)
- status (new | triage | in_progress | waiting_supplier | resolved | closed)
- title
- description
- opened_at
- closed_at

### work_order
- id (uuid)
- issue_id (fk)
- supplier_person_id (fk)
- requested_at
- scheduled_at
- completed_at
- estimated_cost
- final_cost
- notes

### assembly
- id (uuid)
- condominium_id (fk)
- meeting_type (ordinary | extraordinary)
- scheduled_at
- location
- call_notice_sent_at
- minutes_document_id (fk, nullable)

### vote_item
- id (uuid)
- assembly_id (fk)
- item_number
- description
- voting_rule (simple_majority | permillage_majority | unanimity)

### vote
- id (uuid)
- vote_item_id (fk)
- fraction_id (fk)
- represented_by_person_id (fk)
- vote_value (for | against | abstention)
- represented_by_proxy (boolean)

### document
- id (uuid)
- condominium_id (fk)
- related_entity_type (assembly | issue | charge | contract | general)
- related_entity_id (uuid, nullable)
- category
- title
- storage_path
- visibility (manager_only | residents | all)
- uploaded_by_person_id (fk)
- uploaded_at

### notification
- id (uuid)
- condominium_id (fk)
- recipient_person_id (fk)
- channel (email | sms | whatsapp | push)
- subject
- body
- status (queued | sent | failed)
- sent_at

### audit_log
- id (uuid)
- condominium_id (fk)
- actor_person_id (fk)
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

## Relacoes chave

- condominium 1:N fraction
- fraction N:M person (via fraction_party)
- fraction 1:N charge
- charge 1:N payment
- condominium 1:N issue
- issue 1:N work_order
- condominium 1:N assembly
- assembly 1:N vote_item
- vote_item 1:N vote
- condominium 1:N document
- condominium 1:N notification
- condominium 1:N audit_log

## Regras de negocio essenciais

- Uma fracao pode ter varios titulares, mas apenas um titular principal ativo.
- Um pagamento pode liquidar total ou parcialmente um encargo.
- Uma ocorrencia fechada deve ter conclusao e custo final (quando aplicavel).
- Ata de assembleia deve ficar associada a documento versionado.
- Todas as alteracoes de dados financeiros e legais devem gerar audit_log.
