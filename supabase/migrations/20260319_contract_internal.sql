-- Migration: Add is_internal field to contracts table
-- Date: 2026-03-19

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
