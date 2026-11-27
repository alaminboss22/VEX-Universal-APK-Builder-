-- Run once in phpMyAdmin to enable secure GitHub Actions build workers.
ALTER TABLE builds ADD COLUMN worker_token_hash CHAR(64) NULL;
ALTER TABLE builds ADD COLUMN worker_token_expires_at DATETIME NULL;
