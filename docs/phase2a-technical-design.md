# Fase 2A — Contrato técnico (diseño)

**Estado:** DISEÑO autorizado · **Implementación 2B:** NO autorizada  
**Proyecto:** Skus Administrator · GGMPI (`skus_*` only)  
**Base:** Fase 1A SQL funcionalmente aprobada · cierre admin privilegios OK  
**Fecha:** 2026-08-05

---

## 0. Resumen

La Fase 2A define el contrato servidor para:

1. Catálogo dinámico **categoría → niveles → palabras** (`category_level_id`).
2. Generación SKU **segura** (código y designaciones en servidor; no confiar en el cliente).
3. **selection_snapshot**: leer v1/v2; escribir solo v2 en generaciones nuevas.
4. Diseño de `complete_sku_normalization` (una sola TX); sin implementar aún.
5. Corrección del defecto de secuencias (`upsert last_value=1` sin incremento).

**Privilegios:** lecturas `authenticated` + SELECT; escrituras vía service role en Actions (patrón actual), salvo RPCs `SECURITY DEFINER` con `auth.uid()` (claim/renew/release y futuras generate/complete).

---

## 1. Estado actual que debe cambiar

### `lib/sku-actions.ts` — `generateSkuAction`
- Zod exige `generatedCode` del cliente → forjable.
- Guarda `selectionSnapshot` sin validar membresía.
- Designaciones vienen del cliente.
- No hay `categoryId` / no rellena `category_id`.
- No pone `snapshot_version=2`.
- Sin chequeo explícito `canGenerateSku`.
- Secuencia: `upsert({ last_value: 1 })` **sin incremento real**.

### `lib/generator-data.ts`
- Lee por `default_field_type_id`; ignora categorías/niveles/`category_level_id`.

### `lib/admin-catalog.ts`
- Words solo con `fieldTypeId` → `default_field_type_id`.
- No escribe `category_level_id`.
- `deleteWordAction` hace DELETE duro.

### Wizard (`sku-generator-wizard-main.tsx`)
- Hidden `generatedCode` = preview cliente.
- Snapshot forma v1 (`Record<levelId, wordId|"__empty__:…">`).
- Required hardcode `fieldType !== "extra"`; no usa `is_required` de BD.

### `lib/sku.ts`
- Preview concatena todos los niveles; no respeta `participates_in_code` / `is_enabled`.

### Fase 1A ya en GGMPI
- 5 categorías; 6 niveles Cosmética; resto vacío.
- Locks claim/renew/release OK.
- `complete_sku_normalization` no existe.

---

## 2. Alcance / non-goals

**In scope (diseño → 2B):** catálogo, generación segura, snapshot v1/v2, contrato RPC complete + allocate, Zod/actions/TX.

**Out of scope 2A:**
- UI nueva multi-categoría / admin niveles (contrato first).
- Import Excel (tablas listas; OK2 ya decidido).
- Índice unique `reference_code` hasta resolver abbr conflictivas.
- Reescritura de snapshots históricos.
- Greenfield / drop `default_field_type_id`.

Deuda: `PHASE1A-GREENFIELD-VALIDATION`.

---

## 3. Catálogo dinámico

### Tipos

```ts
export interface SkuCategory {
  id: string; slug: string; name: string; sortOrder: number; isActive: boolean;
}
export interface CategoryLevel {
  id: string; categoryId: string; key: string; label: string;
  sortOrder: number; isEnabled: boolean; isRequired: boolean;
  participatesInCode: boolean; legacyFieldTypeId: string | null;
}
export interface CatalogWord {
  id: string; categoryLevelId: string; defaultFieldTypeId: string;
  label: string; referenceCode: string; // /^[A-Z0-9&.]{1,3}$/
  designationPt/Es/En: string; includeInDesignation: boolean; isActive: boolean;
}
export interface GeneratorCatalogV2 {
  category: SkuCategory;
  levels: Array<CategoryLevel & { options: CatalogWord[] }>;
}
```

### Lectura
| Función | Rol | Notas |
|---|---|---|
| `getCategories` | viewer+ | `is_active` |
| `getCategoryLevels(categoryId)` | viewer+ | orden `sort_order` |
| `getGeneratorCatalogForCategory(categoryId)` | viewer/editor | levels `is_enabled` + words activas por `category_level_id` |

