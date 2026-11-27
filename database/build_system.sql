-- Run once in phpMyAdmin after selecting the VEX database.
-- Stores the exact build settings submitted by each account owner.
ALTER TABLE builds ADD COLUMN config_json LONGTEXT NULL AFTER apk_path;
ALTER TABLE builds ADD COLUMN build_format VARCHAR(8) NOT NULL DEFAULT 'apk' AFTER config_json;
ALTER TABLE builds ADD COLUMN build_type VARCHAR(8) NOT NULL DEFAULT 'debug' AFTER build_format;
