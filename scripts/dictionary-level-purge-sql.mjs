export function buildDictionaryLevelPurgeSql(levelKey) {
  return `
delete from public.skus_word_parent_edges e
using public.skus_words w,
      public.skus_category_levels cl,
      public.skus_categories c
where e.child_word_id = w.id
  and c.id = cl.category_id
  and c.slug = 'cosmetica'
  and cl.key = '${levelKey}'
  and (
    w.category_level_id = cl.id
    or (
      cl.legacy_field_type_id is not null
      and w.default_field_type_id = cl.legacy_field_type_id
    )
  );

delete from public.skus_words w
using public.skus_category_levels cl,
      public.skus_categories c
where c.id = cl.category_id
  and c.slug = 'cosmetica'
  and cl.key = '${levelKey}'
  and (
    w.category_level_id = cl.id
    or (
      cl.legacy_field_type_id is not null
      and w.default_field_type_id = cl.legacy_field_type_id
    )
  );
`;
}
