## ADDED Requirements

### Requirement: LakeToken integration MUST use a server-side GPUStack management proxy

The system SHALL integrate with GPUStack through console-managed server endpoints that call GPUStack `/v2` management APIs with a private management credential. The frontend MUST NOT require a GPUStack username and password, and MUST NOT receive the raw GPUStack management API key.

#### Scenario: Server configuration is used for GPUStack access

- **WHEN** the LakeToken feature communicates with GPUStack management APIs
- **THEN** the request is sent through console server integration configured with a GPUStack API base URL and a private management API key

#### Scenario: Browser does not receive the management credential

- **WHEN** an operator uses the LakeToken page in the browser
- **THEN** the browser can invoke console endpoints for LakeToken operations without receiving the raw GPUStack management API key

### Requirement: LakeToken page MUST list configurable existing models

The system SHALL provide a LakeToken page that lets an operator select from existing models that are eligible for LakeToken KV cache configuration, and SHALL load the selected model's current KV cache-related settings from GPUStack management APIs.

#### Scenario: Operator opens LakeToken page

- **WHEN** the operator navigates to `/ai-datalake/laketoken`
- **THEN** the system displays a configuration page instead of a placeholder view

#### Scenario: Operator selects an existing model

- **WHEN** the operator chooses a configurable existing model on the LakeToken page
- **THEN** the system loads that model's current KV cache-related `backend_parameters` and `env` values from GPUStack into the page form

#### Scenario: Deployment restricts mutable models with an allowlist

- **WHEN** the console deployment configures an explicit LakeToken model allowlist
- **THEN** the LakeToken page only presents allowlisted models as configurable choices

#### Scenario: Non-allowlisted model update is rejected

- **WHEN** a client attempts to apply LakeToken changes for a model outside the configured allowlist
- **THEN** the console server rejects the mutation instead of forwarding the update to GPUStack

### Requirement: LakeToken page MUST expose focused KV cache controls

The system SHALL expose separate controls for KV cache enablement and prefix caching enablement, and SHALL expose the managed LMCache-related fields needed for the current operator workflow.

#### Scenario: KV cache controls are shown

- **WHEN** a model is loaded into the LakeToken page
- **THEN** the page shows controls for KV cache enablement, prefix caching enablement, KV transfer configuration, and the managed `LMCACHE_*` fields

#### Scenario: Disabled KV cache removes managed runtime settings

- **WHEN** the operator disables KV cache and applies the change
- **THEN** the system removes the KV cache-managed arguments and environment variables from the outgoing configuration payload

### Requirement: LakeToken page MUST preserve unrelated model configuration

The system SHALL update only the KV cache-managed subset of `backend_parameters` and `env`, and MUST preserve unrelated model settings when applying changes.

#### Scenario: Unrelated backend parameters exist

- **WHEN** the selected model contains backend parameters outside the LakeToken-managed subset
- **THEN** those unrelated backend parameters remain unchanged after the operator applies LakeToken configuration changes

#### Scenario: Unrelated environment variables exist

- **WHEN** the selected model contains environment variables outside the LakeToken-managed subset
- **THEN** those unrelated environment variables remain unchanged after the operator applies LakeToken configuration changes

### Requirement: LakeToken page MUST apply configuration through a restart-aware workflow

The system SHALL treat save as an apply operation that updates the selected model configuration through GPUStack management APIs and triggers the restart flow required for the running vLLM instance to pick up the new settings.

#### Scenario: Apply succeeds

- **WHEN** the operator submits valid LakeToken configuration changes
- **THEN** the system updates the selected model configuration in GPUStack, triggers the required restart behavior, and reports success to the operator

#### Scenario: Apply fails

- **WHEN** the configuration update or restart step fails
- **THEN** the system reports the failure and does not display the configuration as successfully applied

### Requirement: Monitoring MUST remain out of scope for the initial page

The system SHALL not require metrics panels or monitoring charts for the initial LakeToken implementation.

#### Scenario: Operator opens initial implementation

- **WHEN** the operator uses the first implementation of the LakeToken page
- **THEN** the page focuses on configuration controls without requiring monitoring widgets to complete the workflow
