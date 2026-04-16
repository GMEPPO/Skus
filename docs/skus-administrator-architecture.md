# Skus Administrator

## Objetivo

Criar uma nova aplicação independente, com branding próprio `Skus Administrator`, reutilizando a mesma linguagem técnica e visual da app de referência:

- `Next.js 14` com App Router
- `TypeScript`
- `Tailwind CSS`
- `Supabase` para autenticação, base de dados e RLS
- visual administrativo dark com base `slate` e acentos `amber`
- shell protegida, navegação consistente, cards/tabelas/forms no mesmo estilo

O produto deve cobrir dois eixos principais:

1. administração de utilizadores e acessos
2. gestão e geração estruturada de SKUs por árvores configuráveis

---

## Princípios de arquitetura

- Separar claramente `dados mestres` de `regras de composição` e de `eventos de geração`.
- Tratar `família` como ponto de entrada funcional para uma árvore de composição.
- Modelar as dependências entre níveis através de nós e ligações, não com colunas fixas por família.
- Garantir que o SKU final é gerado de forma transacional, com sequência segura e sem duplicados.
- Manter UX administrativa simples para utilizadores gestores, mesmo com catálogos grandes.
- Preparar o sistema para futuras extensões: mais níveis, novos formatos de código, novas regras, auditoria e versões.

---

## Estrutura funcional da aplicação

### Áreas principais

1. `Auth`
- login
- logout
- recuperação de sessão
- controlo por papel/permissão

2. `Dashboard`
- visão geral de famílias
- SKUs gerados recentemente
- atividade administrativa
- alertas de configuração incompleta

3. `Administração de Utilizadores`
- listagem
- criação
- edição
- ativação/desativação
- perfis, papéis e permissões

4. `Vocabulário`
- gestão de palavras reutilizáveis
- gestão de referências curtas de 3 caracteres
- categorização por tipo de campo
- pesquisa, filtros e estado

5. `Famílias e Árvores`
- criação de famílias
- definição da sequência de campos
- definição de árvores de composição
- associação de palavras por nível
- regras dependentes entre opções
- interface visual com drag and drop

6. `Gerador de SKU`
- seleção sequencial por família
- campos dependentes
- designação em tempo real
- pré-visualização do SKU
- geração final com número sequencial

7. `Auditoria`
- histórico de alterações administrativas
- histórico de geração de SKUs
- rastreabilidade de quem alterou regras e dados mestres

---

## Proposta de navegação

### Rotas principais

```text
/login
/unauthorized
/dashboard
/generator
/generator/[familyId]
/admin/users
/admin/roles
/catalog/words
/catalog/field-types
/families
/families/new
/families/[id]
/families/[id]/builder
/families/[id]/preview
/sku-history
/audit
/settings
```

### Shell administrativa

Reaproveitar o mesmo padrão observado na app atual:

- `AppShell` protegida no grupo `app/(protected)`
- header fixo com branding `Skus Administrator`
- navegação horizontal ou lateral responsiva
- fundo `slate-900`
- superfícies `slate-800` e `slate-900/50`
- realces `amber-400`
- cards, tabelas, selects e formulários com os mesmos tokens

### Itens de navegação recomendados

- `Dashboard`
- `Gerador SKU`
- `Famílias`
- `Vocabulário`
- `Histórico`
- `Admin`

---

## Módulos principais

### 1. Módulo de utilizadores

#### Funcionalidades

- criar utilizador
- convidar utilizador com password temporária
- editar perfil
- associar papel
- ativar/desativar acesso
- ver último acesso
- filtrar por estado, papel e departamento

#### Componentes

- `UsersTable`
- `UserFormDialog`
- `RoleBadge`
- `PermissionMatrix`
- `UserStatusToggle`

### 2. Módulo de vocabulário

#### Conceito

O vocabulário é um catálogo mestre de termos reutilizáveis. Cada termo pode aparecer em vários contextos e em várias famílias.

#### Entidades funcionais

- palavra
- referência curta de 3 caracteres
- tipo de campo
- tags/contextos
- estado ativo/inativo

#### Componentes

- `WordTable`
- `WordFormDialog`
- `ReferencePill`
- `FieldTypeFilter`
- `UsageInspector`

