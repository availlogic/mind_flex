-- MindFlex - SECURE DEFINER stored procedure for memory score updates
-- Source of truth: docs/Database.md §5.3
-- Purpose: prevent the game-role from directly modifying schema_common.user_profiles
--          while still allowing incremental updates bounded by [0, 1000].

CREATE OR REPLACE FUNCTION schema_common.update_memory_score(
    target_user_id UUID,
    new_game_score INTEGER
) RETURNS VOID AS $$
DECLARE
    current_rating INTEGER;
    rating_increment INTEGER;
    calculated_rating INTEGER;
BEGIN
    SELECT score_memory INTO current_rating
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

        UPDATE schema_common.user_profiles
        SET score_memory = calculated_rating,
            last_active_at = CURRENT_TIMESTAMP
        WHERE anonymous_user_id = target_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow the game service to invoke (but not own) this procedure.
GRANT EXECUTE ON FUNCTION schema_common.update_memory_score(UUID, INTEGER) TO game_memory_matrix_svc;
