## Why

Selected pages in the AI Data Lake and filesystem areas do not yet provide complete Chinese localization for user-facing copy. This change is needed to make those workflows usable for Chinese-speaking operators while preserving professional domain terminology such as Catalog, Volume Catalog, Schema, Fileset, and Metalake in English where that wording is more precise.

## What Changes

- Add and complete Chinese localization support for the catalog page, volume catalog page, and directory management page.
- Replace remaining hardcoded or non-localized user-facing copy on those pages with i18n lookups where needed.
- Add or normalize locale entries required by those pages, with Chinese translations for general UI text and English retention for professional data lake terminology.
- Ensure page titles, action buttons, filters, form labels, table headers, empty states, confirmation dialogs, and success or error feedback follow a consistent localization strategy.

## Capabilities

### New Capabilities

- `selected-pages-localization`: Provide complete zh-CN localization coverage for selected pages while keeping domain-specific technical terms in English according to the agreed terminology strategy.

### Modified Capabilities

- None.

## Impact

- Affected pages include `pages/ai-datalake/catalog.vue`, `pages/ai-datalake/volume-catalog.vue`, and `pages/filesystem/dirs.vue`.
- Affected locale files include `i18n/locales/zh-CN.json` and any source locale files that must be updated to keep translation keys aligned.
- Shared i18n usage patterns may need minor updates where selected pages currently mix translated strings with hardcoded UI copy.
