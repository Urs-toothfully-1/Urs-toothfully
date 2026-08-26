-- An estimate line the patient was shown but is not charged for: several grades
-- of the same treatment quoted side by side, only one of which counts toward
-- the total. Defaults false, so every existing line keeps counting exactly as
-- it does today.
ALTER TABLE "EstimateItem" ADD COLUMN "isAlternative" BOOLEAN NOT NULL DEFAULT false;