Reemplaza agrupación por `default_field_type_id`.

### Mutaciones niveles (manager+)
- `createCategoryLevelAction` / `updateCategoryLevelAction`
- `deactivateCategoryLevelAction` (`is_enabled=false`) si hay dependencias; **no DELETE** con words (`ON DELETE RESTRICT`)
- Categorías: 5 fijas; no CRUD en 2A

### Mutaciones words
- Zod: `categoryLevelId` obligatorio; `defaultFieldTypeId` opcional → derivar de `legacy_field_type_id`
- Soft-delete: `is_active=false` (reemplaza delete duro)
- Sin unique `reference_code` en 2A

---

## 4. Generación segura

### Entrada autoritativa (dejar de confiar en cliente)

```ts
const generateSkuInputSchema = z.object({
  categoryId: z.string().uuid(),
  selections: z.record(
    z.string().uuid(), // levelId
    z.union([z.string().uuid(), z.literal("__empty__"), z.null()]),
  ),
  unitsPerBox: z.coerce.number().positive(),
  unitsPerBoxStatus: z.enum(["real", "estimated"]),
  multiples: z.coerce.number().positive(),
  multiplesStatus: z.enum(["real", "estimated"]),
  weight: z.coerce.number().positive(),
  weightStatus: z.enum(["real", "estimated"]),
});
```

Eliminar confianza en: `generatedCode`, designaciones cliente, snapshot como fuente de verdad.

### Pipeline servidor
1. Auth + rol ≥ editor  
2. Parse Zod  
3. Reload categoría + levels + words  
4. Validar membresía / flags  
5. Build designations + prefix en servidor  
6. Allocate sequence atómico  
7. INSERT generation (`category_id`, `snapshot_version=2`, snapshot v2)  
8. measurement_history + revalidate  

### Validación (por level `is_enabled`, orden `sort_order`)
- `is_required` sin selección → `level_required`
- word no pertenece al level → `word_not_in_level`
- word inactiva → `word_inactive`
- empty + required → reject
- empty + `participates_in_code` → segmento `"000"`
- level otra categoría → `unknown_level`
- `participates_in_code=false` → no entra en prefix

Usar flags BD; no hardcode `extra`.

### Preferencia TX
RPC `SECURITY DEFINER` `generate_sku_secure(p_payload jsonb)` con JWT usuario (allocate + insert en una TX).  
Action: Zod + storage imagen + llama RPC.

---

## 5. Snapshot

| Caso | Acción |
|---|---|
| Histórico `snapshot_version=1` | No tocar |
| Lectura | `readSelectionSnapshot` discrimina v1/v2 |
| Nuevas / complete | siempre v2 |

**v1 (solo lectura):** `Record<levelId, wordId | "__empty__:…">`

**v2 (escritura):**
```ts
{
  version: 2;
  categoryId: string;
  categorySlug: string;
  levels: Array<{
    levelId: string; key: string; label: string; sortOrder: number;
    isRequired: boolean; participatesInCode: boolean;
    selection:
      | { kind: "word"; wordId: string; label: string; referenceCode: string }
      | { kind: "empty" };
  }>;
}
```

---

## 6. Secuencias — decisión

**Rechazado:** upsert `last_value=1`, read-then-write en React/Action, Sequence DDL dinámico por prefix.

**Elegido:** contador `skus_sku_sequences` + `SELECT … FOR UPDATE` / `last_value = last_value + 1` dentro de RPC.

`prefix_key` = prefix estructural **sin** sufijo de secuencia.

**Formato `generated_code` (recomendación, pendiente OK supervisor):**
```text
{prefix}-{sequence padded 6}
ej. ALG-SOL-SAB-100-ALE-000-000001
```

Alternativa de negocio: un solo SKU por prefijo → error `sku_combo_exists` (pregunta abierta).

---

## 7. `complete_sku_normalization` (diseño only)

```sql
create function public.complete_sku_normalization(
  p_normalization_id uuid,
  p_payload jsonb  -- categoryId, selections, medidas; SIN generatedCode cliente
) returns public.skus_code_normalizations
language plpgsql security definer set search_path = '';
```

