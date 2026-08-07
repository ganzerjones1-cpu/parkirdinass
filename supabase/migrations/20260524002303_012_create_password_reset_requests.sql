/*
  # Create Password Reset Requests Table

  1. New Tables
    - `password_reset_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `reset_token` (text, unique)
      - `status` (enum: pending, approved, rejected, expired)
      - `requested_at` (timestamptz)
      - `approved_at` (timestamptz, nullable)
      - `approved_by` (uuid, foreign key to users - super admin)
      - `rejection_reason` (text, nullable)
      - `expires_at` (timestamptz)

  2. Security
    - Enable RLS on password_reset_requests table
    - Add policy for users to view their own requests
    - Add policy for super admin to approve/reject requests
*/

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reset_token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  rejection_reason text,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own reset requests
CREATE POLICY "Users can view own reset requests"
  ON password_reset_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin');

-- Super admin can view all reset requests
CREATE POLICY "Super admin can manage all reset requests"
  ON password_reset_requests FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'super_admin');

-- Users can insert their own reset requests
CREATE POLICY "Users can create own reset requests"
  ON password_reset_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_reset_token ON password_reset_requests(reset_token);
