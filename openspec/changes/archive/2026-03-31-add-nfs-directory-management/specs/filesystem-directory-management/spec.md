# Filesystem Directory Management Specification

## ADDED Requirements

### Requirement: System SHALL present directories as the primary management object

The system SHALL use directories as the primary object on the filesystem directory management page, and SHALL present a list of directories instead of a flat list of mount operations.

#### Scenario: Open directory management page

- **WHEN** an operator navigates to the filesystem directory management page
- **THEN** the system SHALL show a directory list view as the primary screen

#### Scenario: Show directory summary columns

- **WHEN** the directory list is rendered
- **THEN** the system SHALL show directory name, mounted host count, created time, status summary, and actions for each directory

#### Scenario: Omit directory identifier field

- **WHEN** the directory list or create flow is rendered
- **THEN** the system SHALL NOT expose a separate directory ID field to the operator

### Requirement: System SHALL create unique NFS-backed directories using server-side path composition

The system SHALL create managed directories by unique name only, SHALL compute the physical directory path from the server-side configured `{shared-path}` value, and SHALL compute the host-visible NFS mount source from the configured `{nfs-export-host}` value.

#### Scenario: Create directory successfully

- **WHEN** an operator submits a new directory name that does not already exist
- **THEN** the system SHALL create the physical directory at `{shared-path}/<directory-name>`

#### Scenario: Compose host-visible mount source

- **WHEN** the system prepares NFS mount information for a managed directory named `<directory-name>`
- **THEN** the system SHALL use `{nfs-export-host}:/<directory-name>` as the host-visible mount source

#### Scenario: Reject duplicate directory name

- **WHEN** an operator submits a new directory name that already exists in the registry
- **THEN** the system SHALL reject the request and report a name conflict error

#### Scenario: Do not expose shared-path as UI input

- **WHEN** the create directory flow is rendered
- **THEN** the system SHALL NOT require the operator to input or edit `{shared-path}` or `{nfs-export-host}`

### Requirement: System SHALL scope the MVP UI to NFS-backed directories only

The system SHALL support only NFS-backed directory management in the MVP release and SHALL avoid exposing a protocol selector in the operator workflow.

#### Scenario: Render create flow in MVP

- **WHEN** an operator opens the create directory flow
- **THEN** the system SHALL NOT show a mount type or protocol selection field

#### Scenario: Execute directory lifecycle in MVP

- **WHEN** the system creates or deletes a managed directory
- **THEN** the system SHALL execute that lifecycle through the NFS-backed directory management flow

### Requirement: System SHALL open directory details in an edit dialog

The system SHALL open directory details in an edit dialog when the operator clicks Edit, and SHALL NOT rely on a permanently visible right-side detail panel in the page layout.

#### Scenario: Open edit dialog

- **WHEN** an operator clicks the Edit action for a directory row
- **THEN** the system SHALL open a dialog containing that directory's details and mount management actions

#### Scenario: Keep list page focused on summaries

- **WHEN** the main directory list page is displayed
- **THEN** the system SHALL keep detailed mount management content outside the main list layout until Edit is invoked

### Requirement: System SHALL block deletion while active mount records exist

The system SHALL allow directory deletion only when the directory has no active mount records.

#### Scenario: Delete unmounted directory

- **WHEN** an operator deletes a directory that has no active mount records
- **THEN** the system SHALL delete the directory from storage and remove it from the registry

#### Scenario: Reject deletion of mounted directory

- **WHEN** an operator deletes a directory that still has one or more active mount records
- **THEN** the system SHALL reject the deletion request and report that the directory is still in use