Pasos atómicos:
1. `auth.uid()` + rol ≥ editor  
2. Lock row `FOR UPDATE`: pending + owner + `lock_expires_at >= now()`  
3. Validar payload = mismas reglas que generate  
4. Build + allocate + INSERT generation (v2)  
5. UPDATE normalization → completed + finals + clear lock  
6. Cualquier fallo → rollback total  

Action 2B: cliente **authenticated** (JWT), no service role bypass.

---

## 8. Mapa actions / errores

| Nombre | Capa | Rol |
|---|---|---|
| getCategories / getGeneratorCatalogForCategory | read | viewer+ |
| create/update/deactivate CategoryLevel | action | manager+ |
| create/update/deactivate Word v2 | action | manager+ |
| generateSkuAction → `generate_sku_secure` | RPC TX | editor+ |
| claim/renew/release | RPC (ya) | editor+ |
| complete_sku_normalization | RPC (diseño) | editor+ |

Errores estables: `not_authenticated` · `forbidden` · `invalid_payload` · `level_required` · `word_not_in_level` · `word_inactive` · `unknown_level` · `sequence_failed` · `sku_combo_exists` · `lock_expired` · `locked_by_other_user` · `completed` · `cancelled` · …

---

## 9. Preguntas abiertas (antes de 2B)

1. ¿`generated_code` con sufijo secuencia padded (recomendado) o un SKU por prefijo?
2. ¿Actualizar `is_required` Cosmética (brand…packaging true; extra false)?
3. ¿Niveles en categorías vacías: keys libres o set fijo?
4. ¿Words sin `legacy_field_type_id`: bloquear, field_types espejo, o nullable `default_field_type_id`?
5. ¿Medidas obligatorias en complete normalization?
6. ¿Confirmar RPC única `generate_sku_secure`?
7. ¿Padding 6 dígitos y separador `-`?
8. ¿Reactivar words/levels (is_active/is_enabled)?
9. ¿Cuándo resolver abbr conflictivas + unique reference_code?
10. ¿Default categoría = `cosmetica` hasta UI multi-cat?

---

## 10. Criterios de cierre 2A

- [x] Catálogo dinámico especificado  
- [x] Generación segura sin generatedCode cliente  
- [x] Snapshot v1 read / v2 write  
- [x] complete_sku_normalization TX diseñado  
- [x] Secuencias FOR UPDATE elegidas; anti-patrones rechazados  
- [x] Zod / actions / TX mapeados  
- [x] Non-goals + open questions  

**Siguiente:** revisión supervisor → respuestas §9 → autorización Fase 2B.

---

## 14. Enmienda supervisor (2026-08-05) — 2A aprobada con modificaciones

### Decisiones §9
1. **Un SKU por combinación** — sin sufijo secuencial. Idempotencia por fingerprint. `skus_sku_sequences` legacy sin uso (no borrar).
2. **is_required** Cosmética: permanece todo `false`.
3. **Keys libres** `^[a-z][a-z0-9-]{0,49}$`; no editables con dependencias; sin límite de 6.
4. **`default_field_type_id` nullable**; no field_types espejo.
5. **Medidas opcionales** en complete; auditar NOT NULL antes de 2B.2.
6. **RPC únicas** `generate_sku_secure` + `complete_sku_normalization` + helper SQL interno no expuesto.
7. **codeFormatVersion: 1** — `seg-seg-…`, empty=`000`, sin padding 6.
8. **Words editor+**; **levels manager+**; soft-delete only.
9. **Unique reference_code** tras resolución humana abbr.
10. **categoryId obligatorio** en Action/RPC; Cosmética solo default UI.

### Correcciones A–F
- v1 keyed por **field_type UUID** (no levelId).
- v2 con designations + codeSegment + codeFormatVersion.
- `selection_fingerprint` unique parcial.
- Error `level_disabled`.
- Lecturas: `getGeneratorCatalogForCategory` (activos, viewer+) vs `getCategoryConfigurationForAdmin`.
- Storage fuera de TX Postgres.

### Orden
- **2B.1 autorizada** (migración fingerprint/nullable, Zod, lecturas, actions, tests).
- **2B.2** escribir SQL RPC pero **no aplicar** remoto hasta revisión.
