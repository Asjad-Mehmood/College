-- Accounts sign in with an email address (stored in the existing "username"
-- column); widen it to fit email addresses. Safe to re-run.
ALTER TABLE "users" ALTER COLUMN "username" TYPE VARCHAR(120);
