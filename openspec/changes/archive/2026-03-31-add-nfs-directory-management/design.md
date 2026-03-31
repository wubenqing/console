## Context

The current filesystem directory management page is a placeholder, while the intended workflow requires the console to create shared directories on an NFS server and manage per-host mount actions through API calls. The change spans the web UI, Nuxt server API layer, an NFS-side control service, and a host-side mount execution service, so the main design challenge is defining clean boundaries between directory lifecycle, mount orchestration, and persisted registry state.

The first release supports only NFS, but the code structure should not hardcode NFS assumptions into every layer. Protocol support is a product-level constraint for v1, not a reason to couple UI models, API contracts, and registry structures to a single backend implementation forever.

The user workflow is directory-centric:

- A directory name is the unique identifier.
- A directory owns its mount records.
- A mount record contains the target host address, mount path, status, timestamps, and last error details.
- Deletion is allowed only when the directory has no active mount records.

State must not be stored in browser cache. For the initial version, the registry will be persisted as JSON under `{shared-path}/.aiunistor/registry.json`, while actual shared directories live directly under `{shared-path}/<directory-name>`. The `shared-path` value is the NFS server's local filesystem root for exported content. Hosts do not mount that local path directly. Instead, the system builds a host-visible mount source from the configured `nfs-export-host` value as `{nfs-export-host}:/<directory-name>`. Both values are server-side configuration used internally for path construction and should not appear as operator-visible fields in the Web UI.

## Goals / Non-Goals

**Goals:**

- Provide a usable directory management control plane in the console.
- Model directories as the primary object and mount records as child records.
- Support create, list, edit, mount, unmount, and guarded delete flows for NFS-backed directories.
- Keep mount state persistent across browser sessions through server-side registry storage.
- Keep the implementation organized so additional filesystem protocols can be introduced later without rewriting the whole feature.
- Make the Web UI interaction model explicit and consistent with the directory-centric data model.

**Non-Goals:**

- Supporting protocols other than NFS in the first release.
- Building a generic infrastructure inventory or standalone host management system.
- Replacing JSON with SQLite or another database in the first release.
- Implementing push-based host heartbeats or continuous host status reporting.
- Automating host agent installation, bootstrap, or remote credential provisioning.

## Decisions

### 1. Use a directory-centric domain model

The core aggregate is a directory. Each directory contains a list of mount records, and all user-facing actions are expressed relative to the directory.

Rationale:

- This matches the product mental model the user wants: “目录是核心”.
- It keeps delete rules simple because the directory can validate whether any active mount records remain.
- It maps cleanly to the intended UI, where the list page shows directories and the edit view manages mounts.

Alternatives considered:

- Host-centric model: rejected because it makes directory lifecycle and deletion checks harder to understand in the UI.
- Flat mount table as the primary UI object: rejected because users care first about shared directories, not an ungrouped list of mount actions.

### 2. Keep host information inside mount records for v1

The first release will not introduce a standalone host resource. Each mount record will directly store the host address and mount path.

Rationale:

- The current use case only needs host address input during mount operations.
- This avoids introducing an early host inventory model, host CRUD pages, or cross-directory host relationships before they are needed.
- It reduces scope while still allowing multiple hosts per directory.

Alternatives considered:

- Dedicated host registry with reusable host objects: rejected for v1 because it adds extra UX and data management complexity without immediate value.

### 3. Split control responsibilities across console server, NFS service, and host service

The console remains the control plane. The NFS-side service is responsible for directory lifecycle and registry file access. The host-side service is responsible for executing mount and unmount actions on a given host.

Proposed responsibility split:

- Console server:
  - Exposes web-facing APIs for the page.
  - Orchestrates calls to the NFS-side and host-side services.
  - Shapes data into directory-centric responses for the UI.
- NFS-side service (`aiunistor-nfs-agent`):
  - Creates directories.
  - Deletes directories.
  - Reads and writes `registry.json`.
  - Returns directory and mount record state from registry.
