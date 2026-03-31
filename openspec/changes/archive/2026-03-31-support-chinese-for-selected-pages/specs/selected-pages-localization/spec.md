## ADDED Requirements

### Requirement: Selected pages provide complete localized UI copy

The system SHALL provide localized user-facing copy for the catalog page, volume catalog page, and directory management page in supported locales. This MUST include page titles, action buttons, filter and form labels, table headers, empty states, dialog content, helper text, and success or error feedback that is presented by those pages.

#### Scenario: Chinese user opens a selected page

- **WHEN** the active locale is `zh-CN` and the user opens any selected page
- **THEN** the page renders Chinese UI copy for general interface text instead of leaving that copy hardcoded in English

#### Scenario: English user opens a selected page

- **WHEN** the active locale is `en-US` and the user opens any selected page
- **THEN** the page renders the same interface text in English using locale entries aligned with the Chinese translation keys

### Requirement: Approved data-lake terminology remains in English

The system SHALL preserve approved professional data-lake terminology in English across localized selected pages. Terms such as Catalog, Volume Catalog, Schema, Fileset, Model, and Metalake MUST remain in English in zh-CN where those terms represent domain concepts rather than generic UI wording.

#### Scenario: Chinese user views a page title or field containing domain terminology

- **WHEN** a selected page renders a label, title, breadcrumb, or detail field containing an approved data-lake term in `zh-CN`
- **THEN** the surrounding copy is translated into Chinese and the approved domain term remains in English

#### Scenario: Translator encounters an uncertain domain term

- **WHEN** a new selected-page string contains a professional data-lake term covered by the approved terminology policy
- **THEN** the resulting locale entry keeps that domain term in English instead of replacing it with a Chinese synonym

### Requirement: Selected-page locale entries stay aligned across locale files

The system SHALL define locale entries for selected-page strings using the existing English-source-string key convention. Any new or normalized string required by a selected page MUST be added consistently to the source locale set and `zh-CN` so the page can render without missing-key artifacts.

#### Scenario: Newly localized string is introduced on a selected page

- **WHEN** implementation replaces a hardcoded selected-page string with an i18n lookup
- **THEN** the corresponding key exists in the English source locale file and in `zh-CN`

#### Scenario: Selected page renders after localization changes

- **WHEN** a selected page is rendered in a supported locale after the localization update
- **THEN** the user does not see raw missing-key output for strings introduced by this change

### Requirement: Dynamic and state-dependent selected-page text is localized

The system SHALL localize dynamic and state-dependent text on selected pages, including loading states, empty states, fallback labels, dialog prompts, notification messages, and interpolated strings. Interpolation placeholders and runtime values MUST remain intact after localization.

#### Scenario: Dynamic feedback is shown in Chinese

- **WHEN** a selected page in `zh-CN` displays a notification, confirmation dialog, loading state, or empty state introduced by this change
- **THEN** that feedback is shown in Chinese except for approved domain terminology that remains in English

#### Scenario: Interpolated text renders runtime values correctly

- **WHEN** a localized selected-page string includes placeholders or runtime values
- **THEN** the rendered message preserves the correct runtime values and does not break because of the localization lookup
