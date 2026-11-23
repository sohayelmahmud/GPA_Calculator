# Security Review

Review date: 2026-11-23

## Summary

One medium-severity deployment issue was confirmed. No critical or high-severity vulnerabilities were confirmed by the follow-up review.

| # | Severity | File | Lines | Finding | Confidence |
|---|----------|------|-------|---------|------------|
| 1 | 🟡 MEDIUM | migrations/0001_init.sql | 3-27 | This migration was modified after initial deployment support was established. Wrangler migration history will not add a missing users.email column or retrofit existing databases that already applied 0001. A new numbered migration is required. | 10/10 |

## Confirmed Finding

### 1. Existing databases need an additive migration

The current migration declares email, otp_codes, and messages, but editing an already-applied migration does not change a database that has already recorded 0001 as applied.

Existing deployments may consequently fail registration, OTP reset, or contact submission if they lack:

- The users.email column
- The otp_codes table
- The messages table

Restore 0001 as the original immutable migration and add a new migration that safely adds the missing schema.

## Resolved Before This Review

The following issues were addressed in earlier changes:

- Password-reset OTP codes are deleted after an incorrect submission.
- Password reset deletes all sessions for the account.
- Password change deletes all other sessions while preserving the current session.

## Additional Checks

- Parameterized D1 queries were used throughout the reviewed code.
- `npm audit --omit=dev` reported zero known production dependency vulnerabilities.
- The Worker's password hashes use PBKDF2-SHA256 with a per-user salt.
- Authentication cookies use HttpOnly, Secure, and Lax attributes.

## Recommended Follow-up

- Restore the original 0001 migration.
- Add and apply a new additive migration for existing databases.
- Continue separately tracking login throttling, password policy, Turnstile configuration, and OTP attempt controls.
