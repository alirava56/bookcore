# Final API Contract Audit — Phase 16

The following inventory is generated from **all actual controller sources** and matched to `docs/api/openapi.yaml` by method and canonical route. This is a source-only comparison, not a successful NestJS bootstrap or HTTP contract test.

- Design contract: **46** operations.
- Discovered controller methods: **47**.
- Source ↔ design method/path matches: **46**.
- Intentionally separate private operational route: **GET /api/v1/internal/metrics**, declared via `@MonitoringRoute` and `@UseGuards(MonitorGuard)`; excluded from the Swagger design contract.
- Explicitly missing methods by path: **0**. Full DTO, response nullability and Problem Details runtime equivalence **NOT VERIFIED**.

| Method | Actual route | Controller.handler | Operation ID or exception | Runtime verification |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `IdentityController.login` | `postAuthlogin` | NOT VERIFIED |
| POST | `/api/v1/auth/logout` | `IdentityController.logout` | `postAuthlogout` | NOT VERIFIED |
| POST | `/api/v1/auth/refresh` | `IdentityController.refresh` | `postAuthrefresh` | NOT VERIFIED |
| POST | `/api/v1/auth/register` | `IdentityController.register` | `postAuthregister` | NOT VERIFIED |
| GET | `/api/v1/health/live` | `HealthController.live` | `getHealthlive` | NOT VERIFIED |
| GET | `/api/v1/health/ready` | `HealthController.ready` | `getHealthready` | NOT VERIFIED |
| GET | `/api/v1/internal/metrics` | `MetricsController.metrics` | MONITORING EXCEPTION | NOT VERIFIED |
| GET | `/api/v1/me` | `IdentityController.me` | `getMe` | NOT VERIFIED |
| POST | `/api/v1/me/staff-invitations/accept` | `GovernanceController.accept` | `acceptStaffInvitation` | NOT VERIFIED |
| POST | `/api/v1/me/staff-invitations/decline` | `GovernanceController.decline` | `declineStaffInvitation` | NOT VERIFIED |
| POST | `/api/v1/organizations` | `OrganizationsController.create` | `postOrganizations` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}` | `OrganizationsController.get` | `getOrganizationsorgid` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/booking-consents` | `GovernanceController.grant` | `grantBookingConsent` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/booking-consents/{consentId}/revoke` | `GovernanceController.revokeConsent` | `revokeBookingConsent` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/booking-consents/me` | `GovernanceController.mine` | `listMyBookingConsents` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/bookings/{bookingId}/attendance` | `BookingController.attendance` | `postOrganizationsorgidbookingsbookingidattendance` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/bookings/{bookingId}/cancel` | `BookingController.cancel` | `postOrganizationsorgidbookingsbookingidcancel` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/bookings/me` | `BookingController.mine` | `getOrganizationsorgidbookingsme` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/branches` | `CatalogController.listBranches` | `getOrganizationsorgidbranches` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/branches` | `CatalogController.createBranch` | `postOrganizationsorgidbranches` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/business-hours` | `CatalogController.listHours` | `getOrganizationsorgidbusiness_Hours` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/business-hours` | `CatalogController.createHour` | `postOrganizationsorgidbusiness_Hours` | NOT VERIFIED |
| PATCH | `/api/v1/organizations/{orgId}/business-hours/{hourId}` | `CatalogController.deactivateHour` | `patchOrganizationsorgidbusiness_Hourshourid` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/members` | `OrganizationsController.list` | `getOrganizationsorgidmembers` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/members` | `OrganizationsController.add` | `postOrganizationsorgidmembers` | NOT VERIFIED |
| PATCH | `/api/v1/organizations/{orgId}/members/{userId}` | `OrganizationsController.patch` | `patchOrganizationsorgidmembersuserid` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/reports/occupancy` | `ReportingController.occupancy` | `getOrganizationsorgidreportsoccupancy` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/resources` | `CatalogController.listResources` | `getOrganizationsorgidresources` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/resources` | `CatalogController.createResource` | `postOrganizationsorgidresources` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/schedule-exceptions` | `CatalogController.listExceptions` | `getOrganizationsorgidschedule_Exceptions` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/schedule-exceptions` | `CatalogController.createException` | `postOrganizationsorgidschedule_Exceptions` | NOT VERIFIED |
| PATCH | `/api/v1/organizations/{orgId}/schedule-exceptions/{exceptionId}` | `CatalogController.deactivateException` | `patchOrganizationsorgidschedule_Exceptionsexceptionid` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/services` | `CatalogController.listServices` | `getOrganizationsorgidservices` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/services` | `CatalogController.createService` | `postOrganizationsorgidservices` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/sessions` | `StaffSessionController.list` | `getOrganizationsorgidsessions` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/sessions` | `StaffSessionController.create` | `postOrganizationsorgidsessions` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/sessions/{sessionId}` | `StaffSessionController.get` | `getOrganizationsorgidsessionssessionid` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/sessions/{sessionId}/bookings` | `BookingController.create` | `postOrganizationsorgidsessionssessionidbookings` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/sessions/{sessionId}/cancel` | `StaffSessionController.cancel` | `postOrganizationsorgidsessionssessionidcancel` | NOT VERIFIED |
| PATCH | `/api/v1/organizations/{orgId}/sessions/{sessionId}/capacity` | `StaffSessionController.capacity` | `patchOrganizationsorgidsessionssessionidcapacity` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/sessions/{sessionId}/finish` | `StaffSessionController.finish` | `postOrganizationsorgidsessionssessionidfinish` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/sessions/{sessionId}/publish` | `StaffSessionController.publish` | `postOrganizationsorgidsessionssessionidpublish` | NOT VERIFIED |
| GET | `/api/v1/organizations/{orgId}/staff-invitations` | `GovernanceController.listInvites` | `listStaffInvitations` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/staff-invitations` | `GovernanceController.invite` | `createStaffInvitation` | NOT VERIFIED |
| POST | `/api/v1/organizations/{orgId}/staff-invitations/{invitationId}/revoke` | `GovernanceController.revoke` | `revokeStaffInvitation` | NOT VERIFIED |
| GET | `/api/v1/public/organizations/{orgId}/sessions` | `PublicSessionController.list` | `listPublicOrganizationSessions` | NOT VERIFIED |
| GET | `/api/v1/public/organizations/{orgId}/sessions/{sessionId}` | `PublicSessionController.get` | `getPublicOrganizationSession` | NOT VERIFIED |

Extended fields, request DTO declarations and decorator-derived authentication evidence are available in `docs/api/PHASE_16_IMPLEMENTED_ENDPOINTS.json`. Dynamic middleware, DTO validation, HTTP status and object-level authorization require real runtime tests.
