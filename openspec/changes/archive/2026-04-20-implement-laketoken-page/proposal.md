## Why

LakeToken page is already exposed in the console navigation, but the route is still a placeholder and cannot manage the vLLM KV cache settings that are currently configured manually elsewhere. A focused configuration page is needed now so operators can enable or disable KV cache related settings for existing models from the console without rebuilding the full GPUStack deployment workflow.

## What Changes

- Add a functional LakeToken page for existing vLLM models under `/ai-datalake/laketoken`.
- Integrate LakeToken with GPUStack through a console server-side proxy that calls GPUStack `/v2` management APIs.
- Configure the GPUStack backend connection in console with a base URL and private management API key, instead of storing GPUStack usernames and passwords in console.
- Support an optional environment-level model allowlist so production deployments can restrict LakeToken mutations to explicitly approved models such as `qwen3-14b`.
- Support selecting an existing model and editing the KV cache related `backend_parameters` and `env` values used by LMCache integration.
- Provide separate toggles for KV cache enablement and prefix caching enablement.
- Provide an apply action that writes the updated model configuration and performs the required restart flow for the serving instance.
- Keep the monitoring area out of scope for this change; the page will focus on configuration only.
- Avoid using GPUStack `extended_kv_cache` as the source of truth for this page; the page will manage the raw advanced parameters and environment variables that operators already use.

## Capabilities

### New Capabilities

- `laketoken-kv-config`: Manage KV cache and LMCache-related runtime configuration for existing LakeToken-backed vLLM models from the console UI.

### Modified Capabilities

- None.

## Impact

- Affected UI: `pages/ai-datalake/laketoken.vue` and supporting components or composables used by the page.
- Affected integration surface: console server-side API access for reading and updating GPUStack model configuration, plus the restart/apply workflow.
- Affected configuration: console runtime configuration will need GPUStack API base URL and a private management API key.
- Affected behavior: operators will configure raw `backend_parameters` and `env` entries such as `--kv-transfer-config`, `--enable-prefix-caching`, and `LMCACHE_*` variables from the console.
- Out of scope: metrics panels, cache hit monitoring, and other observability views.
