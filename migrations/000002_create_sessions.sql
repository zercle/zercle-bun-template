-- Up
CREATE TABLE IF NOT EXISTS sessions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);

-- Down
DROP TABLE IF EXISTS sessions;
