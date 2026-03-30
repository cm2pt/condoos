# Error Handling

## Backend (Express 5)

### Route Handler Pattern
Express 5 automatically catches async errors — no need for `try/catch` wrappers on route handlers that just throw:

```js
// Express 5 catches this automatically
router.get("/api/resource/:id", authenticate, async (req, res) => {
  const item = await getItem(req.tenantId, req.params.id);
  if (!item) return res.status(404).json({ error: "Recurso não encontrado" });
  res.json(item);
});
```

### Error Response Format
```json
{ "error": "Mensagem em Português para o utilizador" }
```

### Status Codes
- `400` — Input inválido (campos em falta, formato errado)
- `401` — Não autenticado (JWT inválido/expirado)
- `403` — Sem permissão (role insuficiente)
- `404` — Não encontrado (ou fora do tenant scope)
- `409` — Conflito (duplicado, estado inválido para transição)
- `500` — Erro interno (logar erro completo, devolver mensagem genérica)

### Logging
Use `logger.js` for structured errors:
```js
import { logger } from "./logger.js";
logger.error("Falha ao processar pagamento", { tenantId, chargeId, error: err.message });
```

## Frontend (React 19)

### Error Boundaries
- Global error boundary em `App.jsx`
- Toast notifications para erros de API (via React Query `onError`)
- Mensagens de erro sempre em Português

### API Error Handling
```js
// React Query handles errors automatically
const { data, error, isError } = useCharges();
// Show error via toast or inline message
```

### Loading States
- Use `<Skeleton>` components during data loading
- Use `<EmptyState>` for zero-data scenarios
- Never show raw "Loading..." text — use branded skeletons
