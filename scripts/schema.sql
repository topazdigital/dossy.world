-- Dossy World Database Schema
-- MySQL 8.0+
-- Domain: dossy.world

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS withdrawal_requests;
DROP TABLE IF EXISTS buys;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS rounds;
DROP TABLE IF EXISTS bot_names;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  balance DECIMAL(12,2) DEFAULT 0.00,
  is_admin BOOLEAN DEFAULT FALSE,
  is_bot BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_phone (phone),
  INDEX idx_users_is_bot (is_bot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rounds table (game rounds)
CREATE TABLE rounds (
  id VARCHAR(36) PRIMARY KEY,
  round_number INT NOT NULL AUTO_INCREMENT UNIQUE,
  vault_cap DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
  profit_percentage DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  current_amount DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('waiting', 'active', 'filled', 'paying', 'paid', 'cancelled') DEFAULT 'waiting',
  bot_count INT DEFAULT 0,
  started_at TIMESTAMP NULL,
  filled_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rounds_status (status),
  INDEX idx_rounds_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Buys table (user participation in rounds)
CREATE TABLE buys (
  id VARCHAR(36) PRIMARY KEY,
  round_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payout_amount DECIMAL(12,2) NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  is_bot_buy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_buys_round (round_id),
  INDEX idx_buys_user (user_id),
  INDEX idx_buys_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions table (wallet transactions)
CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('deposit', 'withdrawal', 'buy', 'payout', 'refund', 'admin_credit', 'admin_debit') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  mpesa_receipt VARCHAR(50) NULL,
  mpesa_checkout_id VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  description TEXT,
  reference_id VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transactions_user (user_id),
  INDEX idx_transactions_type (type),
  INDEX idx_transactions_status (status),
  INDEX idx_transactions_created (created_at DESC),
  INDEX idx_transactions_mpesa (mpesa_checkout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings table (global game settings)
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bot names pool
CREATE TABLE bot_names (
  id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(30) NOT NULL,
  last_name VARCHAR(30) NOT NULL,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Withdrawal requests
CREATE TABLE withdrawal_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status ENUM('pending', 'approved', 'processing', 'completed', 'rejected', 'failed') DEFAULT 'pending',
  admin_notes TEXT,
  processed_by VARCHAR(36) NULL,
  mpesa_receipt VARCHAR(50) NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_withdrawals_user (user_id),
  INDEX idx_withdrawals_status (status),
  INDEX idx_withdrawals_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
