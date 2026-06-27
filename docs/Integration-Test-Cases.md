# Integration Test Cases: MindFlex

## 1. Boundary: API ↔ Frontend Contracts

### IT-AFC-01: Profile Registration Contract Validation
*   **Target Endpoint**: `POST /profiles`
*   **System Path**: Host Frontend ──► Nginx ──► `profile-service`
*   **Scenario**:
    1. Send a registration payload with missing fields: `{"anonymous_user_id": ""}`.
    2. Send a registration payload with incorrect JSON structure.
*   **Verification**:
    *   API Gateway intercept returns `400 Bad Request`.
    *   API output matches the standardized JSON error structure (includes code `INVALID_PARAMETER`).
*   **Failure Handling**: Verify the host client parses the error code and defaults to a local fallback profile, alerting the user to "Run in Offline Mode."

---

### IT-AFC-02: Game Submission Payload Integrity
*   **Target Endpoint**: `POST /games/{game_name}/submit`
*   **System Path**: Frontend ──► Nginx ──► `game-telemetry-service`
*   **Scenario**:
    1. Submit a game session containing an unregistered game endpoint (e.g. `POST /games/nonexistentgame/submit`).
    2. Submit a game session with values exceeding anti-cheat parameters (e.g., response latency of `5ms` or accuracy of `150.00%`).
*   **Verification**:
    *   *Unregistered Game*: Returns `404 Not Found` with code `RESOURCE_NOT_FOUND`.
    *   *Out of Bounds*: Returns `400 Bad Request` with code `OUT_OF_BOUNDS_SCORE`.
    *   No records are written to the database.

---

## 2. Boundary: API ↔ Database Integrity

### IT-ADB-01: Database Transaction Rollback on Telemetry Inserts
*   **Target Service**: `game-telemetry-service`
*   **Database Schema**: `schema_memory_matrix`
*   **Scenario**:
    1. Initiate a session submission. Write a valid entry to `schema_memory_matrix.game_sessions`.
    2. Inject an invalid parameter (e.g. null value) into the `game_clicks` list to trigger a DB constraint failure during bulk insert.
*   **Verification**:
    *   Verify the Postgres transaction block triggers a rollback.
    *   Inspect `schema_memory_matrix.game_sessions` to ensure the session record was rolled back and is not orphan-persisted.
    *   API returns `500 Internal Server Error` (or `400 Bad Request` depending on constraint error catching).

---

### IT-ADB-02: Score Calculation Isolation (Stored Procedure Rules)
*   **Target Service**: DB Stored Procedure `update_memory_score`
*   **Database Schema**: `schema_common`, `schema_memory_matrix`
*   **Scenario**:
    1. Insert a game session record into `schema_memory_matrix.game_sessions` using the restricted credentials `game_memory_matrix_svc`.
    2. Directly execute a SQL update statement: `UPDATE schema_common.user_profiles SET score_memory = 1000 WHERE anonymous_user_id = UUID` using the same `game_memory_matrix_svc` credentials.
    3. Execute the stored procedure: `SELECT schema_common.update_memory_score(UUID, 850)`.
*   **Verification**:
    *   *Direct Update*: Fails with Postgres error `Permission Denied` (role lacks direct UPDATE grants).
    *   *Stored Procedure*: Succeeds. Global profile score is updated according to the math bounds, updating `last_active_at` timestamp.
*   **Resilience**: Validates that score updates are isolated and secure against direct manipulation by compromised microservice credentials.

---

## 3. Boundary: Network Resilience & Failures

### IT-NRF-01: Cloudflare Tunnel Connection Drop Resilience
*   **Target Service**: Cloudflare Tunnel connection to domestic Ubuntu Server
*   **Scenario**:
    1. During active play, simulate a WAN connection drop (disconnect tunnel client container).
    2. Attempt to submit score telemetry from the frontend.
*   **Verification**:
    *   Host dashboard detect network error.
    *   The client script catches the network rejection, saves the payload to `LocalStorage.getItem('mindflex_pending_scores')`, and displays the updated scores in the UI.
    *   Reconnect WAN. Verify on the next site reload that the pending payload is uploaded and successfully updated in the DB.
