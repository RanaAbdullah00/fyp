-- Fleet columns + canonical status constraint (idempotent, no legacy enum values)
ALTER TABLE trucks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chassis_number text;

ALTER TABLE trucks DROP CONSTRAINT IF EXISTS trucks_status_check;

UPDATE trucks SET status = 'approved' WHERE lower(trim(status)) IN ('active', 'approved');
UPDATE trucks SET status = 'pending' WHERE lower(trim(status)) IN ('pending_verification', 'pending');
UPDATE trucks SET status = 'suspended' WHERE lower(trim(status)) = 'suspended';
UPDATE trucks SET status = 'pending'
WHERE status IS NULL OR lower(trim(status)) NOT IN ('pending', 'approved', 'suspended');

DO $$
BEGIN
  ALTER TABLE trucks
    ADD CONSTRAINT trucks_status_check
    CHECK (status IN ('pending', 'approved', 'suspended'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_trucks_user_status ON trucks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trucks_plate_lower ON trucks(lower(trim(license_plate)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_trucks_chassis ON trucks(chassis_number)
  WHERE chassis_number IS NOT NULL AND char_length(trim(chassis_number)) > 0;
