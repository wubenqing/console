## 1. Audit Selected Pages

- [x] 1.1 Inventory all user-facing strings in `pages/ai-datalake/catalog.vue` by UI area, including headers, actions, tabs, tables, breadcrumbs, dialogs, detail panels, loading states, empty states, and notifications.
- [x] 1.2 Inventory all user-facing strings in `pages/ai-datalake/volume-catalog.vue` and `pages/filesystem/dirs.vue`, including filter controls, table copy, dialog text, empty states, and feedback messages.
- [x] 1.3 Reconcile the audited strings against existing locale keys so implementation can reuse matching keys and identify only the new keys that must be added.

## 2. Localize Target Pages

- [x] 2.1 Add or complete `useI18n()` integration on the selected pages and replace hardcoded strings in `pages/ai-datalake/catalog.vue` with `t()` lookups.
- [x] 2.2 Replace hardcoded strings in `pages/ai-datalake/volume-catalog.vue` with `t()` lookups, including query panel controls, condition builder copy, table labels, loading states, and notifications.
- [x] 2.3 Normalize `pages/filesystem/dirs.vue` so any remaining page-level copy uses the same locale-driven wording and terminology policy as the other selected pages.

## 3. Align Locale Dictionaries

- [x] 3.1 Add missing source-string keys required by the selected pages to the source locale file set while preserving the existing English-string-key convention.
- [x] 3.2 Add or update `i18n/locales/zh-CN.json` entries for the selected pages so general UI copy is professional Chinese and approved data-lake terms remain in English.
- [x] 3.3 Review new and reused locale entries for consistency in wording, punctuation, placeholders, and fallback labels such as `N/A`, `Loading…`, and `Root`.

## 4. Verify Localized Behavior

- [x] 4.1 Verify the selected pages render correctly in `en-US` and `zh-CN` without missing-key output, broken interpolation, or mixed-language hotspots.
- [x] 4.2 Check that dialogs, notifications, empty states, detail panels, and dynamic labels on the selected pages follow the approved terminology policy.
- [x] 4.3 Run the relevant project validation steps for the localization changes and update or add tests if the implementation introduces affected coverage points.