### 3. Módulo de famílias e árvores

#### Conceito

Cada família define:

- que sequência de campos segue
- que árvore de dependências usa
- que opções são válidas em cada nível
- que regras de composição e apresentação aplica

#### Componentes

- `FamiliesTable`
- `FamilyForm`
- `TreeBuilderBoard`
- `FieldSequenceEditor`
- `AllowedOptionsPanel`
- `FamilyPreviewPanel`

### 4. Módulo de geração de SKU

#### Fluxo

1. escolher família
2. sistema carrega definição da árvore ativa
3. utilizador escolhe um valor no primeiro nível
4. sistema filtra o nível seguinte conforme as ligações válidas
5. designação atualiza em tempo real
6. utilizador confirma
7. sistema gera SKU final e reserva sequência

#### Componentes

- `SkuGeneratorWizard`
- `DependentStepSelect`
- `DesignationBar`
- `SkuPreviewCard`
- `GenerateSkuButton`
- `GenerationResultDialog`

---

## Estrutura técnica recomendada

### App layer

```text
app/
  (protected)/
    dashboard/
    generator/
    families/
    catalog/
    sku-history/
    admin/
    audit/
    layout.tsx
  api/
    families/
    generator/
    words/
    users/
    audit/
  login/
  unauthorized/
  layout.tsx
  globals.css
```

### Domínio e serviços

```text
components/
  app-shell.tsx
  admin/
  families/
  generator/
  catalog/
  ui/

lib/
  auth.ts
  rbac.ts
  supabase-server.ts
  supabase-browser.ts
  validations/
  users/
  families/
  vocabulary/
  sku/
  audit/
  types/
```

### Organização por domínio

- `lib/users`: perfis, convites, atribuição de papéis
- `lib/vocabulary`: palavras, referências, pesquisa, validação
- `lib/families`: famílias, definição de campos, árvores, publicação
- `lib/sku`: composição da designação, composição do código, sequência, locking
- `lib/audit`: registo de eventos administrativos

---

## Modelo de dados Supabase

## Tabelas nucleares

### `skus_profiles`

Perfis aplicacionais ligados a `auth.users`.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | igual a `auth.users.id` |
| `name` | `text` | nome apresentado |
| `email` | `text` | redundância útil para listagens |
| `role_id` | `uuid fk` | papel principal |
| `department` | `text null` | opcional |
| `is_active` | `boolean` | permite bloquear acesso |
| `created_at` | `timestamptz` | auditoria |
| `updated_at` | `timestamptz` | auditoria |

### `skus_roles`

Papéis funcionais.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `code` | `text unique` | `admin`, `manager`, `editor`, `viewer` |
| `name` | `text` | etiqueta |
| `description` | `text` | |

### `skus_permissions`

Permissões atómicas.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `code` | `text unique` | ex. `family.manage` |
| `name` | `text` | |

### `skus_role_permissions`

Ligação N:N entre papéis e permissões.

### `skus_field_types`

Define os tipos de nível que podem existir no fluxo.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `code` | `text unique` | `family`, `format`, `product`, `size`, `packaging`, `extra` |
| `name` | `text` | etiqueta |
| `description` | `text` | |
| `sort_order` | `int` | ordem sugerida |
| `is_active` | `boolean` | |

### `skus_words`

Catálogo mestre de palavras configuráveis.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `label` | `text` | ex. `Frasco` |
| `normalized_label` | `text` | para pesquisa/deduplicação |
| `reference_code` | `char(3)` | ex. `FRA` |
| `default_field_type_id` | `uuid fk` | tipo principal |
| `description` | `text null` | opcional |
| `is_active` | `boolean` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraint recomendada:

- `unique(normalized_label, default_field_type_id)`
- `check(reference_code ~ '^[A-Z0-9]{3}$')`

### `skus_word_contexts`

Permite dizer em que contextos uma palavra pode aparecer.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `word_id` | `uuid fk` | |
| `context_type` | `text` | ex. `brand`, `hotel_group`, `equipment` |
| `context_value` | `text` | opcional |

### `skus_families`

