## 1. LakeToken page foundation

- [x] 1.1 Add private console runtime configuration for `GPUSTACK_API_URL` and `GPUSTACK_API_KEY` and keep the management key out of `public` runtime config.
- [x] 1.2 Add a console server-side proxy or integration endpoint for the GPUStack `/v2` management APIs used by LakeToken.
- [x] 1.3 Replace the placeholder in `pages/ai-datalake/laketoken.vue` with a real page layout using the existing console page primitives.
- [x] 1.4 Add page state for loading, selected model, form values, apply progress, and success or error feedback.
- [x] 1.5 Wire the page to load the list of configurable existing models and fetch the selected model details through the console GPUStack integration layer.

## 2. KV cache configuration mapping

- [x] 2.1 Implement a page-specific mapper that reads KV cache-related values from model `backend_parameters` and `env` into a focused form model.
- [x] 2.2 Implement merge logic that writes the managed KV cache subset back into `backend_parameters` and `env` while preserving unrelated values.
- [x] 2.3 Normalize managed values such as quoted LMCache paths when loading and saving the form.
- [x] 2.4 Implement toggle behavior so disabling KV cache removes the LakeToken-managed KV cache arguments and environment variables from the outgoing payload.

## 3. Apply and restart workflow

- [x] 3.1 Add form controls for KV cache enablement, prefix caching enablement, KV transfer config, and the managed `LMCACHE_*` fields.
- [x] 3.2 Validate operator input for required values and numeric fields before apply.
- [x] 3.3 Implement the apply action through the console GPUStack proxy so it updates the selected model configuration and triggers the required restart flow for the running vLLM instance.
- [x] 3.4 Surface apply status and failure states clearly in the page so operators know whether the configuration has taken effect.

## 4. Verification

- [x] 4.1 Add tests for the GPUStack integration layer that cover authenticated proxy requests and private configuration handling.
- [x] 4.2 Add tests for the mapper logic that cover loading existing values, preserving unrelated settings, normalizing managed values, and removing managed settings when KV cache is disabled.
- [x] 4.3 Add page-level tests for the main configuration workflow and apply error handling.
- [x] 4.4 Run the project checks required for the change and confirm the LakeToken page remains configuration-only with no monitoring dependency.
