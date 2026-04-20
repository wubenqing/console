## Context

The console already exposes a LakeToken navigation entry, but `pages/ai-datalake/laketoken.vue` is still a placeholder. Operators currently manage vLLM KV cache behavior outside this page by editing raw `backend_parameters` and `env` values, not by using the GPUStack `extended_kv_cache` abstraction. This change needs a focused UI that works with the existing operational model, keeps monitoring out of scope, and avoids recreating the full GPUStack deployment form.

The aligned reference is `../gpustack/docs/models-deployments-page-analysis.md`. That analysis establishes that GPUStack's deployments page is a frontend over GPUStack management APIs under `/v2`, with `gpustack-ui` calling endpoints such as `GET /v2/models`, `GET /v2/models/{id}`, `PUT /v2/models/{id}`, `GET /v2/models/{id}/instances`, and `DELETE /v2/model-instances/{id}`. The intended LakeToken architecture should follow the same backend boundary: GPUStack remains the authoritative control plane for models and instances, while console provides a narrower, purpose-built UI for KV cache configuration.

The page sits in the console codebase, which already has page layout primitives, Nuxt data fetching helpers, and API client wrappers. The implementation will need to read existing model configuration from GPUStack, project the KV cache-related subset into a simple form, and write the updated configuration back while preserving unrelated model fields. The goal is to align with GPUStack's API and lifecycle semantics, not to transplant GPUStack backend orchestration into the console codebase.

The integration scheme is now confirmed by live verification: the chosen GPUStack API key successfully accessed both `GET /v2/users/me` and `GET /v2/models`, which means it is accepted as a management-capable credential for the target deployment. That removes the need to route LakeToken through GPUStack's username and password login flow.

## Goals / Non-Goals

**Goals:**

- Provide a usable LakeToken page for existing models under `/ai-datalake/laketoken`.
- Make GPUStack the explicit backend for LakeToken configuration and instance lifecycle actions.
- Route GPUStack access through console server endpoints so the management API key remains private.
- Allow deployments to restrict LakeToken mutations to an explicit model allowlist for production safety.
- Let operators edit the KV cache related runtime settings they already use: raw `backend_parameters` and `LMCACHE_*` environment variables.
- Offer separate UI controls for KV cache enablement and prefix caching enablement.
- Apply configuration changes through a controlled update flow that reflects the need to restart the running vLLM instance.
- Keep the implementation narrow, explicit, and aligned with current console page patterns.

**Non-Goals:**

- Building a full deployment management experience.
- Re-implementing or transplanting GPUStack backend controller logic into console.
- Reusing GPUStack username and password as console environment configuration.
- Managing GPUStack `extended_kv_cache` fields.
- Adding metrics panels, charts, or other monitoring views.
- Generalizing the page into a full advanced model editor.

## Decisions

### 1. LakeToken will use GPUStack as its backend control plane through a console server-side proxy

LakeToken will treat GPUStack as the system of record for model configuration and instance lifecycle. The console page will not call GPUStack directly from the browser. Instead, the console server will expose a focused proxy layer, backed by private runtime configuration such as `GPUSTACK_API_URL` and `GPUSTACK_API_KEY`, and forward requests to GPUStack management APIs. This keeps the management credential out of the browser and avoids coupling LakeToken to GPUStack's cookie-based login flow.

The minimum backend interaction surface for the initial page is still GPUStack `/v2` management APIs:

- `GET /v2/models` for selectable models
- `GET /v2/models/{id}` for the selected model's full configuration
- `PUT /v2/models/{id}` for saving KV cache-related configuration changes
- `GET /v2/models/{id}/instances` or `GET /v2/model-instances?model_id=...` for locating live instances when a restart step is needed
- `DELETE /v2/model-instances/{id}` for forcing instance recreation after configuration changes, letting GPUStack reconcile back to the model's desired replica count

Alternative considered: transplanting GPUStack backend logic or duplicating its controller behavior in console. Rejected because GPUStack already owns model and instance reconciliation, and duplicating that logic would create immediate divergence risk.

Alternative considered: having the browser call GPUStack directly with a management API key. Rejected because the key would be exposed client-side.

Alternative considered: storing GPUStack usernames and passwords in console and replaying `/auth/login`. Rejected because the live API key verification makes that unnecessary and because shared login credentials are a worse operational boundary.

### 2. LakeToken will align with GPUStack UI's API model, but not clone the Deployments page

The page will follow the request model documented in `models-deployments-page-analysis.md`: model-centric CRUD via `/v2/models`, instance inspection via `/v2/models/{id}/instances` or `/v2/model-instances`, and restart or stop semantics expressed through existing management APIs rather than custom service logic. However, LakeToken will not transplant the full `gpustack-ui` Deployments page, its generic deployment form, or its full REST-plus-watch page infrastructure.

