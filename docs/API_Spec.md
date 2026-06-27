# API Specification: MindFlex

## 1. Overview
All API requests are routed through Cloudflare Tunnel to the internal Nginx gateway on the domestic server.
*   **Base URL**: `https://maxithome.com/api/v1`
*   **Protocol**: HTTPS
*   **Content-Type**: `application/json`

---

## 2. Endpoint Specifications

### 2.1 Initialize Anonymous Profile
Creates a new database record for a newly generated UUID.

*   **Endpoint**: `POST /profiles`
*   **Request Headers**:
    *   `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }
    ```
*   **Response**:
    *   **Status**: `201 Created`
    *   **Body**:
        ```json
        {
          "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "recovery_token": "crimson-tiger-autumn-breeze",
          "scores": {
            "memory": 0,
            "focus": 0,
            "logic": 0,
            "speed": 0,
            "spatial": 0
          },
          "current_streak": 0,
          "last_active_at": null,
          "created_at": "2026-06-27T05:00:00Z"
        }
        ```
    *   **Status**: `400 Bad Request` (Invalid UUID format)
    *   **Status**: `409 Conflict` (UUID already registered)

---

### 2.2 Fetch Profile Details
Retrieves current scores, streaks, active logs, and badges for a profile.

*   **Endpoint**: `GET /profiles/{anonymous_user_id}`
*   **Response**:
    *   **Status**: `200 OK`
    *   **Body**:
        ```json
        {
          "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "recovery_token": "crimson-tiger-autumn-breeze",
          "scores": {
            "memory": 680,
            "focus": 790,
            "logic": 0,
            "speed": 550,
            "spatial": 450
          },
          "current_streak": 3,
          "badges": [
            {
              "badge_id": "e0a12b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
              "badge_type": "MEM_MASTER_1",
              "unlocked_at": "2026-06-25T14:32:00Z"
            }
          ],
          "last_active_at": "2026-06-26T18:22:15Z",
          "created_at": "2026-06-23T09:12:00Z"
        }
        ```
    *   **Status**: `404 Not Found` (Profile not found)

---

### 2.3 Submit Game Session Results
Submits metrics and click lists for scoring calculations and writes data to database partition schemas.

*   **Endpoint**: `POST /games/{game_name}/submit`
*   **URL Parameters**:
    *   `game_name`: e.g. `flashmatrix`
*   **Request Body**:
    ```json
    {
      "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "score": 850,
      "accuracy": 0.94,
      "responseTimeMs": 312,
      "roundsCompleted": 8,
      "rawMetrics": {
        "clicks": [
          {
            "roundNumber": 1,
            "clickSequence": 1,
            "isCorrect": true,
            "latencyMs": 140
          },
          {
            "roundNumber": 1,
            "clickSequence": 2,
            "isCorrect": true,
            "latencyMs": 220
          }
        ]
      }
    }
    ```
*   **Response**:
    *   **Status**: `200 OK`
    *   **Body**:
        ```json
        {
          "status": "success",
          "updatedScores": {
            "memory": 720,
            "focus": 790,
            "logic": 0,
            "speed": 550,
            "spatial": 450
          },
          "newBadgeUnlocked": true,
          "unlockedBadges": [
            {
              "badge_type": "MEM_SPEED_DEMON",
              "unlocked_at": "2026-06-27T05:08:12Z"
            }
          ],
          "current_streak": 4
        }
        ```
    *   **Status**: `400 Bad Request` (Invalid payload or score boundaries out-of-limits)
    *   **Status**: `404 Not Found` (Profile or Game Name not registered)

---

### 2.4 Restore Profile
Restores a local anonymous session UUID using a recovery mnemonic token.

*   **Endpoint**: `POST /profiles/restore`
*   **Request Body**:
    ```json
    {
      "recovery_token": "crimson-tiger-autumn-breeze"
    }
    ```
*   **Response**:
    *   **Status**: `200 OK`
    *   **Body**:
        ```json
        {
          "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "scores": {
            "memory": 680,
            "focus": 790,
            "logic": 0,
            "speed": 550,
            "spatial": 450
          },
          "current_streak": 3,
          "last_active_at": "2026-06-26T18:22:15Z"
        }
        ```
    *   **Status**: `400 Bad Request` (Missing recovery token parameter)
    *   **Status**: `404 Not Found` (Invalid recovery token)

---

### 2.5 Delete User Profile
Hard-deletes all database data relating to the profile UUID.

*   **Endpoint**: `DELETE /profiles/{anonymous_user_id}`
*   **Response**:
    *   **Status**: `204 No Content`
    *   **Status**: `404 Not Found` (Profile not found)

---

## 3. Error Handling

When an error occurs, the API returns a consistent error payload with appropriate HTTP status codes:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested anonymous profile could not be located.",
    "details": {
      "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }
  }
}
```

### Standard Error Codes:
*   `INVALID_PARAMETER`: Request data violates schemas or validations.
*   `RESOURCE_NOT_FOUND`: Target profile, game endpoint, or schema cannot be found.
*   `OUT_OF_BOUNDS_SCORE`: Submitted score metrics exceed human physical limits (anti-cheat trigger).
*   `DATABASE_CONFLICT`: Primary key duplicate or constraint failure.
*   `INTERNAL_SERVER_ERROR`: Server execution exception.
