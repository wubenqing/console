## Why

The filesystem directory management page is currently only a placeholder, but the product needs a usable control plane for creating shared NFS directories and managing per-host mounts from the web console. This change is needed now to turn directory sharing into a managed workflow with persistent mount records instead of manual server-side operations and browser-local state.

## What Changes

- Add directory management capabilities for NFS-backed shared directories under a configured shared path on the NFS server, while exposing them to hosts through a configured NFS export host.
- Add API-driven directory creation and deletion through a server-side control flow rather than browser-local or manual shell operations.
- Add mount and unmount operations for a directory's per-host mount records through the directory edit experience.
- Record directory metadata and mount records in JSON on the NFS server for the initial version instead of browser cache or an external database.
- Define the UI around directories as the primary object, with each directory containing its own mount record list.
- Restrict the feature scope to NFS only and use unique directory names instead of separate directory IDs.

## Capabilities

### New Capabilities

- `filesystem-directory-management`: Manage NFS shared directories from the console, including creating directories, listing directories, viewing directory summaries, and deleting directories only when no active mount records remain.
- `directory-mount-record-management`: Manage per-directory mount records, including adding mount targets, invoking mount and unmount operations for a host path, and surfacing mount status within the directory edit flow.
- `directory-registry-storage`: Persist directory definitions and mount records as server-side JSON under the configured shared path so the console can recover and display state across sessions.

### Modified Capabilities

- None.

## Impact

- Affects the filesystem directory management page at `pages/filesystem/dirs.vue` and related UI components for listing, editing, mounting, and unmounting.
- Requires new Nuxt server API routes for directory operations and mount orchestration.
- Requires integration with an NFS-side control service and a host-side mount execution service exposed by API.
- Introduces server-side registry persistence under the NFS shared path, initially as JSON rather than SQLite.
- Assumes the NFS-side control service and host-side mount execution service can run as Python/FastAPI daemons managed by systemd in trusted environments.
