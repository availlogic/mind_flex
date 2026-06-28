-- MindFlex - Schema initialization
-- Source of truth: docs/Database.md
-- Resolution of AUD-01 (Test-Strategy.md): added daily_games_played + daily_goal

CREATE SCHEMA IF NOT EXISTS schema_common;
CREATE SCHEMA IF NOT EXISTS schema_memory_matrix;

CREATE TABLE schema_common.user_profiles (
    anonymous_user_id UUID PRIMARY KEY,
    recovery_token VARCHAR(64) UNIQUE NOT NULL,
    score_memory INTEGER DEFAULT 0 NOT NULL CHECK (score_memory BETWEEN 0 AND 1000),
    score_focus INTEGER DEFAULT 0 NOT NULL CHECK (score_focus BETWEEN 0 AND 1000),
    score_logic INTEGER DEFAULT 0 NOT NULL CHECK (score_logic BETWEEN 0 AND 1000),
    score_speed INTEGER DEFAULT 0 NOT NULL CHECK (score_speed BETWEEN 0 AND 1000),
    score_spatial INTEGER DEFAULT 0 NOT NULL CHECK (score_spatial BETWEEN 0 AND 1000),
    current_streak INTEGER DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
    daily_games_played INTEGER DEFAULT 0 NOT NULL CHECK (daily_games_played >= 0),
    daily_goal INTEGER DEFAULT 3 NOT NULL CHECK (daily_goal >= 0),
    daily_goal_date DATE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE schema_common.user_badges (
    badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL REFERENCES schema_common.user_profiles(anonymous_user_id) ON DELETE CASCADE,
    badge_type VARCHAR(64) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_badge UNIQUE (anonymous_user_id, badge_type)
);

CREATE TABLE schema_memory_matrix.game_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL REFERENCES schema_common.user_profiles(anonymous_user_id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0),
    accuracy NUMERIC(5, 2) NOT NULL CHECK (accuracy BETWEEN 0.00 AND 100.00),
    avg_response_time_ms INTEGER NOT NULL CHECK (avg_response_time_ms >= 0),
    rounds_completed INTEGER NOT NULL CHECK (rounds_completed >= 0),
    client_tx_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE schema_memory_matrix.game_clicks (
    click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES schema_memory_matrix.game_sessions(session_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number >= 1),
    click_sequence INTEGER NOT NULL CHECK (click_sequence >= 1),
    is_correct BOOLEAN NOT NULL,
    latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0)
);

CREATE INDEX idx_profiles_recovery_token ON schema_common.user_profiles(recovery_token);
CREATE INDEX idx_profiles_last_active ON schema_common.user_profiles(last_active_at DESC);
CREATE INDEX idx_badges_user_id ON schema_common.user_badges(anonymous_user_id);
CREATE INDEX idx_matrix_sessions_user_id ON schema_memory_matrix.game_sessions(anonymous_user_id);
CREATE INDEX idx_matrix_sessions_tx_id ON schema_memory_matrix.game_sessions(client_tx_id);
CREATE INDEX idx_matrix_clicks_session_id ON schema_memory_matrix.game_clicks(session_id);
