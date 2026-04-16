# Skus Administrator

Aplicação administrativa independente para:

- gestão de utilizadores
- gestão de vocabulário e referências
- configuração de famílias e árvores de composição
- geração sequencial de códigos SKU

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase

## Arranque

1. Copiar `.env.example` para `.env.local`
2. Preencher as chaves do Supabase
3. Instalar dependências com `npm install`
4. Correr `npm run dev`

Se `SKIP_AUTH=true`, a app entra em modo demo com utilizador `admin`.

## Estrutura

- `app/` rotas e páginas
- `components/` UI e módulos
- `lib/` domínio, auth, RBAC e dados
- `supabase/schema.sql` schema inicial com todas as tabelas prefixadas por `skus_`
- `docs/skus-administrator-architecture.md` blueprint funcional/técnico