For the initial configuration-only scope, console should implement the narrower interaction path it needs and selectively borrow request shapes and payload semantics from GPUStack UI where that reduces risk.

Alternative considered: copying `gpustack-ui` deployments page logic wholesale into console. Rejected because the deployment page solves a much larger problem space than LakeToken, including model search, deployment creation, instance views, and SSE-heavy list management.

### 3. LakeToken will use raw advanced settings as the source of truth

The page will read and write KV cache-related `backend_parameters` and `env` entries directly. This matches the current operator workflow and avoids double ownership between raw settings and `extended_kv_cache`.

Alternative considered: mapping the page to `extended_kv_cache` and letting GPUStack synthesize LMCache arguments. Rejected because it does not match current operational practice and creates ambiguity when raw parameters are already present.

### 4. The page will expose a curated subset of fields instead of a free-form advanced editor

The UI will own only the KV cache-related subset:

- KV cache toggle
- Prefix caching toggle
- KV transfer config value
- `LMCACHE_USE_EXPERIMENTAL`
- `LMCACHE_CHUNK_SIZE`
- `LMCACHE_LOCAL_CPU`
- `LMCACHE_MAX_LOCAL_CPU_SIZE`
- `LMCACHE_LOCAL_DISK`
- `LMCACHE_MAX_LOCAL_DISK_SIZE`

The page will parse these values from the selected model and merge them back during save, leaving unrelated parameters and environment variables intact.

Alternative considered: exposing the entire `backend_parameters` and `env` payload. Rejected because it would make the page a generic advanced editor rather than a focused LakeToken workflow.

### 5. Apply will be implemented as a GPUStack-managed update-plus-recreate workflow

Saving from the page will first persist the changed configuration through the console proxy to `PUT /v2/models/{id}`. If the running vLLM instance must be recreated for the new runtime arguments to take effect, the page will trigger restart through proxied GPUStack-managed instance operations rather than local process logic. The preferred flow is to keep the model as the desired-state object, then delete the relevant `model_instance` records so GPUStack's controller reconciles them back to the target replica count with the updated model spec.

Alternative considered: updating the model only and expecting operators to restart instances elsewhere. Rejected because it undermines the purpose of the page and leaves the most important operational step manual.

Alternative considered: implementing restart by transplanting local restart logic into console. Rejected because instance lifecycle already belongs to GPUStack and should remain there.

### 6. A dedicated mapping layer will isolate page state from remote model shape

The implementation should introduce a page-specific mapper that converts API model data into a form model and back. That mapper will be responsible for detecting presence or absence of KV cache-related settings, generating canonical argument forms, and stripping managed keys when toggles are disabled.

Alternative considered: performing inline parsing and mutation in the page component. Rejected because it would make the page harder to test and increase the risk of breaking unrelated configuration.

### 7. Production deployments can constrain LakeToken with a model allowlist

The console should support an optional environment-level allowlist such as `GPUSTACK_ALLOWED_MODEL_NAMES=qwen3-14b`. When configured, the LakeToken page should only show allowlisted models and the console server should reject update attempts for non-allowlisted models. This keeps the feature safe to deploy into shared or production GPUStack environments without hardcoding a single model name into the product.

Alternative considered: hardcoding `qwen3-14b` directly in the page. Rejected because the restriction is environment-specific, not a universal product rule.

## Risks / Trade-offs

- GPUStack management APIs require admin-scoped access under `/v2` → Route LakeToken through a console server proxy backed by a private management API key.
- Management API key leakage would grant broad backend access → Keep `GPUSTACK_API_KEY` in private runtime config only and never expose it through `public` config or browser requests.
- Production environments may host many unrelated models → Support an explicit LakeToken model allowlist so operators can constrain which models are mutable from this page.
- Console may drift from GPUStack UI if it copies behavior loosely → Keep the API contract aligned with `models-deployments-page-analysis.md` and isolate GPUStack-specific request mapping in one integration layer.
- Managed field overlap with external tools → Restrict page ownership to a documented subset of keys and preserve all unrelated config during merges.
- Restart semantics may differ from future backend behavior → Encapsulate restart logic behind one action in the page integration layer so the behavior can change without rewriting the form.
- Selected models may already contain inconsistent manual values → Normalize known fields when loading and show explicit validation errors for invalid numeric or boolean values.
- Operators may expect monitoring on the same page → Keep the page layout ready for later expansion, but state clearly that this change is configuration-only.

## Migration Plan

No data migration is required. The page will operate on existing GPUStack model records through existing management APIs. Rollback is low risk: revert the page and any supporting API integration, and operators can continue using the existing manual configuration path outside LakeToken. Operational rollout requires only configuring the console server with GPUStack's API URL and a management-capable API key.

## Open Questions

- None for the initial scoped implementation. The backend boundary is now explicit: LakeToken uses GPUStack as the backend, and console remains a focused client over that control plane.
