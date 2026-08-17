# Dicionario cosmetica v2 (por niveles)

Migracao incremental do novo diccionario de palabras com dependencias pai-filho.

## Ordem de execucao no Supabase SQL Editor

0. `supabase/migrations/20260817114500_allow_duplicate_word_references.sql`  
   Remove a unicidade de `reference_code` por nivel (varias palavras podem partilhar referencia).

1. `supabase/migrations/20260817120000_cosmetica_dictionary_dependencies.sql`  
   Cria a tabela `skus_word_parent_edges` para niveis 2-5.

2. `supabase/migrations/20260817120100_cosmetica_nivel1_brand_dictionary.sql`  
   Substitui **todas** as marcas (`brand`) da categoria `cosmetica`.

3. `supabase/migrations/20260817120200_cosmetica_nivel2_format_dictionary.sql`  
   Substitui **todos** os formatos (`format`) da categoria `cosmetica`, com traducoes PT/ES/EN conforme observacoes do Excel.

4. `supabase/migrations/20260817120300_cosmetica_nivel3_product_dictionary.sql`  
   Substitui **todos** os produtos (`product`) da categoria `cosmetica`.

5. `supabase/migrations/20260817120400_cosmetica_nivel4_size_dictionary.sql`  
   Substitui **todos** os tamanhos (`size`) + dependencias (375ml, 5L).

6. `supabase/migrations/20260817120500_cosmetica_word_selection_hierarchy.sql`  
   Coluna `selection_hierarchy` em `skus_words` (grupos 1=embalagem, 2=outros dados).

7. `supabase/migrations/20260817120600_cosmetica_nivel5_packaging_dictionary.sql`  
   Substitui **embalagens** hierarquia 1 (`packaging`) + dependencias.

8. `supabase/migrations/20260817120700_cosmetica_nivel6_extra_dictionary.sql`  
   Substitui **Outros** (`extra`): `nivel 6.xlsx` + hierarquia 2 do `Nivel 5.xlsx`.

9. `supabase/migrations/20260817120800_word_parent_match_mode.sql`  
   Coluna `parent_match_mode` (`any` / `all`) em `skus_words`.

## Regenerar SQL a partir do Excel

```bash
node scripts/generate-nivel1-brand-sql.mjs
node scripts/generate-nivel2-format-sql.mjs
node scripts/generate-nivel3-product-sql.mjs
node scripts/generate-nivel4-size-sql.mjs
node scripts/generate-nivel5-packaging-sql.mjs
node scripts/generate-nivel6-extra-sql.mjs
```

| Ficheiro Excel | Script | Migracao |
|----------------|--------|----------|
| `Desktop/nivel 1.xlsx` | `generate-nivel1-brand-sql.mjs` | `20260817120100_...` |
| `Desktop/Nivel 2.xlsx` | `generate-nivel2-format-sql.mjs` | `20260817120200_...` |
| `Desktop/Nivel 3.xlsx` | `generate-nivel3-product-sql.mjs` | `20260817120300_...` |
| `Desktop/Nivel 4.xlsx` | `generate-nivel4-size-sql.mjs` | `20260817120400_...` |
| `Desktop/Nivel 5.xlsx` | `generate-nivel5-packaging-sql.mjs` | `20260817120600_...` |
| `Desktop/nivel 6.xlsx` | `generate-nivel6-extra-sql.mjs` | `20260817120700_...` |

## Reglas de traduccion (nivel 2)

| Observacion Excel | Comportamiento |
|-------------------|----------------|
| `No traduzir` | PT = ES = EN |
| `traducir ES y EN` | Traduccion completa (Bisnaga, Frasco, Vela, etc.) |
| `... SOLO LA PALABRA GARRAFA ...` | Garrafa → Botella / Bottle; Ecofill igual |
| `... SOLO LA PALABRA RECARGA` | Recarga → Recarga / Refill; resto igual |

## Referencias partilhadas

Varias palavras no **mesmo nivel** podem usar a mesma abreviatura (ex.: varios produtos com `SAB`).
Na UI, ao criar/editar, aparece o aviso: **`X PALABRAS TIENEN ESA MISMA REFERENCIA`** (nao bloqueia).

## Aviso: referencia ECO duplicada (nivel 2)

