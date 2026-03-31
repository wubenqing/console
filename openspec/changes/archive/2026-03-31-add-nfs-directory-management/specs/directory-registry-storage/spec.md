# Directory Registry Storage Specification

## ADDED Requirements

### Requirement: System SHALL persist directory state in a server-side JSON registry

The system SHALL persist managed directory state in a server-side JSON registry file rather than in browser-local storage.

#### Scenario: Use server-side registry file

- **WHEN** the system persists directory management state
- **THEN** it SHALL write that state to `{shared-path}/.aiunistor/registry.json`

#### Scenario: Do not use browser cache as system of record

- **WHEN** an operator reloads the browser or signs in from another browser session
- **THEN** the system SHALL recover directory state from the server-side registry rather than browser-local cache

### Requirement: System SHALL store directories with nested active mount records

The registry SHALL store each managed directory together with its active mount records so that the directory remains the aggregate root for filesystem management state.

#### Scenario: Persist directory with no active mounts

- **WHEN** a directory exists with no active mount records
- **THEN** the registry SHALL still persist the directory entry with an empty mount record list

#### Scenario: Persist directory with active mounts

- **WHEN** a directory has active mount records
- **THEN** the registry SHALL store those active mount records beneath that directory entry

#### Scenario: Persist mount record fields

- **WHEN** an active mount record is stored in the registry
- **THEN** the record SHALL include at least the host address, mount path, and current status

### Requirement: System SHALL derive internal storage paths from configured shared-path and export-host configuration

The system SHALL derive the registry file path and managed directory paths from the configured `{shared-path}` value on the server side, and SHALL derive host-visible mount sources from the configured `{nfs-export-host}` value.

#### Scenario: Build registry path

- **WHEN** the server initializes directory registry storage
- **THEN** it SHALL use `{shared-path}/.aiunistor/registry.json` as the registry location

#### Scenario: Build managed directory path

- **WHEN** the server creates a managed directory named `<directory-name>`
- **THEN** it SHALL use `{shared-path}/<directory-name>` as the physical directory path

#### Scenario: Build host-visible mount source

- **WHEN** the server prepares mount information for a managed directory named `<directory-name>`
- **THEN** it SHALL use `{nfs-export-host}:/<directory-name>` as the host-visible mount source

#### Scenario: Keep path construction out of operator input

- **WHEN** the UI renders directory creation or edit flows
- **THEN** the system SHALL NOT require the operator to enter the resolved physical storage path

### Requirement: System SHALL treat missing registry state as an empty directory list

The system SHALL allow first-time startup without a pre-existing registry file.

#### Scenario: Registry file does not exist yet

- **WHEN** the directory management page is loaded before `registry.json` has been created
- **THEN** the system SHALL treat the directory list as empty rather than failing the page

#### Scenario: First managed directory is created

- **WHEN** the first directory is created successfully
- **THEN** the system SHALL create the registry file and persist the new directory entry
