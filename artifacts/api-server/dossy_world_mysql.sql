-- Dossy World — MySQL schema
-- Database: admin_dossy
-- Generated: 2026-05-02
-- Run this on your live MySQL server to create all tables.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────
--  users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            VARCHAR(36)   NOT NULL,
  `username`      VARCHAR(20)   NOT NULL,
  `email`         VARCHAR(255)  DEFAULT NULL,
  `phone`         VARCHAR(20)   DEFAULT NULL,
  `bound_phone`   VARCHAR(20)   DEFAULT NULL,
  `password_hash` VARCHAR(255)  NOT NULL DEFAULT '',
  `google_id`     VARCHAR(100)  DEFAULT NULL,
  `avatar_url`    VARCHAR(512)  DEFAULT NULL,
  `balance`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `is_admin`      TINYINT(1)    NOT NULL DEFAULT 0,
  `is_bot`        TINYINT(1)    NOT NULL DEFAULT 0,
  `is_banned`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email`    (`email`),
  UNIQUE KEY `uq_users_phone`    (`phone`),
  UNIQUE KEY `uq_users_google_id`(`google_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
--  rounds
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rounds` (
  `id`                VARCHAR(36)   NOT NULL,
  `round_number`      INT UNSIGNED  NOT NULL,
  `vault_cap`         DECIMAL(15,2) NOT NULL,
  `profit_percentage` DECIMAL(5,2)  NOT NULL DEFAULT 30.00,
  `current_amount`    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status`            ENUM('waiting','active','filled','paying','paid','expired','cancelled') NOT NULL DEFAULT 'waiting',
  `bot_count`         INT UNSIGNED  NOT NULL DEFAULT 0,
  `will_fill`         TINYINT(1)    NOT NULL DEFAULT 1,
  `bot_target_pct`    DECIMAL(5,2)  NOT NULL DEFAULT 80.00,
  `expires_at`        DATETIME      DEFAULT NULL,
  `expired_at`        DATETIME      DEFAULT NULL,
  `started_at`        DATETIME      DEFAULT NULL,
  `filled_at`         DATETIME      DEFAULT NULL,
  `paid_at`           DATETIME      DEFAULT NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `server_seed`       VARCHAR(128)  DEFAULT NULL,
  `server_seed_hash`  VARCHAR(128)  DEFAULT NULL,
  `client_seed`       VARCHAR(128)  DEFAULT NULL,
  `fairness_nonce`    INT UNSIGNED  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rounds_number` (`round_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
--  buys
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `buys` (
  `id`             VARCHAR(36)   NOT NULL,
  `round_id`       VARCHAR(36)   NOT NULL,
  `user_id`        VARCHAR(36)   NOT NULL,
  `amount`         DECIMAL(15,2) NOT NULL,
  `payout_amount`  DECIMAL(15,2) DEFAULT NULL,
  `is_paid`        TINYINT(1)    NOT NULL DEFAULT 0,
  `is_bot_buy`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buys_round_id` (`round_id`),
  KEY `idx_buys_user_id`  (`user_id`),
  CONSTRAINT `fk_buys_round` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_buys_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
--  transactions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transactions` (
  `id`             VARCHAR(36)   NOT NULL,
  `user_id`        VARCHAR(36)   NOT NULL,
  `type`           ENUM('deposit','withdrawal','buy','payout','refund','admin_credit','admin_debit') NOT NULL,
  `amount`         DECIMAL(15,2) NOT NULL,
  `balance_after`  DECIMAL(15,2) NOT NULL,
  `status`         ENUM('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `reference`      VARCHAR(255)  DEFAULT NULL,
  `metadata`       JSON          DEFAULT NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tx_user_id`   (`user_id`),
  KEY `idx_tx_type`      (`type`),
  KEY `idx_tx_status`    (`status`),
  KEY `idx_tx_created`   (`created_at`),
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
--  settings  (key/value store for admin)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `key`        VARCHAR(100) NOT NULL,
  `value`      TEXT         DEFAULT NULL,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
--  audit_log
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_id`   VARCHAR(36)   DEFAULT NULL,
  `action`     VARCHAR(100)  NOT NULL,
  `target_id`  VARCHAR(36)   DEFAULT NULL,
  `metadata`   JSON          DEFAULT NULL,
  `ip`         VARCHAR(45)   DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor`   (`actor_id`),
  KEY `idx_audit_action`  (`action`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