No Excel, **Garrafa Ecofill** e **Recarga Ecofill** usam ambos a abreviatura `ECO`. No mesmo nivel so pode existir uma palavra activa com a mesma referencia. Corrigir uma das abreviaturas no Excel antes de aplicar em Supabase, ou a segunda insercao falhara.

## Modelo de dependencias

| Nivel | Depende de |
|------:|------------|
| 1 brand | Apenas categoria `cosmetica` (sem arestas) |
| 2 format | Apenas categoria `cosmetica` (sem arestas) |
| 3 product | Apenas categoria `cosmetica` (sem arestas) |
| 4 size | 375ml → **Recarga Ecosouc** (`ECS`); 5L → **Recarga 5L** (`REC`). Pais no **Formato** (`Nivel 2.xlsx`). Nas regras do Excel, "nivel 1" = Formato (nao Marcas). |
| 5 packaging (H1) | Ver tabela abaixo. `selection_hierarchy = 1`. |
| 6 extra | `nivel 6.xlsx` (1.8, V01–V06, cores…) + **H2** do `Nivel 5.xlsx` (`selection_hierarchy = 2`). |

### Embalagem hierarquia 1 (Nivel 5)

| Embalagem | Depende de (OR se varias linhas) |
|-----------|----------------------------------|
| Caixa, Flowpack, ALLEGRO | **Sabonete** / **Sabonete Esfoliante** (`SAB`, product) — nao liquidos |
| Papel | **Sais de Banho** (`SAI`, product) |
| Aluminio CLS/SLM, Polipropileno, Policarbonato | **Garrafa Ecofill** ou **Recarga Ecofill** (`ECO`, format) |

### Hierarquia (coluna Excel)

- **Hierarquia 1** (`1. Tipo de Embalagem`) → nivel 5 `packaging`, `selection_hierarchy = 1`.
- **Hierarquia 2** (`2. Outros Dados` no `Nivel 5.xlsx`) → incluidas na migracao **nivel 6** (`extra`), `selection_hierarchy = 2`.
- **Regra UI (pendente):** se nenhuma palavra H1 aplicavel/visivel no packaging, mostrar opcoes H2 no extra.

### Extra / Outros (nivel 6)

| Origem | Palavras | Notas |
|--------|----------|-------|
| `nivel 6.xlsx` | 1.8, V01–V06, Bordeaux, Branco, PRESTIGE | Sempre no fim da referencia |
| `Nivel 5.xlsx` H2 | CREME DE NOITE, ALGODÃO, ESFOLIANTE, etc. | Fallback se packaging H1 nao aplicavel |

| Extra | Depende de |
|-------|------------|
| 1.8 | **Garrafa Ecofill** ou **Recarga Ecofill** (`ECO`, format) |

## Reglas de traduccion (nivel 6)

| Observacion Excel | Comportamiento |
|-------------------|----------------|
| (vacio) | PT = ES = EN |
| `traducir` | Bordeaux→Burdeos, Branco→Blanco/White |
| H2 `TRADUCIR` / designacao vacia | Igual que regras do `Nivel 5.xlsx` |

## Reglas de traduccion (nivel 5)

| Observacion Excel | Comportamiento |
|-------------------|----------------|
| `NÃO TRADUZIR` | PT = ES = EN |
| `TRADUCIR` | Caixa→Caja/Box, Papel→Paper, PP/PC abreviados, etc. |
| `TRADUCIR SÓ ALUMINIO...` | Aluminio→Aluminum (EN); sufixo CLS/SLM mantem-se |
| `QUEDA VACIO LA DESIGNACION` | designacao vazia |

- Palavra **sem** arestas em `skus_word_parent_edges` → aparece sempre no seu nivel.
- Palavra **com** arestas → aparece se o(s) pai(s) estiver(em) seleccionado(s).
- Varias arestas para o **mesmo filho** (ex.: Garrafa + Recarga Ecofill) → logica **OR** no gerador (pendente implementar).
- Varias arestas exigindo **todos** os pais → logica **AND** (caso futuro).

## Proximos passos

- Actualizar o gerador (`category-catalog` + wizard) para filtrar por dependencias, hierarquia H1/H2 e logica OR.
- Aplicar todas as migracoes v2 em Supabase (ordem 0–8 acima).
