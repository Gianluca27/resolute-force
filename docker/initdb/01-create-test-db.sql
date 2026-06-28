-- Runs once on first container init (Postgres creates resolute_dev from POSTGRES_DB).
-- The test DB lives on the same instance; vitest globalSetup resets its schema each run.
CREATE DATABASE resolute_test;
