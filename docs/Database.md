# Database Specification: MindFlex

## 1. Database Architecture
MindFlex uses a single **PostgreSQL** instance with namespace-based schema isolation.
*   **`schema_common`**: Contains global user records, composite cognitive dimensions, unlocked badges, and active session streaks.
*   **`schema_memory_matrix`**: Contains the granular gameplay telemetry (session data, response logs, grid coordinate click lists) for the *Flash Matrix* memory game.

```
                      +-----------------------------+
                      |       Postgres DB           |
                      +--------------┬--------------+
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
+──────────────────────+                            +──────────────────────+
|    schema_common     |                            | schema_memory_matrix |
|                      |                            |                      |
|  - user_profiles     |                            |  - game_sessions     |
|  - user_badges       |                            |  - game_clicks       |
+──────────────────────+                            +──────────────────────+
```

---

## 2. Schema: `schema_common`

### 2.1 Table: `user_profiles`
Stores the anonymous profiles, calculated ratings, streaks, and recovery codes.

```sql
CREATE TABLE schema_common.user_profiles (
    anonymous_user_id UUID PRIMARY KEY,
    recovery_token VARCHAR(64) UNIQUE NOT NULL,
    score_memory INTEGER DEFAULT 0 NOT NULL CHECK (score_memory BETWEEN 0 AND 1000),
    score_focus INTEGER DEFAULT 0 NOT NULL CHECK (score_focus BETWEEN 0 AND 1000),
    score_logic INTEGER DEFAULT 0 NOT NULL CHECK (score_logic BETWEEN 0 AND 1000),
    score_speed INTEGER DEFAULT 0 NOT NULL CHECK (score_speed BETWEEN 0 AND 1000),
    score_spatial INTEGER DEFAULT 0 NOT NULL CHECK (score_spatial BETWEEN 0 AND 1000),
    current_streak INTEGER DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 2.2 Table: `user_badges`
Stores records of achievements unlocked by profiles.

```sql
CREATE TABLE schema_common.user_badges (
    badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL REFERENCES schema_common.user_profiles(anonymous_user_id) ON DELETE CASCADE,
    badge_type VARCHAR(64) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_badge UNIQUE (anonymous_user_id, badge_type)
);
```

---

## 3. Schema: `schema_memory_matrix`

### 3.1 Table: `game_sessions`
Stores summaries of sessions for the Flash Matrix game.

```sql
CREATE TABLE schema_memory_matrix.game_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL REFERENCES schema_common.user_profiles(anonymous_user_id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0),
    accuracy NUMERIC(5, 2) NOT NULL CHECK (accuracy BETWEEN 0.00 AND 100.00),
    avg_response_time_ms INTEGER NOT NULL CHECK (avg_response_time_ms >= 0),
    rounds_completed INTEGER NOT NULL CHECK (rounds_completed >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 3.2 Table: `game_clicks`
Stores detailed user click tracking data for research and anti-cheat validation.

```sql
CREATE TABLE schema_memory_matrix.game_clicks (
    click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES schema_memory_matrix.game_sessions(session_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number >= 1),
    click_sequence INTEGER NOT NULL CHECK (click_sequence >= 1),
    is_correct BOOLEAN NOT NULL,
    latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0)
);
```

---

## 4. Indexing Strategy
To optimize queries across high-volume game lists and coordinate lookup tables, the following indices are configured:

```sql
-- Common Schema Indices
CREATE INDEX idx_profiles_recovery_token ON schema_common.user_profiles(recovery_token);
CREATE INDEX idx_profiles_last_active ON schema_common.user_profiles(last_active_at DESC);
CREATE INDEX idx_badges_user_id ON schema_common.user_badges(anonymous_user_id);

-- Memory Game Schema Indices
CREATE INDEX idx_matrix_sessions_user_id ON schema_memory_matrix.game_sessions(anonymous_user_id);
CREATE INDEX idx_matrix_clicks_session_id ON schema_memory_matrix.game_clicks(session_id);
```

---

## 5. Security & Isolation Configurations

To enforce least-privilege security, microservice connections operate using distinct roles.

### 5.1 Common Service Privileges (`common_svc`)
The global user dashboard microservice connects using the `common_svc` credentials:
```sql
GRANT USAGE ON SCHEMA schema_common TO common_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA schema_common TO common_svc;
```

### 5.2 Game Service Privileges (`game_memory_matrix_svc`)
The telemetry recording microservice connects using the `game_memory_matrix_svc` credentials. It cannot perform raw updates or edits on user scores directly; instead, it triggers scoring changes through a database function:
```sql
-- Grant access to its own schema
GRANT USAGE ON SCHEMA schema_memory_matrix TO game_memory_matrix_svc;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA schema_memory_matrix TO game_memory_matrix_svc;

-- Grant limited read access on profile table
GRANT SELECT (anonymous_user_id, score_memory) ON schema_common.user_profiles TO game_memory_matrix_svc;
```

### 5.3 Secure Stored Procedure for Score Increments
To prevent telemetry services from writing arbitrary data to `schema_common.user_profiles`, a Postgres security definer function updates the category score:

```sql
CREATE OR REPLACE FUNCTION schema_common.update_memory_score(
    target_user_id UUID,
    new_game_score INTEGER
) RETURNS VOID AS $$
DECLARE
    current_rating INTEGER;
    rating_increment INTEGER;
    calculated_rating INTEGER;
BEGIN
    -- Retrieve the profile memory rating
    SELECT score_memory INTO current_rating
    FROM schema_common.user_profiles
    WHERE anonymous_user_id = target_user_id;

    IF FOUND THEN
        -- Perform Elo-style delta computation or simple rolling average
        -- Simple calculation for MVP: rating increment is 10% of game score above current rating
        rating_increment := (new_game_score - current_rating) / 10;
        calculated_rating := current_rating + rating_increment;

        -- Constrain calculations between 0 and 1000
        IF calculated_rating > 1000 THEN
            calculated_rating := 1000;
        ELSIF calculated_rating < 0 THEN
            calculated_rating := 0;
        END IF;

        -- Update the user profile
        UPDATE schema_common.user_profiles
        SET score_memory = calculated_rating,
            last_active_at = CURRENT_TIMESTAMP
        WHERE anonymous_user_id = target_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

*   `SECURITY DEFINER`: The function executes using the privileges of the user that created it (the database owner), allowing the `game_memory_matrix_svc` role to update the user rating without holding broad UPDATE permissions on `schema_common.user_profiles`.
