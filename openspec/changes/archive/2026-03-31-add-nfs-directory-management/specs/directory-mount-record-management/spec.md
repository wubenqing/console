# Directory Mount Record Management Specification

## ADDED Requirements

### Requirement: System SHALL manage mount records within the directory edit dialog

The system SHALL manage a directory's mount records from that directory's edit dialog, with each active mount record storing the host address and mount path.

#### Scenario: Show active mount records for a directory

- **WHEN** an operator opens the edit dialog for a directory
- **THEN** the system SHALL display the directory's active mount records with host address, mount path, status, and available actions

#### Scenario: Keep mount records grouped by directory

- **WHEN** mount records are displayed in the UI
- **THEN** the system SHALL display them only in the context of their owning directory rather than as a separate global list

### Requirement: System SHALL create an active mount record through the mount action

The system SHALL allow an operator to create an active mount record by providing a host address and mount path in the directory edit dialog.

#### Scenario: Mount directory to host path successfully

- **WHEN** an operator submits a host address and mount path from the edit dialog and the mount API succeeds
- **THEN** the system SHALL add an active mount record for that directory with the submitted host address and mount path

#### Scenario: Mount uses export-host-based source

- **WHEN** the system sends a mount request for directory `<directory-name>`
- **THEN** the host-side mount flow SHALL use `{nfs-export-host}:/<directory-name>` as the mount source instead of any server-local `{shared-path}` value

#### Scenario: Reflect mount result in directory summary

- **WHEN** a mount record is added successfully
- **THEN** the system SHALL update the directory's mounted host count and status summary to include the new active mount

#### Scenario: Reject failed mount creation

- **WHEN** the mount API fails for the submitted host address and mount path
- **THEN** the system SHALL report the failure to the operator and SHALL NOT create an active mount record for that failed attempt

### Requirement: System SHALL unmount directories through individual mount records

The system SHALL allow an operator to unmount a directory through an individual active mount record in the directory edit dialog.

#### Scenario: Unmount active mount record successfully

- **WHEN** an operator clicks Unmount for an active mount record and the unmount API succeeds
- **THEN** the system SHALL remove that active mount record from the directory's active mount list

#### Scenario: Reflect unmount result in directory summary

- **WHEN** an active mount record is removed successfully
- **THEN** the system SHALL update the directory's mounted host count and status summary to reflect the remaining active mounts

#### Scenario: Preserve active record on unmount failure

- **WHEN** the unmount API fails for an active mount record
- **THEN** the system SHALL report the failure and SHALL keep that mount record active in the UI and registry

### Requirement: System SHALL keep the MVP mount workflow limited to mount and unmount actions

The system SHALL keep the MVP operator workflow limited to mount and unmount actions and SHALL NOT expose extra validation or reconciliation actions in the directory edit dialog.

#### Scenario: Render edit dialog actions

- **WHEN** an operator views active mount records in the edit dialog
- **THEN** the system SHALL expose unmount as the record-level action and SHALL NOT show a separate validate action

#### Scenario: Render mount workflow in MVP

- **WHEN** an operator manages mount records in the edit dialog
- **THEN** the system SHALL provide fields for host address and mount path plus a mount action only