Famílias de composição.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `name` | `text unique` | ex. `Guerla` |
| `slug` | `text unique` | |
| `description` | `text null` | |
| `status` | `text` | `draft`, `active`, `archived` |
| `active_tree_version_id` | `uuid null` | aponta para versão publicada |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `skus_family_tree_versions`

Versionamento da configuração de árvore.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `family_id` | `uuid fk` | |
| `version_number` | `int` | |
| `status` | `text` | `draft`, `published`, `superseded` |
| `created_by` | `uuid fk` | perfil |
| `created_at` | `timestamptz` | |
| `published_at` | `timestamptz null` | |

### `skus_family_tree_levels`

Define a sequência de campos numa versão da família.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `tree_version_id` | `uuid fk` | |
| `field_type_id` | `uuid fk` | |
| `level_order` | `int` | 1..n |
| `label_override` | `text null` | se necessário |
| `is_required` | `boolean` | |
| `designation_included` | `boolean` | entra na barra Designação |

Unique recomendada:

- `unique(tree_version_id, level_order)`

### `skus_family_tree_level_words`

Liga palavras disponíveis a cada nível.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `tree_level_id` | `uuid fk` | |
| `word_id` | `uuid fk` | |
| `sort_order` | `int` | ordem visual |

### `skus_family_tree_edges`

Representa as dependências entre opções de níveis consecutivos.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `tree_version_id` | `uuid fk` | |
| `from_level_id` | `uuid fk` | |
| `from_word_id` | `uuid fk` | |
| `to_level_id` | `uuid fk` | |
| `to_word_id` | `uuid fk` | |
| `is_active` | `boolean` | |

Esta tabela é a peça central da lógica dependente.

Exemplo:

- `Guerla` no nível 1
- permite `Frasco` e `Bisnaga` no nível 2

### `skus_sku_sequences`

Define a sequência incremental por contexto.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `family_id` | `uuid fk` | |
| `prefix_key` | `text` | chave lógica do ramo |
| `last_value` | `bigint` | último número usado |
| `updated_at` | `timestamptz` | |

`prefix_key` deve ser derivada da combinação estrutural usada para garantir isolamento por ramo quando necessário.

### `skus_sku_generations`

Regista cada SKU criado.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `family_id` | `uuid fk` | |
| `tree_version_id` | `uuid fk` | |
| `generated_code` | `text unique` | SKU final |
| `designation` | `text` | descrição final |
| `sequence_value` | `bigint` | número sequencial |
| `prefix_snapshot` | `text` | parte alfa do código |
| `selection_snapshot` | `jsonb` | escolhas por nível |
| `generated_by` | `uuid fk` | utilizador |
| `created_at` | `timestamptz` | |

### `skus_admin_audit_logs`

Auditoria administrativa.

| coluna | tipo | notas |
|---|---|---|
| `id` | `uuid pk` | |
| `actor_id` | `uuid fk` | |
| `entity_type` | `text` | ex. `word`, `family`, `tree_version` |
| `entity_id` | `uuid` | |
| `action` | `text` | ex. `create`, `update`, `publish`, `generate_sku` |
| `payload` | `jsonb` | before/after ou resumo |
| `created_at` | `timestamptz` | |

---

## Relações principais

```text
auth.users 1---1 skus_profiles
skus_roles 1---N skus_profiles
skus_roles N---N skus_permissions

skus_field_types 1---N skus_words
skus_families 1---N skus_family_tree_versions
skus_family_tree_versions 1---N skus_family_tree_levels
skus_family_tree_levels N---N skus_words (via skus_family_tree_level_words)
skus_family_tree_versions 1---N skus_family_tree_edges

skus_families 1---N skus_sku_sequences
skus_families 1---N skus_sku_generations
skus_family_tree_versions 1---N skus_sku_generations
skus_profiles 1---N skus_admin_audit_logs
skus_profiles 1---N skus_sku_generations
```

---

## Fluxo de seleção dependente

### Abordagem

Em vez de hardcode por coluna, o frontend recebe:

- a sequência de níveis da família ativa
- as palavras válidas por nível
- as arestas de dependência entre níveis

### Algoritmo

