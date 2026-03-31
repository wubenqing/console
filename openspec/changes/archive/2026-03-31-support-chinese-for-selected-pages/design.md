## Context

This change spans multiple Nuxt pages with different localization maturity levels. `pages/filesystem/dirs.vue` already uses `useI18n()` and `t()` for most visible copy, while `pages/ai-datalake/volume-catalog.vue` still renders many hardcoded English labels and `pages/ai-datalake/catalog.vue` contains extensive hardcoded UI text without an established i18n integration pattern. Existing locale files use English source strings as translation keys, and the approved terminology policy is to keep professional data-lake terms such as Catalog, Volume Catalog, Schema, Fileset, and Metalake in English even in zh-CN.

The design therefore needs to solve two related problems: how to localize three pages consistently without introducing a second translation-key scheme, and how to preserve domain terminology while still providing professional Chinese copy for the surrounding UI.

## Goals / Non-Goals

**Goals:**

- Bring the selected pages onto one consistent i18n approach based on `useI18n()` and existing locale dictionaries.
- Localize all user-facing chrome on the target pages, including titles, actions, filters, field labels, table headers, empty states, helper copy, dialog text, and success or error feedback.
- Preserve approved domain terminology in English within zh-CN translations when that wording is more precise than a Chinese substitute.
- Keep translation keys aligned across locale files so the selected pages can be maintained with the same workflow as the rest of the app.

**Non-Goals:**

- Redesign page layout, interaction flow, or component structure beyond the minimal changes needed to replace hardcoded copy.
- Standardize or rewrite untranslated copy outside the three pages in scope.
- Introduce a new i18n library, a namespaced message-key convention, or automatic translation tooling as part of this change.
- Translate raw backend values, resource names, or API payload fields that should remain system data rather than UI copy.

## Decisions

### 1. Reuse the existing string-key locale strategy

The selected pages will use the current project convention where the English source text is the translation key, with matching entries in `en-US.json` and `zh-CN.json`.

Why this approach:

- It matches the existing locale files and avoids mixing two i18n styles in one codebase.
- It minimizes plumbing changes on large pages such as `catalog.vue`, where introducing namespaced identifiers would create more churn with little benefit for this scoped change.
- It allows targeted additions for newly localized strings without changing runtime lookup behavior.

Alternatives considered:

- Introduce namespaced semantic keys such as `catalog.actions.refresh`: rejected because it would create a second key strategy and expand scope far beyond these selected pages.
- Localize only zh-CN and rely on fallback for English: rejected because locale files should stay aligned and new keys need an explicit source-of-truth entry.

### 2. Localize page copy at the page boundary, not by wrapping shared components

Each target page will convert its own hardcoded strings to `t()` calls, while existing shared components remain unchanged unless a component currently hardcodes copy that is only reachable from the target pages.

Why this approach:

- The request is page-scoped, and page-level replacement is the smallest change that fully satisfies it.
- It avoids unintentionally affecting unrelated pages that may use the same components differently.
- It keeps the audit straightforward: each target page can be reviewed for visible strings top-to-bottom.

Alternatives considered:

- Push translation behavior down into generic components or shared helpers first: rejected because that broadens the blast radius and is unnecessary unless repeated hardcoded strings are proven to live inside shared UI primitives.

### 3. Keep domain terminology in English inside Chinese copy

The zh-CN translations for selected pages will intentionally retain professional data-lake terms such as Catalog, Volume Catalog, Schema, Fileset, Model, and Metalake where they represent product or domain concepts. Surrounding action text, helper text, and status text will still be translated into Chinese.

Why this approach:

- It matches the user-approved terminology policy.
- It avoids ambiguous or awkward Chinese renderings for specialized concepts.
- It keeps related pages internally consistent with existing entries like `"Catalog": "Catalog"`.

Alternatives considered:

- Fully translate all domain nouns: rejected because it reduces precision and conflicts with the requested terminology style.
- Leave all selected-page copy in English: rejected because the goal is Chinese usability, not English-only retention.

### 4. Audit strings by UI category to avoid partial localization

Implementation should review each page by category: page header, action area, filters and form controls, table structure, empty/loading states, dialogs, notifications, breadcrumbs, and detail panels. `catalog.vue` in particular needs this category-based audit because of its size and mixed view states.

Why this approach:

- It is easy to miss copy in complex conditional templates if changes are made ad hoc.
- It creates a clear checklist for implementation and review without requiring a structural refactor.

Alternatives considered:

- Translate only strings discovered opportunistically during editing: rejected because it increases the risk of shipping a page with mixed Chinese and English UI copy.

### 5. Treat dynamic strings and fallback values as first-class localization cases

Messages with interpolation, plural-like counters, fallback values such as `N/A`, and conditional labels such as `Root`, `Loading…`, or `No details loaded` must be converted using i18n-safe patterns that preserve variables and runtime values.

Why this approach:

- These strings are user-facing and frequently overlooked during localization passes.
- Interpolated copy is a common source of regressions if variables or punctuation are embedded directly into translated text.

Alternatives considered:

- Leave dynamic and fallback strings hardcoded in English to save time: rejected because it would produce visibly incomplete localization on the highest-traffic interactions.

## Risks / Trade-offs

- [Large page audit in `catalog.vue`] -> Mitigation: review by UI category and state, not only by static grep hits, because many strings appear in conditional branches and detail tabs.
- [Inconsistent terminology across old and new locale entries] -> Mitigation: preserve approved English domain terms and add new entries using the same wording everywhere instead of translating per screen.
- [String-key duplication and near-duplicate entries] -> Mitigation: prefer existing keys when equivalent wording already exists; only add new keys when the wording or punctuation materially differs.
- [Partial localization of dynamic feedback or empty states] -> Mitigation: explicitly include notifications, breadcrumbs, fallbacks, and loading states in the implementation checklist.
- [Scope creep into adjacent AI Data Lake pages] -> Mitigation: restrict code changes to the three agreed pages and only touch shared locale dictionaries or helpers required to support them.

## Migration Plan

No deployment migration or data migration is required.

Implementation sequence:

1. Audit the three selected pages and enumerate visible user-facing strings by category.
2. Add `useI18n()` to pages that do not already use it and replace hardcoded copy with `t()` lookups.
3. Add any missing locale entries to the source locale set and `zh-CN.json`, preserving English domain terminology in translated phrases.
4. Verify the pages in both English and Chinese to confirm there are no missing keys, broken interpolations, or mixed-language hotspots.

Rollback strategy:

- Revert the page-level string substitutions and the locale entry additions together. Since there is no data migration, rollback is code-only.

## Open Questions

- None at design time. The terminology policy is already confirmed: professional data-lake terms remain in English, and uncertain translations can be validated during implementation if any edge-case wording appears.
