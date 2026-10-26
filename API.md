# API

Every endpoint the app needs, with its types in [`lib/types.ts`](lib/types.ts). The frontend builds against `lib/mocks.ts` until an endpoint is ready, then switches to it. **Week** is when the endpoint gets built.

Change this file and `lib/types.ts` only when both sides agree.

## Rules for every endpoint

- **Paths** start with `/api`. Bodies are JSON.
- **Sign-in** sets an httpOnly `session` cookie. Every endpoint needs it unless marked *public*.
- **Errors** return `ApiError` (`{ "error": "..." }`) with one of these statuses:

| Status | Meaning |
|---|---|
| 400 | The body or query is invalid |
| 401 | Not signed in, or the session expired |
| 403 | Signed in with the wrong role, or the account is suspended |
| 404 | No such item, or it isn't yours |
| 409 | The action no longer fits the current state, e.g. another driver claimed the ride first |

## Auth and profile

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| POST | `/api/auth/sign-up` | public | `SignUpRequest` | `Me`, creates a student account | 1 ✅ |
| POST | `/api/auth/sign-in` | public | `SignInRequest` | `Me` | 1 ✅ |
| POST | `/api/auth/sign-out` | anyone | — | `204` | 1 ✅ |
| GET | `/api/me` | anyone | — | `Me` | 1 ✅ |
| PATCH | `/api/me` | anyone | `UpdateMeRequest` | `Me` | 5 |
| GET | `/api/me/penalty-points` | student | — | `PenaltyPoint[]`, approved only | 5 |

## Stops and service

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| GET | `/api/health` | public | — | `{ "status": "ok" }` | 1 ✅ |
| GET | `/api/stops` | anyone | — | `Stop[]`, active stops by name | 2 ✅ |
| GET | `/api/service-status` | public | — | `ServiceStatus`, including the largest party size a request may have | 2 ✅ |

## Student rides

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| POST | `/api/rides` | student | `CreateRideRequest` | `Ride`. 409 if the student already has an active ride or service is closed | 2 |
| GET | `/api/rides/active` | student | — | `Ride` or `null`. Poll every 3–5 s while a ride is active | 2 |
| POST | `/api/rides/:id/cancel` | student | `CancelRideRequest` | `Ride`. 409 once the ride is in progress | 2 |
| GET | `/api/rides/:id/driver-position` | student | — | `Position` or `null`, while the ride is assigned, en route or arrived | 4 |
| GET | `/api/rides/history?cursor=` | student | — | `HistoryPage`, 20 per page, newest first | 5 |
| POST | `/api/rides/:id/feedback` | student | `FeedbackRequest` | `Ride`. Completed rides only, once | 5 |

## Driver

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| GET | `/api/carts` | driver, admin | — | `Cart[]` | 3 |
| POST | `/api/driver/shift` | driver | `StartShiftRequest` | `Shift`. 409 if the cart is in use | 3 |
| DELETE | `/api/driver/shift` | driver | — | `204`. 409 while holding a ride | 3 |
| GET | `/api/driver/queue` | driver | — | `DriverQueue`. Poll every 3–5 s on shift | 3 |
| POST | `/api/driver/rides/:id/claim` | driver | — | `StaffRide`. 409 if someone else got it first | 3 |
| POST | `/api/driver/rides/:id/en-route` | driver | — | `StaffRide` | 3 |
| POST | `/api/driver/rides/:id/arrived` | driver | — | `StaffRide` | 3 |
| POST | `/api/driver/rides/:id/start` | driver | — | `StaffRide` | 3 |
| POST | `/api/driver/rides/:id/complete` | driver | — | `StaffRide` | 3 |
| POST | `/api/driver/rides/:id/no-show` | driver | — | `StaffRide` | 3 |
| POST | `/api/driver/rides/:id/cancel` | driver | `CancelRideRequest`, reason required | `StaffRide` | 3 |
| POST | `/api/driver/position` | driver | `PositionReport` | `204`. Every 5–10 s on shift | 4 |
| POST | `/api/driver/rides/:id/penalty-point` | driver | `PenaltyPointRequest` | `PenaltyPoint`, pending until an admin decides | 5 |

## Admin

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| PUT | `/api/admin/service` | admin | `SetServiceModeRequest` | `ServiceStatus` | 2 ✅ |
| GET | `/api/admin/board` | admin | — | `AdminBoard`. Poll every 3–5 s | 3 |
| POST | `/api/admin/rides/:id/assign` | admin | `AssignRequest` | `StaffRide`. Also reassigns | 3 |
| POST | `/api/admin/rides/:id/unassign` | admin | — | `StaffRide`, back to `requested` | 3 |
| POST | `/api/admin/rides/:id/cancel` | admin | `CancelRideRequest`, reason required | `StaffRide` | 3 |
| GET | `/api/admin/driver-positions` | admin | — | `DriverPosition[]` | 4 |
| GET | `/api/admin/service-rules` | admin | — | `ServiceRule[]` | 4 |
| POST | `/api/admin/service-rules` | admin | `ServiceRuleInput` | `ServiceRule` | 4 |
| PUT | `/api/admin/service-rules/:id` | admin | `ServiceRuleInput` | `ServiceRule` | 4 |
| DELETE | `/api/admin/service-rules/:id` | admin | — | `204` | 4 |
| GET | `/api/admin/users?role=&q=` | admin | — | `User[]` | 5 |
| PATCH | `/api/admin/users/:id` | admin | `UpdateUserRequest` | `User` | 5 |
| POST | `/api/admin/carts` | admin | `CartInput` | `Cart` | 5 |
| PATCH | `/api/admin/carts/:id` | admin | `Partial<CartInput>` | `Cart` | 5 |
| GET | `/api/admin/penalty-points?status=pending` | admin | — | `PenaltyPoint[]` | 5 |
| POST | `/api/admin/penalty-points` | admin | `PenaltyPointRequest & { studentId: string }` | `PenaltyPoint`, approved at once | 5 |
| POST | `/api/admin/penalty-points/:id/approve` | admin | — | `PenaltyPoint` | 5 |
| POST | `/api/admin/penalty-points/:id/reject` | admin | — | `PenaltyPoint` | 5 |

## Notifications

| Method | Path | Who | Body | Returns | Week |
|---|---|---|---|---|---|
| GET | `/api/notifications` | anyone | — | `Notification[]`, newest 50 | 5 |
| POST | `/api/notifications/:id/read` | anyone | — | `204` | 5 |

## Ride status

Every status change goes through one server function, so these are the only moves:

| From | To | By |
|---|---|---|
| `requested` | `assigned` | driver claims, or admin assigns |
| `assigned` | `en_route` | driver |
| `assigned`, `en_route` | `arrived` | driver |
| `arrived` | `in_progress` | driver starts the ride |
| `in_progress` | `completed` | driver |
| `arrived` | `no_show` | driver |
| `assigned`, `en_route`, `arrived` | `requested` | admin unassigns |
| `requested`, `assigned`, `en_route`, `arrived` | `canceled` | student, driver or admin |

`completed`, `canceled` and `no_show` are final. Any other move returns 409.