1. carregar níveis ordenados da árvore publicada
2. mostrar apenas opções do primeiro nível
3. quando o utilizador escolhe um valor num nível:
- limpar todos os níveis seguintes
- procurar em `skus_family_tree_edges` todas as opções válidas para o nível seguinte
- filtrar a lista seguinte por essas ligações
4. repetir até ao último nível

### Regra importante

Cada nível depende do anterior, mas a modelação suporta expansões futuras:

- dependência por múltiplos pais
- regras compostas
- exclusões condicionais

Se for preciso evoluir, pode ser adicionada uma tabela `family_tree_rules` com condições em `jsonb`.

---

## Lógica da Designação

### Comportamento

A barra inferior `Designação` deve:

- estar sempre visível no gerador
- atualizar em tempo real
- concatenar os `labels` escolhidos pela ordem dos níveis
- ignorar níveis opcionais não preenchidos
- refletir exatamente a configuração da família

### Exemplo

Seleções:

- Família: `Guerla`
- Formato: `Frasco`
- Produto: `Shampoo`
- Tamanho: `300ml`
- Embalagem: `Caixa`

Designação:

```text
Guerla Frasco Shampoo 300ml Caixa
```

### Implementação

- função pura `buildDesignation(selections, levels)`
- fonte de verdade baseada na `selection_snapshot`
- preview local no cliente
- recomputação final no servidor antes de persistir

---

## Lógica de geração sequencial do SKU

### Estrutura recomendada

O SKU deve ter duas partes:

1. prefixo estrutural
2. sequência numérica

Exemplo:

```text
GUE-FRA-SHA-300-CAI-000124
```

Ou, se for necessário um formato mais compacto:

```text
GUEFRASHA300CAI000124
```

### Regras

- o prefixo é composto pelas `reference_code` de cada palavra escolhida
- a sequência é atribuída no momento da confirmação
- o código final tem `unique constraint`
- a operação deve ocorrer numa `RPC` ou transação SQL segura

### Estratégia recomendada no Supabase

Criar uma função `generate_sku_for_selection(...)` que:

1. valida a árvore ativa
2. valida se a combinação escolhida é permitida
3. recompõe prefixo e designação no servidor
4. bloqueia a linha adequada de `skus_sku_sequences` com `select ... for update`
5. incrementa `last_value`
6. monta o código final
7. tenta inserir em `skus_sku_generations`
8. devolve o SKU criado

### Prevenção de duplicados

- `unique(generated_code)`
- validação do ramo permitido
- geração em transação única
- snapshot da configuração usada no momento da geração

---

## Permissões e perfis

### Papéis recomendados

#### `admin`
- acesso total
- gere utilizadores, papéis, famílias, vocabulário e auditoria

#### `manager`
- gere vocabulário, famílias e gera SKUs
- não gere papéis críticos nem definições globais

#### `editor`
- pode gerar SKUs e consultar catálogos
- pode propor alterações, mas não publicar árvores

#### `viewer`
- consulta histórico e catálogos publicados

### Permissões atómicas

- `user.manage`
- `role.manage`
- `word.read`
- `word.manage`
- `family.read`
- `family.manage`
- `tree.publish`
- `sku.generate`
- `sku.read`
- `audit.read`

### RLS

Aplicar `Row Level Security` em todas as tabelas de negócio.

Abordagem prática:

- leitura baseada em permissões
- escrita apenas por funções ou server actions validadas
- operações sensíveis via `service role` apenas no servidor

---

## UX/UI recomendada

## Linguagem visual

Manter a mesma base visual da app atual observada:

- `html.dark`
- `bg-slate-900`
- superfícies em `slate-800` e `slate-900/50`
- `border-slate-700`
- destaques em `amber-400`
- tipografia `Inter`
- cards com raio médio e padding confortável

### Padrões de interface

- tabelas administrativas em cards
- formulários em grelha responsiva
- badges com estado
- feedback inline de sucesso/erro
- ações destrutivas discretas mas claras

### Experiência do gerador

Layout sugerido:

- coluna esquerda: passos do wizard
- coluna direita: resumo da família, ajuda contextual e preview de SKU
- barra inferior sticky: `Designação`

### Estado visual dos passos

- `pendente`
- `ativo`
- `preenchido`
- `bloqueado`

---

## Drag and Drop para famílias e árvores

### Objetivo

