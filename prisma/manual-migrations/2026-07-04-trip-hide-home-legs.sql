-- Route home-leg opt-outs (see Trip model comment). Run in Supabase SQL editor.
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "hideHomeDeparture" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hideHomeReturn" BOOLEAN NOT NULL DEFAULT false;
