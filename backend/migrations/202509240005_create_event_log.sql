-- Create event_log table for persisted Envelope events (P1 Observability)
CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  emitted_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_emitted_at ON event_log(emitted_at);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
