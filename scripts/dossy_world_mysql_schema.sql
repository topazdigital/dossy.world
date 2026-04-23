-- =====================================================
-- Dossy World MySQL Database Schema
-- Version: 2.0 (Continuous Aviator-Style Vault System)
-- Domain: dossy.world
-- 
-- This script creates all necessary tables for the Dossy World 
-- continuous vault-filling investment system.
-- Import this file into your MySQL server to set up the database.
-- =====================================================

-- Uncomment to create database
-- CREATE DATABASE IF NOT EXISTS dossy_world CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE dossy_world;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS withdrawal_requests;
DROP TABLE IF EXISTS buys;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS rounds;
DROP TABLE IF EXISTS game_state;
DROP TABLE IF EXISTS bot_names;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

-- =====================================================
-- USERS TABLE
-- Stores all user accounts including admins and bots
-- =====================================================
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) DEFAULT NULL UNIQUE,
    phone VARCHAR(20) DEFAULT NULL UNIQUE,
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
-- GAME STATE TABLE (NEW - Global synchronized state)
-- Single row that all clients read from for real-time sync
-- =====================================================
CREATE TABLE game_state (
    id INT PRIMARY KEY DEFAULT 1,
    current_round_id VARCHAR(36) DEFAULT NULL,
    phase ENUM('waiting', 'filling', 'eruption', 'paused') DEFAULT 'waiting',
    phase_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vault_fill_percent DECIMAL(5, 2) DEFAULT 0.00,
    total_invested DECIMAL(15, 2) DEFAULT 0.00,
    vault_target DECIMAL(15, 2) DEFAULT 10000.00,
    investor_count INT DEFAULT 0,
    next_eruption_target DECIMAL(5, 2) DEFAULT 100.00,
    is_paused BOOLEAN DEFAULT FALSE,
    last_tick_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROUNDS TABLE
-- Stores all completed rounds for history
-- =====================================================
CREATE TABLE rounds (
    id VARCHAR(36) PRIMARY KEY,
    round_number INT NOT NULL AUTO_INCREMENT UNIQUE,
    vault_target DECIMAL(15, 2) NOT NULL,
    profit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    total_invested DECIMAL(15, 2) DEFAULT 0.00,
    final_fill_percent DECIMAL(5, 2) DEFAULT 0.00,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    investor_count INT DEFAULT 0,
    bot_investor_count INT DEFAULT 0,
    real_investor_count INT DEFAULT 0,
    total_payout DECIMAL(15, 2) DEFAULT 0.00,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    erupted_at TIMESTAMP NULL DEFAULT NULL,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_round_number (round_number),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BUYS TABLE (Investments)
-- Records all investments made in each round
-- =====================================================
CREATE TABLE buys (
    id VARCHAR(36) PRIMARY KEY,
    round_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payout_amount DECIMAL(15, 2) DEFAULT NULL,
    payout_multiplier DECIMAL(5, 2) DEFAULT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    is_bot_buy BOOLEAN DEFAULT FALSE,
    invested_at_percent DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL DEFAULT NULL,
    
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
-- Records all financial transactions
-- =====================================================
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('deposit', 'withdrawal', 'invest', 'payout', 'refund', 'admin_credit', 'admin_debit') NOT NULL,
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
CREATE TABLE settings (
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
CREATE TABLE bot_names (
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
CREATE TABLE withdrawal_requests (
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

-- Initialize game state (single row)
INSERT INTO game_state (id, phase, vault_fill_percent, total_invested, vault_target, is_paused) VALUES
(1, 'waiting', 0.00, 0.00, 10000.00, FALSE);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
    -- Investment limits
    ('min_invest_amount', '50', 'Minimum investment amount in KES'),
    ('max_invest_amount', '5000', 'Maximum investment amount in KES'),
    
    -- Vault settings
    ('default_vault_target', '10000', 'Default vault target for new rounds'),
    ('default_profit_percentage', '30', 'Default profit percentage for payouts'),
    
    -- Timing settings
    ('waiting_duration_seconds', '5', 'Seconds to wait before filling starts'),
    ('min_fill_duration_seconds', '30', 'Minimum seconds for vault to fill'),
    ('max_fill_duration_seconds', '120', 'Maximum seconds for vault to fill'),
    
    -- Bot settings
    ('bots_enabled', 'true', 'Enable bot investors'),
    ('bot_activity_level', 'medium', 'Bot activity level: low, medium, high'),
    ('min_real_users_for_bot_reduction', '5', 'Reduce bot activity when this many real users are investing'),
    ('bot_min_invest', '100', 'Minimum bot investment'),
    ('bot_max_invest', '1000', 'Maximum bot investment'),
    
    -- Withdrawal settings
    ('min_withdrawal', '100', 'Minimum withdrawal amount'),
    ('max_withdrawal', '70000', 'Maximum withdrawal amount'),
    ('withdrawal_fee_percent', '0', 'Withdrawal fee percentage'),
    
    -- System settings
    ('system_paused', 'false', 'Pause the entire system'),
    ('maintenance_mode', 'false', 'Enable maintenance mode'),
    ('site_name', 'Dossy World', 'Site display name'),
    ('site_tagline', 'Fill the Vault. Share the Profit.', 'Site tagline')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert Kenyan bot names
INSERT INTO bot_names (first_name, last_name) VALUES
    ('James', 'Mwangi'), ('Mary', 'Wanjiku'), ('John', 'Kamau'), ('Grace', 'Njeri'),
    ('Peter', 'Ochieng'), ('Faith', 'Akinyi'), ('David', 'Kipchoge'), ('Sarah', 'Chebet'),
    ('Michael', 'Otieno'), ('Lucy', 'Muthoni'), ('Joseph', 'Karanja'), ('Esther', 'Wambui'),
    ('Daniel', 'Kipruto'), ('Ann', 'Moraa'), ('Samuel', 'Wekesa'), ('Joyce', 'Adhiambo'),
    ('Patrick', 'Mutua'), ('Caroline', 'Nyambura'), ('George', 'Omondi'), ('Agnes', 'Kemunto'),
    ('Brian', 'Kosgei'), ('Mercy', 'Chepkoech'), ('Kevin', 'Muchiri'), ('Beatrice', 'Wangari'),
    ('Collins', 'Rotich'), ('Winnie', 'Auma'), ('Dennis', 'Ndungu'), ('Sharon', 'Jepkosgei'),
    ('Felix', 'Musyoka'), ('Nancy', 'Nyawira'), ('Victor', 'Sang'), ('Diana', 'Cheptoo'),
    ('Stephen', 'Maina'), ('Rose', 'Atieno'), ('Anthony', 'Kigen'), ('Charity', 'Jeruto'),
    ('Martin', 'Wafula'), ('Gladys', 'Chelimo'), ('Francis', 'Kimani'), ('Irene', 'Jepchirchir'),
    ('Charles', 'Barasa'), ('Catherine', 'Nekesa'), ('Edward', 'Chesang'), ('Pamela', 'Cheruiyot'),
    ('Robert', 'Odongo'), ('Janet', 'Chepngetich'), ('William', 'Korir'), ('Elizabeth', 'Jeptoo'),
    ('Thomas', 'Wasike'), ('Margaret', 'Chepkemoi'), ('Richard', 'Lagat'), ('Dorothy', 'Jepkirui'),
    ('Paul', 'Simiyu'), ('Eunice', 'Chepngeno'), ('Timothy', 'Wanyonyi'), ('Christine', 'Jepkogei'),
    ('Andrew', 'Biwott'), ('Alice', 'Chepchumba'), ('Mark', 'Kibet'), ('Susan', 'Jepkurui'),
    ('Simon', 'Chesire'), ('Peninah', 'Chepyator'), ('Emmanuel', 'Mutai'), ('Rachael', 'Jepwambok'),
    ('Oscar', 'Tanui'), ('Naomi', 'Chepkwony'), ('Vincent', 'Kipsang'), ('Purity', 'Jepkesho'),
    ('Nicholas', 'Kiprono'), ('Lilian', 'Chepngeno'), ('Raymond', 'Kiplagat'), ('Dorcas', 'Jepchoge'),
    ('Henry', 'Kimeli'), ('Milka', 'Cheptarus'), ('Kelvin', 'Kiptanui'), ('Evelyn', 'Jepketer'),
    ('Stanley', 'Cheruiyot'), ('Jacqueline', 'Chepkirui'), ('Leonard', 'Kiprop'), ('Hellen', 'Jepkosgei'),
    ('Geoffrey', 'Kipsiele'), ('Consolata', 'Chepkesis'), ('Bernard', 'Kipkorir'), ('Teresa', 'Jepterek'),
    ('Douglas', 'Kimutai'), ('Monicah', 'Chepchai'), ('Alex', 'Kipkogei'), ('Anastasia', 'Jepsiele'),
    ('Ronald', 'Kipsoi'), ('Veronica', 'Chepkiror')
ON DUPLICATE KEY UPDATE used_count = used_count;

-- =====================================================
-- CREATE DEFAULT ADMIN USER
-- Password: admin123 (CHANGE THIS IMMEDIATELY!)
-- Hash is bcrypt with 12 rounds
-- =====================================================
INSERT INTO users (id, username, email, password_hash, is_admin, balance) VALUES
    ('admin-001', 'admin', 'admin@dossy.world', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4EdAoIpLjF7I9Fta', TRUE, 0)
ON DUPLICATE KEY UPDATE is_admin = TRUE;

-- =====================================================
-- USEFUL VIEWS
-- =====================================================

-- View for round statistics
CREATE OR REPLACE VIEW round_stats AS
SELECT 
    r.id,
    r.round_number,
    r.vault_target,
    r.profit_percentage,
    r.total_invested,
    r.final_fill_percent,
    r.status,
    r.investor_count,
    r.bot_investor_count,
    r.real_investor_count,
    r.total_payout,
    COUNT(DISTINCT CASE WHEN b.is_bot_buy = FALSE THEN b.id END) as real_investments,
    COUNT(DISTINCT CASE WHEN b.is_bot_buy = TRUE THEN b.id END) as bot_investments,
    SUM(CASE WHEN b.is_bot_buy = FALSE THEN b.amount ELSE 0 END) as real_amount,
    SUM(CASE WHEN b.is_paid = TRUE AND b.is_bot_buy = FALSE THEN b.payout_amount ELSE 0 END) as paid_to_users,
    r.created_at,
    r.started_at,
    r.erupted_at,
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
    COUNT(DISTINCT b.id) as total_investments,
    COALESCE(SUM(b.amount), 0) as total_invested,
    COALESCE(SUM(CASE WHEN b.is_paid = TRUE THEN b.payout_amount ELSE 0 END), 0) as total_payouts,
    COUNT(DISTINCT b.round_id) as rounds_participated,
    u.created_at
FROM users u
LEFT JOIN buys b ON u.id = b.user_id AND b.is_bot_buy = FALSE
WHERE u.is_bot = FALSE
GROUP BY u.id;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