- Host-side service (`aiunistor-mount-agent`):
  - Mounts NFS directories to a local path.
  - Unmounts directories from a local path.
  - Runs on the target host that will own the mountpoint.

Implementation assumptions for v1:

- Both services can be implemented in Python with FastAPI.
- Both services are expected to run under systemd in trusted environments.
- The services may run as `root` because directory creation, ownership control, `mount`, and `umount` typically require elevated privileges.
- Shell commands must be invoked through parameterized subprocess calls rather than shell string interpolation.
- Default ports can start at `18081` for `aiunistor-nfs-agent` and `18082` for `aiunistor-mount-agent`, with final values kept configurable.

Rationale:

- This keeps file mutation close to the NFS server.
- It avoids browser-side shell operations and avoids SSH-based control.
- It gives a clear seam for later introducing additional protocol drivers.

Alternatives considered:

- Console directly mutating NFS filesystems or remote hosts: rejected because it increases coupling and operational risk.
- Host state push model from day one: rejected because it adds complexity beyond the MVP workflow.

### 4. Organize backend code around protocol drivers even though v1 only supports NFS

The web-facing APIs and server orchestration should be expressed in protocol-neutral terms such as “create directory”, “delete directory”, and “mount record action”, while the actual implementation is provided by an NFS driver.

A practical shape is:

- `DirectoryRegistryStore`
- `DirectoryService`
- `MountService`
- `FilesystemProtocolDriver`
  - `createDirectory(...)`
  - `deleteDirectory(...)`
  - `buildLocalDirectoryPath(...)`
  - `buildMountSource(...)`
  - `mount(...)`
  - `unmount(...)`
- `NfsProtocolDriver` as the only implementation in v1

Rationale:

- This localizes NFS-specific assumptions.
- Future SMB or other protocols can plug into a known interface.
- The UI and registry schema stay mostly stable even if protocol support expands later.

Alternatives considered:

- Hardcode NFS semantics throughout page components and server routes: rejected because it makes later protocol support an invasive refactor.

### 5. Persist registry state as JSON on the NFS shared path for v1

The registry file will be stored at `{shared-path}/.aiunistor/registry.json`. It stores the directory list and each directory's mount records, while the managed directories themselves are created directly beneath `{shared-path}` so that a host can mount them as `{nfs-export-host}:/<directory-name>` when the export root is configured with `fsid=0`.

Suggested shape:

```json
{
  "version": 1,
  "directories": [
    {
      "name": "test-dir1",
      "localPath": "/shared-path/test-dir1",
      "mountSource": "172.24.37.159:/test-dir1",
      "createdAt": "2026-03-30T10:00:00Z",
      "mounts": [
        {
          "host": "10.0.0.12",
          "mountPath": "/data/test-dir1",
          "status": "mounted",
          "mountedAt": "2026-03-30T10:05:00Z",
          "lastError": ""
        }
      ]
    }
  ]
}
```

Rationale:

- This matches the user's decision to start with JSON instead of SQLite.
- It keeps deployment simple for the first release.
- A version field preserves a migration path if the registry later moves to SQLite.

Alternatives considered:

- SQLite on day one: rejected for now because the user explicitly chose JSON first.
- Browser storage: rejected because state must persist outside the browser and be shared across sessions.

### 6. Use registry state as the MVP source of truth

The system will treat the registry as the displayed state for the MVP release. Successful mount and unmount calls update the registry directly, and the UI reflects those results without introducing explicit validation actions or intermediate "pending validation" states.

Rationale:

- Avoids the complexity of continuous heartbeats or extra validation flows in the first release.
- Keeps the edit flow focused on the core operator actions: mount and unmount.
- Matches the requested MVP scope.

Alternatives considered:

- Continuous host state reporting: rejected as unnecessary complexity for the initial scope.
- Explicit validate actions in the UI: rejected because the MVP should not expose extra operator steps beyond mount and unmount.

