-- Übernahme als Lead nur noch durch die Sperrliste blockiert.
-- Bisher verlangte der Trigger prospect_freigabe den Compliance-Status «allowed»;
-- dieser Prüfschritt entfällt in der App. Gesperrte Firmen (Sperrliste «Nicht
-- kontaktieren» bzw. früher als gesperrt markiert) bleiben weiterhin blockiert.
CREATE OR REPLACE FUNCTION private.prospect_freigabe() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('freigegeben', 'uebernommen')
     AND NEW.compliance_status LIKE 'blocked%' THEN
    RAISE EXCEPTION 'Übernahme nicht möglich: Die Firma ist gesperrt (%).', NEW.compliance_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