Permitir ao administrador compor visualmente:

- palavras disponíveis
- palavras atribuídas a cada nível
- ligações válidas entre níveis

### Biblioteca recomendada

Para `Next.js 14` com boa previsibilidade:

- `@dnd-kit/core`
- `@dnd-kit/sortable`

Motivos:

- melhor ergonomia moderna que `react-beautiful-dnd`
- flexível para listas e builder visual
- bom controlo sobre acessibilidade e sensores

### Interações sugeridas

1. painel esquerdo com `Biblioteca de Palavras`
2. colunas por nível da árvore
3. drag da palavra para o nível pretendido
4. ordenação manual dentro de cada nível
5. modo `Conectar` para desenhar permissões entre nível N e N+1

### Modelo de edição

- rascunho editável no cliente
- guardar como `draft`
- validar
- publicar versão

### Regras de usabilidade

- pesquisa instantânea na biblioteca
- filtro por tipo de campo
- preview das utilizações da palavra
- aviso de configurações órfãs
- validação visual de níveis sem opções

---

## Componentes administrativos necessários

- `AdminPageHeader`
- `StatsCardsRow`
- `DataTable`
- `FilterBar`
- `SearchInput`
- `StatusBadge`
- `ConfirmDialog`
- `EntityFormDrawer`
- `VersionTimeline`
- `TreeBuilderBoard`
- `WordLibraryPanel`
- `LevelColumn`
- `EdgeEditor`
- `DesignationBar`
- `SkuHistoryTable`
- `AuditLogTable`

---

## Server Actions e APIs recomendadas

### Server Actions

- criação/edição de utilizadores
- criação/edição de palavras
- criação/edição de famílias
- publicação de árvore
- geração de SKU

### Route Handlers

Úteis para dados dinâmicos do builder:

- `GET /api/families/:id/tree`
- `GET /api/families/:id/next-options?level=2&selectedWordId=...`
- `POST /api/generator/preview`
- `POST /api/generator/generate`

---

## Validações recomendadas

- `zod` para formulários e payloads
- normalização de `reference_code` para maiúsculas
- bloqueio de códigos com menos ou mais de 3 caracteres
- bloqueio de publicação se a árvore tiver níveis vazios
- bloqueio de publicação se existirem níveis inalcançáveis
- bloqueio de geração se a família não tiver versão publicada

---

## Plano de implementação por fases

### Fase 1. Fundação

- scaffold do projeto `Next.js 14 + TypeScript + Tailwind`
- setup Supabase SSR
- tokens visuais iguais à app atual
- auth, login, shell protegida, RBAC base

### Fase 2. Administração de utilizadores

- perfis
- papéis
- permissões
- listagem/criação/edição

### Fase 3. Dados mestres

- `skus_field_types`
- `skus_words`
- `skus_word_contexts`
- pesquisa, filtros, validações

### Fase 4. Famílias e builder

- criação de famílias
- níveis por versão
- associação de palavras por nível
- builder visual
- publicação de árvore

### Fase 5. Gerador de SKU

- wizard dependente
- barra `Designação`
- preview de código
- geração transacional

### Fase 6. Histórico e auditoria

- histórico de SKUs
- filtros
- auditoria administrativa

### Fase 7. Robustez

- testes de regras
- testes de geração concorrente
- performance para catálogos grandes
- hardening de RLS

---

## Decisões recomendadas já fechadas

- Projeto novo e independente.
- Base técnica alinhada com a app atual de referência: `Next.js 14`, `TypeScript`, `Tailwind`, `Supabase`.
- Identidade visual equivalente: dark slate com acentos amber.
- Dados mestres separados das regras de composição.
- Árvores versionadas por família.
- Geração de SKU feita no servidor de forma transacional.
- Drag and drop com `dnd-kit`.

---

## Próximo passo recomendado

Depois desta arquitetura, o melhor passo seguinte é implementar o projeto em três blocos técnicos:

1. scaffold da app + auth + shell
2. schema Supabase inicial com RLS e RPC de geração
3. primeiro vertical slice completo:
   `Words -> Family Builder -> Generator -> SKU persisted`

Esse slice valida o núcleo do produto antes de expandir auditoria, papéis finos e extras de UX.
