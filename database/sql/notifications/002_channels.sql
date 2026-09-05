-- notifications/002_channels.sql
-- Canal SMS para 2FA/OTP (MessagingProvider) además de EMAIL/PUSH.

BEGIN;

DO $$ BEGIN
    ALTER TYPE delivery_channel ADD VALUE IF NOT EXISTS 'SMS';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- phone_number persistido para envío de OTP por SMS
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

COMMIT;