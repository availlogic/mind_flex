-- MindFlex - Role-based access control
-- Source of truth: docs/Database.md §5 (Security & Isolation Configurations)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'common_svc') THEN
        CREATE ROLE common_svc LOGIN PASSWORD 'common_svc_pw';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'game_memory_matrix_svc') THEN
        CREATE ROLE game_memory_matrix_svc LOGIN PASSWORD 'game_memory_matrix_svc_pw';
    END IF;
END
$$;

-- Common service: full CRUD on schema_common only
GRANT USAGE ON SCHEMA schema_common TO common_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA schema_common TO common_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA schema_common TO common_svc;

-- Memory-matrix game service: full read/write on its own schema,
-- plus restricted read on schema_common (only the columns it needs).
-- Also needs USAGE on schema_common to call SECURE DEFINER procedures living there.
GRANT USAGE ON SCHEMA schema_memory_matrix TO game_memory_matrix_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA schema_memory_matrix TO game_memory_matrix_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA schema_memory_matrix TO game_memory_matrix_svc;

-- Schema_common: USAGE so the role can resolve function references;
-- column-level SELECT on user_profiles only (no UPDATE/DELETE direct grants).
GRANT USAGE ON SCHEMA schema_common TO game_memory_matrix_svc;
GRANT SELECT (anonymous_user_id, score_memory, score_focus, score_logic, score_speed, score_spatial, current_streak)
  ON schema_common.user_profiles TO game_memory_matrix_svc;
GRANT SELECT, INSERT ON schema_common.game_sessions TO game_memory_matrix_svc;


-- Common service also needs to read its own game sessions occasionally for restore flow,
-- but does NOT need to read granular clicks. No cross-schema grants for clicks.
