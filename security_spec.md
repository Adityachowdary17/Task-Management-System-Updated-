# Security Specification — Cadence Task Workspace

## 1. Data Invariants

1. **Ownership & Isolation**: Every user workspace (`/users/{userId}`), private profile (`/users/{userId}/private/profile`), project (`/users/{userId}/projects/{projectId}`), task (`/users/{userId}/tasks/{taskId}`), and chat message (`/users/{userId}/chatMessages/{messageId}`) is strictly owned by `userId`. Only the verified authenticated user (`request.auth.uid == userId && request.auth.token.email_verified == true`) may read or write within their namespace.
2. **Relational Integrity**: A task cannot be created or reassigned to a `project` that does not exist in `/users/{userId}/projects/{projectId}` (enforced via `existsAfter()` so atomic onboarding batches and normal single writes both verify parent project existence).
3. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/profile`, never in `/users/{userId}` or task/project records, and are readable/writable only by `isOwner(userId)`.
4. **Strict Keys & Immutable Fields**: All documents reject shadow fields via `keys().hasAll(...) && keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update. `ownerId`, `userId`, `id`, and `createdAt` are immutable after creation.
5. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. **Bounded Payloads & Valid IDs**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), strings enforce `.size()` bounds, enums (`category`, `priority`, `status`, `theme`, `role`, `persona`) are strictly allowlisted, and arrays (`tags`, `sources`) are bounded to `<= 10` elements with first-element type validation when non-empty.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unauthenticated Task Read/Write**: `GET` or `CREATE` `/users/alice/tasks/t1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `CREATE` `/users/alice/tasks/t1` with `auth.uid == 'alice'` and `token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-User Workspace Access**: Bob (`uid: 'bob'`) tries to `GET`, `LIST`, `CREATE`, `UPDATE`, or `DELETE` `/users/alice/tasks/t1` -> `PERMISSION_DENIED`.
4. **Cross-User PII Leak**: Bob (`uid: 'bob'`) tries to `GET` `/users/alice/private/profile` -> `PERMISSION_DENIED`.
5. **Owner Spoofing on Create**: Alice (`uid: 'alice'`) creates `/users/alice/tasks/t1` with `ownerId: 'bob'` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Alice creates or updates a task with an extra undeclared field `{ isAdmin: true }` -> `PERMISSION_DENIED`.
7. **Orphaned Project Reference**: Alice creates a task with `project: 'nonexistent-proj'` -> `PERMISSION_DENIED`.
8. **Invalid Category or Priority Enum**: Alice creates or updates a task with `priority: 'critical'` or `category: 'unknown'` -> `PERMISSION_DENIED`.
9. **Array Exhaustion Attack (Tags > 10)**: Alice creates a task with `tags: ['a','b','c','d','e','f','g','h','i','j','k']` (11 items) -> `PERMISSION_DENIED`.
10. **Array Element Type Poisoning**: Alice creates a task with `tags: [12345]` (non-string element) -> `PERMISSION_DENIED`.
11. **Client Timestamp Forgery**: Alice creates a task with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
12. **ID Poisoning / Immutable Field Mutation**: Alice attempts to create `/users/alice/tasks/bad$id!` (invalid ID characters) or mutate `ownerId` / `createdAt` on update -> `PERMISSION_DENIED`.
