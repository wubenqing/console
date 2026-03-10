# Grafana Integration Specification

## ADDED Requirements

### Requirement: System SHALL configure Grafana connection via environment variables

The system SHALL allow administrators to configure the Grafana connection through environment variables.

#### Scenario: Configure Grafana URL

- **WHEN** environment variable `GRAFANA_URL` is set
- **THEN** the system SHALL use the provided URL for Grafana connection

#### Scenario: Use default Grafana URL

- **WHEN** `GRAFANA_URL` environment variable is not set
- **THEN** the system SHALL use `http://localhost:3000` as the default URL

#### Scenario: Configure Dashboard ID

- **WHEN** environment variable `GRAFANA_DASHBOARD_ID` is set
- **THEN** the system SHALL use the provided ID in the dashboard URL

#### Scenario: Use default Dashboard ID

- **WHEN** `GRAFANA_DASHBOARD_ID` environment variable is not set
- **THEN** the system SHALL use `rustfs-s3` as the default ID

#### Scenario: Configure Dashboard Slug

- **WHEN** environment variable `GRAFANA_DASHBOARD_SLUG` is set
- **THEN** the system SHALL use the provided slug in the dashboard URL

#### Scenario: Use default Dashboard Slug

- **WHEN** `GRAFANA_DASHBOARD_SLUG` environment variable is not set
- **THEN** the system SHALL use `rustfs` as the default slug

### Requirement: System SHALL embed Grafana dashboard in iframe

The system SHALL display the Grafana dashboard within the Console dashboard page using an iframe element.

#### Scenario: Load Grafana dashboard

- **WHEN** user navigates to `/dashboard` route
- **THEN** the system SHALL load Grafana dashboard in iframe with URL format: `{grafana_url}/d/{dashboard_id}/{dashboard_slug}`

#### Scenario: Include required URL parameters

- **WHEN** iframe URL is generated
- **THEN** URL SHALL include parameters: `?orgId=1&from={timeRange}&to=now&timezone=browser&refresh={refreshInterval}&kiosk={kiosk}&theme={theme}`

#### Scenario: Include filter variables in URL

- **WHEN** iframe URL is generated
- **THEN** URL SHALL include filter variables: `&var-datasource=prometheus&var-job=$__all&var-path=$__all&var-bucket=$__all&var-drive=$__all`

### Requirement: System SHALL implement responsive iframe layout

The system SHALL use flex-based layout to make the iframe fill available space.

#### Scenario: Fill remaining vertical space

- **WHEN** dashboard page is rendered
- **THEN** iframe SHALL use flex layout properties: `flex-1 min-h-0` to fill remaining space

#### Scenario: Fill full width and height

- **WHEN** iframe is rendered
- **THEN** iframe SHALL use CSS: `width: 100% height: 100%` to fill container

#### Scenario: Prevent scrollbars

- **WHEN** page is rendered at various screen sizes
- **THEN** iframe SHALL not cause vertical scrollbar on main page

### Requirement: System SHALL enable auto-refresh functionality

The system SHALL enable Grafana dashboard auto-refresh through URL configuration.

#### Scenario: Enable auto-refresh

- **WHEN** dashboard loads
- **THEN** Grafana SHALL automatically refresh content at interval specified by `refresh` parameter

#### Scenario: Use default refresh interval

- **WHEN** system generates iframe URL
- **THEN** refresh interval SHALL default to `15s` if not overridden

#### Scenario: Configure custom refresh interval

- **WHEN** environment variable `GRAFANA_REFRESH` is set
- **THEN** system SHALL use provided value for refresh interval

### Requirement: System SHALL configure time range display

The system SHALL set the initial time range for dashboard display.

#### Scenario: Use default time range

- **WHEN** dashboard loads
- **THEN** `from` parameter SHALL default to `now-1h` showing last hour of data

#### Scenario: Configure custom time range

- **WHEN** environment variable `GRAFANA_TIME_RANGE` is set
- **THEN** system SHALL use provided value for time range parameter

### Requirement: System SHALL enable Kiosk mode

The system SHALL hide Grafana UI chrome elements.

#### Scenario: Enable Kiosk mode

- **WHEN** iframe URL is generated
- **THEN** URL SHALL include `kiosk=true` parameter to hide Grafana header and sidebar

#### Scenario: Use light theme

- **WHEN** iframe URL is generated
- **THEN** URL SHALL include `theme=light` parameter for UI consistency
