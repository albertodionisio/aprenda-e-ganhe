-- ===================================================================
-- SCHEMA COMPLETO — APRENDA E GANHE
-- Baseado no DOCUMENTO DE ESPECIFICAÇÃO DA PLATAFORMA (Etapas 1-20)
-- ===================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    country VARCHAR(100) DEFAULT 'Moçambique',
    language VARCHAR(10) DEFAULT 'pt',
    avatar_url VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    account_status VARCHAR(20) DEFAULT 'active',
    referred_by INT REFERENCES users(id) ON DELETE SET NULL,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(100),
    device_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance_available_mtn DECIMAL(12, 2) DEFAULT 0.00,
    balance_available_usd DECIMAL(12, 2) DEFAULT 0.00,
    balance_pending_mtn DECIMAL(12, 2) DEFAULT 0.00,
    balance_pending_usd DECIMAL(12, 2) DEFAULT 0.00,
    total_earned_mtn DECIMAL(12, 2) DEFAULT 0.00,
    total_earned_usd DECIMAL(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE CASCADE,
    question_type VARCHAR(30) DEFAULT 'multiple_choice',
    video_url VARCHAR(255),
    question_text TEXT NOT NULL,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_option CHAR(1) NOT NULL,
    explanation TEXT,
    reward_amount DECIMAL(10, 4) NOT NULL DEFAULT 0.05,
    xp_amount INT NOT NULL DEFAULT 5,
    difficulty_level INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guarda o momento em que cada pergunta foi realmente entregue ao usuário,
-- para o anti-fraude poder validar o tempo de resposta no servidor
-- (em vez de confiar no "startTime" que o próprio navegador envia).
CREATE TABLE quiz_issued (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id)
);

CREATE TABLE quiz_progress (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    selected_option CHAR(1),
    is_correct BOOLEAN NOT NULL,
    xp_received INT DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);

CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    xp_total INT DEFAULT 0,
    level INT DEFAULT 1,
    quizzes_completed INT DEFAULT 0,
    questions_answered INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATE
);

CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(20)
);

CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INT REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE TABLE missions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    goal_count INT NOT NULL DEFAULT 1,
    xp_reward INT DEFAULT 0,
    reset_period VARCHAR(20) DEFAULT 'daily'
);

CREATE TABLE user_missions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    mission_id INT REFERENCES missions(id) ON DELETE CASCADE,
    progress_count INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    period_key VARCHAR(20) NOT NULL,
    completed_at TIMESTAMP,
    CONSTRAINT unique_user_mission_period UNIQUE (user_id, mission_id, period_key)
);

CREATE TABLE rewards (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    payment_method VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    payment_details TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INT REFERENCES users(id) ON DELETE CASCADE,
    referred_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    bonus_percentage DECIMAL(5,2) DEFAULT 15.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE premium_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    duration_days INT NOT NULL,
    benefits TEXT
);

CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plan_id INT REFERENCES premium_plans(id),
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    payment_method VARCHAR(100)
);

CREATE TABLE ad_impressions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    network VARCHAR(50),
    placement VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT
);

CREATE INDEX idx_questions_category ON questions(category_id);
CREATE INDEX idx_quiz_progress_user ON quiz_progress(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
