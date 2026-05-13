/**
 * AyosPH - Reports Module
 * Handles report creation, fetching, updating, and management
 */

class ReportsManager {
    constructor() {
        this.reports = [];
        this.categories = ['Roads', 'Garbage', 'Drainage', 'Flooding', 'Street Lights', 'Public Safety', 'Infrastructure', 'Others'];
        this.severities = ['Low', 'Medium', 'High', 'Emergency'];
        this.statuses = ['Pending', 'Under Review', 'In Progress', 'Fixed', 'Rejected'];
    }

    /**
     * Create a new report
     */
    async createReport(reportData) {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('You must be logged in to create a report');
            }

            // Upload image if provided
            let imageUrl = null;
            if (reportData.image) {
                imageUrl = await this.uploadImage(reportData.image, currentUser.id);
            }

            const report = {
                title: reportData.title,
                description: reportData.description,
                category: reportData.category,
                severity: reportData.severity,
                location: reportData.location,
                latitude: reportData.latitude,
                longitude: reportData.longitude,
                image_before: imageUrl,
                reported_by: currentUser.id
            };

            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .insert([report])
                .select()
                .single();

            if (error) throw error;

            // Create notification for admins
            await this.notifyAdmins(data);

            Utils.showToast('success', 'Report Submitted', 'Your report has been submitted successfully.');
            return { success: true, data };
        } catch (error) {
            console.error('Create report error:', error);
            Utils.showToast('error', 'Submission Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload image to Supabase Storage
     */
    async uploadImage(file, userId) {
        try {
            // Compress image first
            const compressedFile = await Utils.compressImage(file);
            
            const fileName = `${userId}/${Date.now()}-${file.name}`;
            
            const { data, error } = await window.AyosPHConfig.supabase.storage
                .from(window.AyosPHConfig.STORAGE_BUCKETS.REPORT_IMAGES)
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = window.AyosPHConfig.supabase.storage
                .from(window.AyosPHConfig.STORAGE_BUCKETS.REPORT_IMAGES)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Image upload error:', error);
            throw new Error('Failed to upload image');
        }
    }

    /**
     * Fetch reports with filters
     */
    async fetchReports(filters = {}) {
        try {
            let query = window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .select(`
                    *,
                    users!reported_by(full_name, email),
                    comments(count)
                `)
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.category) {
                query = query.eq('category', filters.category);
            }
            if (filters.severity) {
                query = query.eq('severity', filters.severity);
            }
            if (filters.reportedBy) {
                query = query.eq('reported_by', filters.reportedBy);
            }
            if (filters.search) {
                query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            this.reports = data || [];
            return { success: true, data: this.reports };
        } catch (error) {
            console.error('Fetch reports error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get single report by ID
     */
    async getReportById(id) {
        try {
            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .select(`
                    *,
                    users!reported_by(full_name, email, avatar_url),
                    users!assigned_to(full_name, email),
                    comments(users(full_name, avatar_url))
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get report error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update report status
     */
    async updateReportStatus(id, status, remarks = null, imageAfter = null) {
        try {
            const updateData = { status };
            
            if (remarks) {
                updateData.remarks = remarks;
            }

            if (imageAfter && status === 'Fixed') {
                const currentUser = Auth.getCurrentUser();
                const imageUrl = await this.uploadImage(imageAfter, currentUser.id);
                updateData.image_after = imageUrl;
            }

            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Notify reporter
            await this.notifyReporter(data);

            Utils.showToast('success', 'Status Updated', 'Report status has been updated.');
            return { success: true, data };
        } catch (error) {
            console.error('Update status error:', error);
            Utils.showToast('error', 'Update Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add comment to report
     */
    async addComment(reportId, message) {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('You must be logged in to comment');
            }

            const comment = {
                report_id: reportId,
                user_id: currentUser.id,
                message: message.trim()
            };

            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.COMMENTS)
                .insert([comment])
                .select('*, users(full_name, avatar_url)')
                .single();

            if (error) throw error;

            Utils.showToast('success', 'Comment Added', 'Your comment has been posted.');
            return { success: true, data };
        } catch (error) {
            console.error('Add comment error:', error);
            Utils.showToast('error', 'Comment Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get comments for a report
     */
    async getComments(reportId) {
        try {
            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.COMMENTS)
                .select('*, users(full_name, avatar_url)')
                .eq('report_id', reportId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get comments error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete report (admin only)
     */
    async deleteReport(id) {
        try {
            const { error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .delete()
                .eq('id', id);

            if (error) throw error;

            Utils.showToast('success', 'Report Deleted', 'The report has been deleted.');
            return { success: true };
        } catch (error) {
            console.error('Delete report error:', error);
            Utils.showToast('error', 'Delete Failed', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get reports statistics
     */
    async getStatistics() {
        try {
            const { data: reports, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.REPORTS)
                .select('status, category, severity, created_at');

            if (error) throw error;

            const stats = {
                total: reports.length,
                byStatus: {},
                byCategory: {},
                bySeverity: {},
                recent: 0
            };

            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

            reports.forEach(report => {
                // Count by status
                stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1;
                
                // Count by category
                stats.byCategory[report.category] = (stats.byCategory[report.category] || 0) + 1;
                
                // Count by severity
                stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
                
                // Recent reports (last 30 days)
                if (new Date(report.created_at) > thirtyDaysAgo) {
                    stats.recent++;
                }
            });

            return { success: true, data: stats };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Subscribe to realtime updates
     */
    subscribeToUpdates(callback) {
        const channel = window.AyosPHConfig.supabase
            .channel('reports-channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: window.AyosPHConfig.TABLES.REPORTS
                },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();

        return channel;
    }

    /**
     * Notify admins of new report
     */
    async notifyAdmins(report) {
        try {
            // Get all admin users
            const { data: admins } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.USERS)
                .select('id')
                .eq('role', 'admin');

            if (!admins || admins.length === 0) return;

            const notifications = admins.map(admin => ({
                user_id: admin.id,
                title: 'New Report Submitted',
                message: `A new ${report.category} report has been submitted with ${report.severity} severity.`,
                link_url: `/admin.html?report=${report.id}`
            }));

            await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .insert(notifications);
        } catch (error) {
            console.error('Notify admins error:', error);
        }
    }

    /**
     * Notify reporter of status update
     */
    async notifyReporter(report) {
        try {
            const notification = {
                user_id: report.reported_by,
                title: 'Report Status Updated',
                message: `Your report "${report.title}" has been updated to ${report.status}.`,
                link_url: `/dashboard.html?report=${report.id}`
            };

            await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .insert([notification]);
        } catch (error) {
            console.error('Notify reporter error:', error);
        }
    }

    /**
     * Export reports to CSV
     */
    exportToCSV(reports) {
        const headers = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Location', 'Reported By', 'Created At'];
        const rows = reports.map(report => [
            report.id,
            `"${report.title.replace(/"/g, '""')}"`,
            report.category,
            report.severity,
            report.status,
            `"${report.location.replace(/"/g, '""')}"`,
            report.users?.full_name || 'Unknown',
            new Date(report.created_at).toLocaleDateString()
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ayosph-reports-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize global reports manager
const Reports = new ReportsManager();
window.Reports = Reports;

console.log('AyosPH Reports module initialized');
