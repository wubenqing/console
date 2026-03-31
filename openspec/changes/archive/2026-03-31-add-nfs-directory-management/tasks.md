## 1. Configuration and server API scaffolding

- [x] 1.1 Add runtime configuration for the NFS-side control service URL, host-side service addressing, `{shared-path}`, and `{nfs-export-host}` path construction inputs.
- [x] 1.2 Add Nuxt server API route scaffolding for directory list, create, delete, mount, and unmount actions.
- [x] 1.3 Define shared request and response types for directory summaries, mount records, and directory edit payloads.

## 2. Directory registry and protocol services

- [x] 2.1 Implement a JSON-backed registry store that reads and writes `{shared-path}/.aiunistor/registry.json` with atomic update behavior.
- [x] 2.2 Implement directory service logic for listing directories, enforcing unique names, and creating physical directories at `{shared-path}/<directory-name>`.
- [x] 2.3 Implement guarded delete logic that rejects directory deletion when active mount records exist.
- [x] 2.4 Implement an NFS protocol driver and orchestration layer that keeps NFS-specific path and operation logic behind protocol-oriented service interfaces, including mount-source composition as `{nfs-export-host}:/<directory-name>`.
- [x] 2.5 Define or implement `aiunistor-nfs-agent` as a Python/FastAPI service suitable for systemd-managed deployment on the NFS server.
- [x] 2.6 Provide an example systemd unit and environment-file contract for `aiunistor-nfs-agent` deployment.

## 3. Mount record orchestration

- [x] 3.1 Define or implement `aiunistor-mount-agent` as a Python/FastAPI service suitable for systemd-managed deployment on target hosts.
- [x] 3.2 Implement host-side mount and unmount integration in the console server orchestration flow.
- [x] 3.3 Implement mount record creation and removal so successful mount and unmount operations update the registry state.
- [x] 3.4 Implement failure handling so unsuccessful mount or unmount operations return clear errors without corrupting registry state.
- [x] 3.5 Provide an example systemd unit and environment-file contract for `aiunistor-mount-agent` deployment.

## 4. Web UI directory management flow

- [x] 4.1 Replace the placeholder `pages/filesystem/dirs.vue` page with a directory summary table showing directory name, mounted host count, created time, status summary, and actions.
- [x] 4.2 Implement the create directory dialog with directory-name-only input and duplicate-name error handling.
- [x] 4.3 Implement the edit dialog so clicking Edit opens a popup dialog, not a right-side detail panel, and shows the selected directory's mount records.
- [x] 4.4 Implement mount and unmount actions inside the edit dialog, including host address input, mount path input, and per-record unmount controls.
- [x] 4.5 Keep `{shared-path}` and `{nfs-export-host}` as internal server-side configuration details and ensure they are not rendered as user-editable fields in the page.

## 5. Validation and coverage

- [x] 5.1 Add tests for runtime configuration parsing and path composition based on `{shared-path}` and `{nfs-export-host}`.
- [x] 5.2 Add tests for registry store behavior, including first-run empty state, directory create, mount update, and guarded delete rules.
- [x] 5.3 Add tests for server API handlers covering successful and failed create, delete, mount, and unmount flows.
- [x] 5.4 Add UI tests or component-level coverage for the directory list page, create dialog, and edit dialog mount workflow.
