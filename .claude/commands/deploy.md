# Deploy

Corre os quality gates e faz push para production.

## Steps

1. Apagar test DB e correr testes backend:
```bash
rm -f backend/data/condoos.test.sqlite* && npm test
```

2. Correr testes frontend com cobertura:
```bash
npx vitest run --coverage
```

3. Build de produção:
```bash
npx vite build
```

4. Verificar estado git:
```bash
git status
```

5. Commit (se há alterações staged):
```bash
git add -A && git commit -m "Descrição das alterações"
```

6. Push para main:
```bash
git push origin main
```

7. Monitorizar CI:
```bash
gh run list --limit 1
gh run watch
```

8. Verificar deployment no Vercel (via MCP ou dashboard).
