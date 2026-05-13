-- ==================================================
-- AyosPH Database Schema
-- Supabase PostgreSQL Setup
-- ==================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================
-- TABLE: users
-- ==================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    barangay TEXT,
    contact_number TEXT,
    role TEXT DEFAULT 'resident' CHECK (role IN ('resident', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_barangay ON public.users(barangay);

-- ==================================================
-- TABLE: reports
-- ==================================================
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Emergency')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'In Progress', 'Fixed', 'Rejected')),
    image_before TEXT,
    image_after TEXT,
    location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    remarks TEXT,
    reported_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fixed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for reports
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_category ON public.reports(category);
CREATE INDEX idx_reports_severity ON public.reports(severity);
CREATE INDEX idx_reports_reported_by ON public.reports(reported_by);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_assigned_to ON public.reports(assigned_to);

-- ==================================================
-- TABLE: comments
-- ==================================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_comments_report_id ON public.comments(report_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at);

-- ==================================================
-- TABLE: notifications
-- ==================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- ==================================================
-- ROW LEVEL SECURITY (RLS)
-- ==================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- USERS POLICIES
-- ==================================================

-- Users can view their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ==================================================
-- REPORTS POLICIES
-- ==================================================

-- Anyone authenticated can create reports
CREATE POLICY "Authenticated users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.reports
    FOR SELECT USING (
        reported_by = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Users can update their own reports (before admin takes action)
CREATE POLICY "Users can update own reports" ON public.reports
    FOR UPDATE USING (reported_by = auth.uid());

-- Admins can update any report
CREATE POLICY "Admins can update any report" ON public.reports
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Admins can delete reports
CREATE POLICY "Admins can delete reports" ON public.reports
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ==================================================
-- COMMENTS POLICIES
-- ==================================================

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can view comments on their reports or any report if admin
CREATE POLICY "Users can view comments" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reports 
            WHERE reports.id = comments.report_id 
            AND (reports.reported_by = auth.uid() OR 
                 EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
        )
    );

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (user_id = auth.uid());

-- ==================================================
-- NOTIFICATIONS POLICIES
-- ==================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

-- System can insert notifications (via triggers or backend)
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (user_id = auth.uid());

-- ==================================================
-- FUNCTIONS & TRIGGERS
-- ==================================================

-- Function to automatically create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, barangay, contact_number, role)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        NEW.raw_user_meta_data->>'barangay',
        NEW.raw_user_meta_data->>'contact_number',
        COALESCE(NEW.raw_user_meta_data->>'role', 'resident')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to set fixed_at when status changes to Fixed
CREATE OR REPLACE FUNCTION public.set_fixed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Fixed' AND OLD.status != 'Fixed' THEN
        NEW.fixed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reports_fixed_at BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.set_fixed_at();

-- ==================================================
-- STORAGE BUCKETS SETUP
-- ==================================================

-- Note: Run these in Supabase Dashboard Storage section or via API
-- Create bucket: report-images (public)
-- Create bucket: user-avatars (public)

-- Storage policies for report-images bucket
-- (These need to be set in Supabase Dashboard)
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true);

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload report images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'report-images' AND auth.role() = 'authenticated');

-- Allow public to view images
CREATE POLICY "Public can view report images" ON storage.objects
    FOR SELECT USING (bucket_id = 'report-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images" ON storage.objects
    FOR DELETE USING (bucket_id = 'report-images' AND owner = auth.uid());
*/

-- ==================================================
-- SEED DATA (Optional - for testing)
-- ==================================================

-- Insert a test admin user (update with actual UUID after manual signup)
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@example.com';

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
-- SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public';