### 7. Compose host mount sources from export-host plus directory name

The host-side mount operation must use the configured NFS export host and the managed directory name to build the mount source. The host-side agent must not receive or infer the NFS server's local `shared-path` value.

Examples:

- Local directory path on the NFS server: `{shared-path}/test-dir3`
- Host-visible mount source: `{nfs-export-host}:/test-dir3`

Rationale:

- The NFS server exports the shared root with `fsid=0`, so hosts mount an export-relative path such as `/test-dir3` rather than a server-local filesystem path.
- It prevents leakage of local filesystem layout into host agents and UI payloads.
- It keeps the path model correct if the NFS server storage root changes but the export host remains stable.

### 8. Make the Web UI explicitly reflect the directory-centered model

The page design should answer two different questions:

- List page: “Which shared directories exist and what is their summary state?”
- Edit flow: “For this directory, where is it mounted and what actions are available?”

Proposed UI structure:

1. Directory list page

- Search/filter by directory name and status summary.
- Primary actions: Create, Refresh.
- Table columns:
  - Directory Name
  - Mounted Host Count
  - Created Time
  - Status Summary
  - Actions

2. Create directory dialog

- Directory name only.
- No directory ID field.
- Name uniqueness is validated server-side.

3. Edit directory dialog

- Basic directory information.
- Mounted records table for that directory.
- Per-record actions:
  - Unmount
- New mount form:
  - Host address
  - Mount path
  - Mount action

4. Delete action on list page

- Available only through explicit confirmation.
- Backend rejects deletion if any active mount records remain.

Rationale:

- This makes the UI logic visible and aligned to the data model.
- It keeps infrastructure configuration such as `shared-path` out of the operator-facing screen.
- It removes misleading single-directory-status simplifications from the table.
- It matches existing repository patterns that use a list page plus edit dialog flow.

Alternatives considered:

- Put mount/unmount actions directly into the main table row: rejected because one directory can have multiple mount records, so row-level actions become ambiguous.
- Keep a mount type column: rejected because v1 only supports NFS and the column would not carry real information.

## Risks / Trade-offs

- [JSON registry concurrency can become fragile] → Restrict writes to the NFS-side service, perform atomic rewrite semantics where possible, and keep a registry version field for safe future migration.
- [Registry state can drift from real host mount state] → Accept this limitation for MVP and rely on mount and unmount API results as the recorded state until a later release introduces reconciliation.
- [Protocol-neutral abstractions may feel heavier than the immediate NFS need] → Keep the interface surface minimal and only abstract the operations already needed by v1.
- [Directory name as identifier makes renaming harder later] → Treat directory rename as out of scope for v1 and preserve the option to introduce an internal ID later if needed.
- [No standalone host resource may limit reuse across directories] → Accept this for v1 and revisit if host reuse, labels, or policy management becomes a real requirement.
- [Root-run services increase operational blast radius] → Keep the API surface narrow, restrict network reachability, and prefer dedicated systemd services over ad hoc shell access.

## Migration Plan

1. Add configuration for the NFS-side control service URL, host-side service addressing, shared path, and NFS export host.
2. Implement server-side APIs in the console for directory list, create, delete, mount, and unmount actions.
3. Implement or integrate `aiunistor-nfs-agent` with registry read/write and directory lifecycle APIs.
4. Implement or integrate `aiunistor-mount-agent` with mount and unmount APIs.
5. Replace the placeholder filesystem directory page with the new directory-centered table and edit flow.
6. Roll out initially with an empty `registry.json`; the page should treat missing registry state as an empty directory list.
7. If rollback is required, revert the UI and API changes and leave the registry file untouched for manual inspection or later reuse.

## Open Questions

- How should the console authenticate requests to the NFS-side and host-side services in the first release: shared token, mTLS, or a simpler trusted-network assumption?
