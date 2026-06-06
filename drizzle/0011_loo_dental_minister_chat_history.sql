CREATE TABLE IF NOT EXISTS "loo_dental_minister_chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(120) DEFAULT '新对话' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loo_dental_minister_chat_sessions_user_updated_idx"
  ON "loo_dental_minister_chat_sessions" USING btree ("user_id", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loo_dental_minister_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loo_dental_minister_chat_messages_session_created_idx"
  ON "loo_dental_minister_chat_messages" USING btree ("session_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loo_dental_minister_chat_messages_user_created_idx"
  ON "loo_dental_minister_chat_messages" USING btree ("user_id", "created_at");
