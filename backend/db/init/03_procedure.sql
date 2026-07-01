-- MindFlex - SECURE DEFINER stored procedure for memory score updates
-- Source of truth: docs/Database.md §5.3
-- Purpose: prevent the game-role from directly modifying schema_common.user_profiles
--          while still allowing incremental updates bounded by [0, 1000].

CREATE OR REPLACE FUNCTION schema_common.update_memory_score(
    target_user_id UUID,
    new_game_score INTEGER,
    tz_offset_minutes INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    current_rating INTEGER;
    rating_increment INTEGER;
    calculated_rating INTEGER;

    today DATE;
    prev_streak INTEGER;
    prev_date DATE;
    delta_days INTEGER;
    new_streak INTEGER;
BEGIN
    SELECT score_memory, current_streak, daily_goal_date
    INTO current_rating, prev_streak, prev_date
    FROM schema_common.user_profiles
    WHERE anonymous_user_id = target_user_id;

    IF FOUND THEN
        rating_increment := (new_game_score - current_rating) / 10;
        calculated_rating := current_rating + rating_increment;

        IF calculated_rating > 1000 THEN
            calculated_rating := 1000;
        ELSIF calculated_rating < 0 THEN
            calculated_rating := 0;
        END IF;

        today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + (INTERVAL '1 minute' * tz_offset_minutes))::date;

        IF prev_date IS NULL THEN
            new_streak := 1;
        ELSIF prev_date = today THEN
            new_streak := GREATEST(1, prev_streak);
        ELSE
            delta_days := today - prev_date;
            IF delta_days = 1 THEN
                new_streak := prev_streak + 1;
            ELSE
                new_streak := 1;
            END IF;
        END IF;

        UPDATE schema_common.user_profiles
        SET score_memory = calculated_rating,
            current_streak = new_streak,
            daily_games_played = CASE
                WHEN daily_goal_date = today THEN daily_games_played + 1
                ELSE 1
            END,
            daily_goal_date = today,
            last_active_at = CURRENT_TIMESTAMP
        WHERE anonymous_user_id = target_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow the game service to invoke (but not own) this procedure.
GRANT EXECUTE ON FUNCTION schema_common.update_memory_score(UUID, INTEGER) TO game_memory_matrix_svc;

CREATE OR REPLACE FUNCTION schema_common.update_user_score(
    target_user_id UUID,
    game_category VARCHAR(64),
    new_game_score INTEGER,
    tz_offset_minutes INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    current_rating INTEGER;
    rating_increment INTEGER;
    calculated_rating INTEGER;

    today DATE;
    prev_streak INTEGER;
    prev_date DATE;
    delta_days INTEGER;
    new_streak INTEGER;
BEGIN
    -- Read current rating based on category
    IF game_category = 'memory' THEN
        SELECT score_memory, current_streak, daily_goal_date
        INTO current_rating, prev_streak, prev_date
        FROM schema_common.user_profiles
        WHERE anonymous_user_id = target_user_id;
    ELSIF game_category = 'focus' THEN
        SELECT score_focus, current_streak, daily_goal_date
        INTO current_rating, prev_streak, prev_date
        FROM schema_common.user_profiles
        WHERE anonymous_user_id = target_user_id;
    ELSIF game_category = 'logic' THEN
        SELECT score_logic, current_streak, daily_goal_date
        INTO current_rating, prev_streak, prev_date
        FROM schema_common.user_profiles
        WHERE anonymous_user_id = target_user_id;
    ELSIF game_category = 'speed' THEN
        SELECT score_speed, current_streak, daily_goal_date
        INTO current_rating, prev_streak, prev_date
        FROM schema_common.user_profiles
        WHERE anonymous_user_id = target_user_id;
    ELSIF game_category = 'spatial' THEN
        SELECT score_spatial, current_streak, daily_goal_date
        INTO current_rating, prev_streak, prev_date
        FROM schema_common.user_profiles
        WHERE anonymous_user_id = target_user_id;
    ELSE
        RETURN;
    END IF;

    IF FOUND THEN
        rating_increment := (new_game_score - current_rating) / 10;
        calculated_rating := current_rating + rating_increment;

        IF calculated_rating > 1000 THEN
            calculated_rating := 1000;
        ELSIF calculated_rating < 0 THEN
            calculated_rating := 0;
        END IF;

        today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + (INTERVAL '1 minute' * tz_offset_minutes))::date;

        IF prev_date IS NULL THEN
            new_streak := 1;
        ELSIF prev_date = today THEN
            new_streak := GREATEST(1, prev_streak);
        ELSE
            delta_days := today - prev_date;
            IF delta_days = 1 THEN
                new_streak := prev_streak + 1;
            ELSE
                new_streak := 1;
            END IF;
        END IF;

        IF game_category = 'memory' THEN
            UPDATE schema_common.user_profiles
            SET score_memory = calculated_rating,
                current_streak = new_streak,
                daily_games_played = CASE
                    WHEN daily_goal_date = today THEN daily_games_played + 1
                    ELSE 1
                END,
                daily_goal_date = today,
                last_active_at = CURRENT_TIMESTAMP
            WHERE anonymous_user_id = target_user_id;
        ELSIF game_category = 'focus' THEN
            UPDATE schema_common.user_profiles
            SET score_focus = calculated_rating,
                current_streak = new_streak,
                daily_games_played = CASE
                    WHEN daily_goal_date = today THEN daily_games_played + 1
                    ELSE 1
                END,
                daily_goal_date = today,
                last_active_at = CURRENT_TIMESTAMP
            WHERE anonymous_user_id = target_user_id;
        ELSIF game_category = 'logic' THEN
            UPDATE schema_common.user_profiles
            SET score_logic = calculated_rating,
                current_streak = new_streak,
                daily_games_played = CASE
                    WHEN daily_goal_date = today THEN daily_games_played + 1
                    ELSE 1
                END,
                daily_goal_date = today,
                last_active_at = CURRENT_TIMESTAMP
            WHERE anonymous_user_id = target_user_id;
        ELSIF game_category = 'speed' THEN
            UPDATE schema_common.user_profiles
            SET score_speed = calculated_rating,
                current_streak = new_streak,
                daily_games_played = CASE
                    WHEN daily_goal_date = today THEN daily_games_played + 1
                    ELSE 1
                END,
                daily_goal_date = today,
                last_active_at = CURRENT_TIMESTAMP
            WHERE anonymous_user_id = target_user_id;
        ELSIF game_category = 'spatial' THEN
            UPDATE schema_common.user_profiles
            SET score_spatial = calculated_rating,
                current_streak = new_streak,
                daily_games_played = CASE
                    WHEN daily_goal_date = today THEN daily_games_played + 1
                    ELSE 1
                END,
                daily_goal_date = today,
                last_active_at = CURRENT_TIMESTAMP
            WHERE anonymous_user_id = target_user_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION schema_common.update_user_score(UUID, VARCHAR, INTEGER, INTEGER) TO game_memory_matrix_svc;

