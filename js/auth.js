/**
 * AyosPH - Authentication Module
 * Handles user registration, login, logout, and session management
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.session = null;
        this.init();
    }

    async init() {
        // Check for existing session
        const { data: { session } } = await window.AyosPHConfig.supabase.auth.getSession();
        this.session = session;
        
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile();
        }

        // Listen for auth changes
        window.AyosPHConfig.supabase.auth.onAuthStateChange(async (event, session) => {
            this.handleAuthChange(event, session);
        });
    }

    async handleAuthChange(event, session) {
        this.session = session;
        
        switch (event) {
            case 'SIGNED_IN':
                this.currentUser = session.user;
                await this.loadUserProfile();
                this.onSignIn();
                break;
            case 'SIGNED_OUT':
                this.currentUser = null;
                this.session = null;
                this.onSignOut();
                break;
            case 'TOKEN_REFRESHED':
                this.currentUser = session.user;
                break;
            case 'USER_UPDATED':
                this.currentUser = session.user;
                await this.loadUserProfile();
                break;
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.USERS)
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            this.userProfile = data;
            return data;
        } catch (error) {
            console.error('Error loading user profile:', error);
            return null;
        }
    }

    async register({ fullName, email, password, barangay, contactNumber }) {
        try {
            const { data, error } = await window.AyosPHConfig.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        barangay: barangay,
                        contact_number: contactNumber,
                        role: 'resident'
                    }
                }
            });

            if (error) throw error;
            
            Utils.showToast('success', 'Registration Successful', 'Please check your email to verify your account.');
            return { success: true, data };
        } catch (error) {
            console.error('Registration error:', error);
            Utils.showToast('error', 'Registration Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    async login({ email, password }) {
        try {
            const { data, error } = await window.AyosPHConfig.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.session = data.session;
            this.currentUser = data.user;
            await this.loadUserProfile();

            Utils.showToast('success', 'Welcome Back!', `Hello, ${this.userProfile?.full_name || 'User'}`);
            return { success: true, data };
        } catch (error) {
            console.error('Login error:', error);
            Utils.showToast('error', 'Login Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            const { error } = await window.AyosPHConfig.supabase.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            this.session = null;
            this.userProfile = null;

            Utils.showToast('info', 'Logged Out', 'You have been successfully logged out.');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            Utils.showToast('error', 'Logout Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            const { error } = await window.AyosPHConfig.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login.html#reset-password`
            });

            if (error) throw error;

            Utils.showToast('success', 'Password Reset', 'Check your email for the reset link.');
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            Utils.showToast('error', 'Reset Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    async updateProfile(updates) {
        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            // Update auth metadata
            const { error: authError } = await window.AyosPHConfig.supabase.auth.updateUser({
                data: updates
            });

            if (authError) throw authError;

            // Update users table
            const { error: dbError } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.USERS)
                .update(updates)
                .eq('id', this.currentUser.id);

            if (dbError) throw dbError;

            await this.loadUserProfile();
            Utils.showToast('success', 'Profile Updated', 'Your profile has been updated successfully.');
            return { success: true };
        } catch (error) {
            console.error('Profile update error:', error);
            Utils.showToast('error', 'Update Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    onSignIn() {
        // Redirect based on role
        const role = this.userProfile?.role;
        if (role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    }

    onSignOut() {
        window.location.href = '/index.html';
    }

    isAuthenticated() {
        return !!this.session;
    }

    isAdmin() {
        return this.userProfile?.role === 'admin';
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserProfile() {
        return this.userProfile;
    }
}

// Initialize global auth manager
const Auth = new AuthManager();
window.Auth = Auth;

console.log('AyosPH Auth module initialized');
