CREATE TABLE IF NOT EXISTS "todos" (
  id SERIAL PRIMARY KEY,
  title text NOT NULL
);

INSERT INTO "todos" (title) VALUES ('first');
