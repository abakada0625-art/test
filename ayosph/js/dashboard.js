/**
 * AyosPH - Dashboard Module
 * Resident dashboard functionality
 */

class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.reports = [];
        this.stats = {};
    }

    async init() {
        // Check authentication
        if (!Auth.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }

        this.currentUser = Auth.getCurrentUser();
        this.userProfile = Auth.getUserProfile();

        // Initialize notifications
        Notifications.init();

        // Load dashboard data
        await this.loadStats();
        await this.loadReports();
        await this.setupEventListeners();
        await this.renderUserMenu();

        // Subscribe to realtime updates
        Reports.subscribeToUpdates((payload) => {
            this.handleReportUpdate(payload);
        });

        console.log('Dashboard initialized');
    }

    async loadStats() {
        const result = await Reports.getStatistics();
        if (result.success) {
            this.stats = result.data;
            this.renderStats();
        }
    }

    renderStats() {
        document.getElementById('stat-total').textContent = this.stats.total || 0;
        document.getElementById('stat-pending').textContent = this.stats.byStatus?.['Pending'] || 0;
        document.getElementById('stat-fixed').textContent = this.stats.byStatus?.['Fixed'] || 0;
        document.getElementById('stat-in-progress').textContent = this.stats.byStatus?.['In Progress'] || 0;
    }

    async loadReports(filters = {}) {
        filters.reportedBy = this.currentUser.id;
        
        const result = await Reports.fetchReports(filters);
        if (result.success) {
            this.reports = result.data;
            this.renderReports();
        }
    }

    renderReports() {
        const container = document.getElementById('reports-list');
        if (!container) return;

        if (this.reports.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-2xl); color: var(--gray-500);">
                    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto var(--spacing-md); opacity: 0.5;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p>No reports yet</p>
                    <p style="font-size: 0.875rem;">Submit your first community report</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.reports.map(report => `
            <div class="report-item" onclick="Dashboard.viewReport('${report.id}')">
                ${report.image_before ? 
                    `<img src="${report.image_before}" alt="${report.title}" class="report-image" loading="lazy">` :
                    `<div class="report-placeholder">
                        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                    </div>`
                }
                <div class="report-content">
                    <div class="report-header">
                        <h4 class="report-title">${Utils.truncateText(report.title, 50)}</h4>
                        <span class="report-date">${Utils.formatRelativeTime(report.created_at)}</span>
                    </div>
                    <p class="report-description">${Utils.truncateText(report.description, 100)}</p>
                    <div class="report-meta">
                        <span class="badge ${Utils.getStatusBadgeClass(report.status)}">${report.status}</span>
                        <span class="badge ${Utils.getSeverityBadgeClass(report.severity)}">${report.severity}</span>
                        <span class="report-location">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            ${Utils.truncateText(report.location, 30)}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async viewReport(reportId) {
        const result = await Reports.getReportById(reportId);
        if (!result.success) return;

        const report = result.data;
        const modal = document.getElementById('report-detail-modal');
        
        modal.innerHTML = `
            <div class="modal">
                <div class="report-detail-header">
                    ${report.image_before ? 
                        `<img src="${report.image_before}" alt="${report.title}" class="report-detail-image">` :
                        `<div style="width: 100%; height: 100%; background: var(--gray-100); display: flex; align-items: center; justify-content: center;">
                            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--gray-400);">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                        </div>`
                    }
                    <span class="badge ${Utils.getStatusBadgeClass(report.status)} report-detail-status">${report.status}</span>
                    <button class="modal-close" onclick="Utils.hideModal('report-detail-modal')" style="position: absolute; top: var(--spacing-md); left: var(--spacing-md); background: rgba(0,0,0,0.5); color: white; border-radius: var(--radius-full);">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="report-detail-body">
                    <h2 class="report-detail-title">${report.title}</h2>
                    <div class="report-detail-meta">
                        <span class="badge ${Utils.getSeverityBadgeClass(report.severity)}">${report.severity}</span>
                        <span class="badge" style="background: var(--primary-50); color: var(--primary-700);">${report.category}</span>
                        <span style="color: var(--gray-500); font-size: 0.875rem;">${Utils.formatDate(report.created_at)}</span>
                    </div>
                    
                    <div class="report-detail-section">
                        <h4 class="report-detail-section-title">Description</h4>
                        <p class="report-detail-section-content">${report.description}</p>
                    </div>
                    
                    <div class="report-detail-section">
                        <h4 class="report-detail-section-title">Location</h4>
                        <p class="report-detail-section-content">${report.location}</p>
                    </div>
                    
                    ${report.remarks ? `
                    <div class="report-detail-section">
                        <h4 class="report-detail-section-title">Admin Remarks</h4>
                        <p class="report-detail-section-content">${report.remarks}</p>
                    </div>
                    ` : ''}
                    
                    ${report.image_after ? `
                    <div class="report-detail-section">
                        <h4 class="report-detail-section-title">Proof of Fix</h4>
                        <img src="${report.image_after}" alt="After fix" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: var(--radius-lg); margin-top: var(--spacing-md);">
                    </div>
                    ` : ''}
                    
                    <div class="comments-section">
                        <h4 class="report-detail-section-title">Comments</h4>
                        <div id="comments-list">
                            ${await this.renderComments(report.id)}
                        </div>
                        <form class="comment-form" onsubmit="Dashboard.addComment(event, '${report.id}')">
                            <textarea class="comment-input" placeholder="Add a comment..." rows="2" required></textarea>
                            <button type="submit" class="btn btn-primary">Post</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        Utils.showModal('report-detail-modal');
    }

    async renderComments(reportId) {
        const result = await Reports.getComments(reportId);
        if (!result.success || result.data.length === 0) {
            return '<p style="color: var(--gray-500); text-align: center; padding: var(--spacing-lg);">No comments yet</p>';
        }

        return result.data.map(comment => `
            <div class="comment-item">
                <div class="comment-avatar">${Utils.getInitials(comment.users?.full_name)}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.users?.full_name || 'Unknown'}</span>
                        <span class="comment-date">${Utils.formatRelativeTime(comment.created_at)}</span>
                    </div>
                    <p class="comment-text">${comment.message}</p>
                </div>
            </div>
        `).join('');
    }

    async addComment(event, reportId) {
        event.preventDefault();
        const form = event.target;
        const textarea = form.querySelector('textarea');
        const message = textarea.value.trim();

        if (!message) return;

        const result = await Reports.addComment(reportId, message);
        if (result.success) {
            textarea.value = '';
            const report = await Reports.getReportById(reportId);
            if (report.success) {
                document.getElementById('comments-list').innerHTML = await this.renderComments(reportId);
            }
        }
    }

    async handleReportUpdate(payload) {
        // Refresh reports list
        await this.loadReports();
        
        // Show notification
        if (payload.eventType === 'UPDATE') {
            const report = payload.new;
            Utils.showToast('info', 'Report Updated', `Your report status has been changed to ${report.status}`);
        }
    }

    async renderUserMenu() {
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        
        if (userAvatar) {
            userAvatar.textContent = Utils.getInitials(this.userProfile?.full_name);
        }
        
        if (userName) {
            userName.textContent = this.userProfile?.full_name || 'User';
        }
    }

    async setupEventListeners() {
        // Mobile menu toggle
        const menuToggle = document.querySelector('.menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }

        // Close sidebar on outside click
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });

        // Search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(async (e) => {
                const query = e.target.value.trim();
                await this.loadReports({ search: query });
            }, 300));
        }

        // Filter functionality
        const filterSelect = document.getElementById('status-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', async (e) => {
                const status = e.target.value;
                await this.loadReports({ status: status !== 'all' ? status : null });
            });
        }

        // Logout
        const logoutBtn = document.querySelector('[data-action="logout"]');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await Auth.logout();
            });
        }

        // New report button
        const newReportBtn = document.querySelector('[data-action="new-report"]');
        if (newReportBtn) {
            newReportBtn.addEventListener('click', () => {
                Utils.showModal('new-report-modal');
            });
        }

        // Report form submission
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => this.handleReportSubmit(e));
        }

        // File upload handling
        this.setupFileUpload();

        // Location detection
        const locationBtn = document.getElementById('detect-location');
        if (locationBtn) {
            locationBtn.addEventListener('click', async () => {
                await this.detectLocation();
            });
        }
    }

    setupFileUpload() {
        const fileInput = document.getElementById('report-image');
        const dropZone = document.querySelector('.file-upload');
        const preview = document.getElementById('image-preview');

        if (!fileInput || !dropZone) return;

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                this.handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
    }

    handleFileSelect(file) {
        // Validate file
        if (!file.type.startsWith('image/')) {
            Utils.showToast('error', 'Invalid File', 'Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast('error', 'File Too Large', 'Maximum file size is 5MB');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview-container');
            if (preview) {
                preview.innerHTML = `
                    <div class="file-preview">
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="file-preview-remove" onclick="Dashboard.removeImage()">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `;
            }
        };
        reader.readAsDataURL(file);
    }

    removeImage() {
        const fileInput = document.getElementById('report-image');
        const preview = document.getElementById('image-preview-container');
        
        if (fileInput) fileInput.value = '';
        if (preview) preview.innerHTML = '';
    }

    async detectLocation() {
        const locationInput = document.getElementById('report-location');
        const latInput = document.getElementById('report-latitude');
        const lngInput = document.getElementById('report-longitude');
        const btn = document.getElementById('detect-location');

        if (!locationInput) return;

        Utils.showLoading(btn);

        try {
            const location = await Utils.getCurrentLocation();
            
            latInput.value = location.latitude;
            lngInput.value = location.longitude;
            
            const address = await Utils.reverseGeocode(location.latitude, location.longitude);
            locationInput.value = address;
            
            Utils.showToast('success', 'Location Detected', 'Your current location has been detected');
        } catch (error) {
            Utils.showToast('warning', 'Location Access Denied', 'Please enter your location manually');
        } finally {
            Utils.hideLoading(btn);
        }
    }

    async handleReportSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const reportData = {
            title: document.getElementById('report-title').value,
            description: document.getElementById('report-description').value,
            category: document.getElementById('report-category').value,
            severity: document.getElementById('report-severity').value,
            location: document.getElementById('report-location').value,
            latitude: document.getElementById('report-latitude').value || null,
            longitude: document.getElementById('report-longitude').value || null,
            image: document.getElementById('report-image').files[0] || null
        };

        // Validate
        if (!reportData.title || !reportData.description || !reportData.location) {
            Utils.showToast('error', 'Validation Error', 'Please fill in all required fields');
            return;
        }

        Utils.showLoading(submitBtn);

        const result = await Reports.createReport(reportData);
        
        Utils.hideLoading(submitBtn);

        if (result.success) {
            Utils.hideModal('new-report-modal');
            form.reset();
            this.removeImage();
            await this.loadReports();
        }
    }
}

// Initialize global dashboard manager
const Dashboard = new DashboardManager();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Dashboard.init());
} else {
    Dashboard.init();
}

console.log('AyosPH Dashboard module loaded');
