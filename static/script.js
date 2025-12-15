// ==================== //
// MOBILE-OPTIMIZED BAYAN APP
// ==================== //

// Global Variables
let currentUser = null;
let stream = null;
let photoData = null;
let authCheckTimeout;
let notificationFilter = 'all';

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing BAYAN Mobile App...');
    
    // Initialize dark mode first
    initDarkMode();
    
    // Set timeout for auth check
    authCheckTimeout = setTimeout(() => {
        console.log('Auth timeout reached');
        hideLoading();
        showScreen('login-screen');
    }, 5000);
    
    // Check authentication status
    checkAuthStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup network monitoring
    setupNetworkStatusListener();
    
    // Check for first-time user
    checkFirstTimeUser();
});

// ==================== //
// EVENT LISTENERS
// ==================== //

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Report form
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', handleReportSubmit);
    }
    
    // Setup dropdown handlers
    setupDropdownHandlers();
    
    // Setup touch event listeners
    setupTouchEvents();
}

function setupDropdownHandlers() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const userDropdown = document.getElementById('user-dropdown');
        const adminDropdown = document.getElementById('admin-dropdown-menu');
        
        if (userDropdown && !event.target.closest('.dropdown-container')) {
            userDropdown.classList.add('hidden');
        }
        
        if (adminDropdown && !event.target.closest('.dropdown-container')) {
            adminDropdown.classList.add('hidden');
        }
    });
}

function setupTouchEvents() {
    // Add touch-friendly interactions
    document.addEventListener('touchstart', function() {}, {passive: true});
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

// ==================== //
// AUTHENTICATION
// ==================== //

async function checkAuthStatus() {
    try {
        console.log('🔐 Checking authentication status...');
        const response = await fetch('/api/user_info');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response:', data);
        
        clearTimeout(authCheckTimeout);
        
        if (data.success) {
            currentUser = data.user;
            console.log(`✅ Logged in as ${currentUser.username} (${currentUser.role})`);
            
            // Setup notifications
            requestNotificationPermission();
            setupPeriodicUpdateCheck();
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                await loadAdminDashboard();
                setupPeriodicReportCheck();
            } else {
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            
            // Show onboarding for first-time users
            setTimeout(() => {
                checkFirstTimeUser();
            }, 1000);
            
        } else {
            console.log('👤 Not logged in');
            showScreen('login-screen');
        }
    } catch (error) {
        console.error('❌ Auth check failed:', error);
        clearTimeout(authCheckTimeout);
        showScreen('login-screen');
    } finally {
        hideLoading();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showSnackbar('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showSnackbar('Logging in...', 'info');
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            console.log(`✅ Login successful! Role: ${currentUser.role}`);
            
            // Setup notifications
            requestNotificationPermission();
            setupPeriodicUpdateCheck();
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                await loadAdminDashboard();
                setupPeriodicReportCheck();
            } else {
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            
            showSnackbar('Login successful!', 'success');
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showSnackbar('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !email || !password || !confirmPassword) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showSnackbar('Passwords do not match', 'error');
        return;
    }
    
    try {
        showSnackbar('Creating account...', 'info');
        
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username, email, phone, password,
                confirm_password: confirmPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Account created successfully!', 'success');
            showScreen('login-screen');
            document.getElementById('register-form').reset();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showSnackbar('Registration failed. Please try again.', 'error');
    }
}

async function logout() {
    try {
        console.log('🔄 Logging out...');
        showSnackbar('Logging out...', 'info');
        
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            photoData = null;
            stream = null;
            
            // Clear stored data
            localStorage.removeItem('userReports');
            localStorage.removeItem('lastUpdateCheck');
            localStorage.removeItem('lastAdminUpdateCheck');
            localStorage.removeItem('lastNewReportCount');
            
            // Reset forms
            document.getElementById('login-form')?.reset();
            document.getElementById('register-form')?.reset();
            document.getElementById('report-form')?.reset();
            
            // Close dropdowns and modals
            closeAllDropdowns();
            closeAllModals();
            
            // Stop camera
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            
            // Show login screen
            showScreen('login-screen');
            showSnackbar('Logged out successfully!', 'success');
            
            // Clear photo preview
            removePhoto();
        } else {
            showSnackbar('Logout failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showSnackbar('Failed to logout. Please check your connection.', 'error');
    }
}

// ==================== //
// DARK MODE
// ==================== //

function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeToggle();
}

function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeToggle();
    showSnackbar(`Switched to ${isDarkMode ? 'dark' : 'light'} mode`, 'info');
}

function updateDarkModeToggle() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const toggleBtns = document.querySelectorAll('.dark-mode-toggle');
    
    toggleBtns.forEach(btn => {
        const moonIcon = btn.querySelector('.fa-moon');
        const sunIcon = btn.querySelector('.fa-sun');
        
        if (moonIcon && sunIcon) {
            moonIcon.style.opacity = isDarkMode ? '0' : '1';
            moonIcon.style.transform = isDarkMode ? 'rotate(-90deg)' : 'rotate(0deg)';
            sunIcon.style.opacity = isDarkMode ? '1' : '0';
            sunIcon.style.transform = isDarkMode ? 'rotate(0deg)' : 'rotate(90deg)';
        }
    });
}

// ==================== //
// SCREEN NAVIGATION
// ==================== //

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Load screen-specific data
        switch(screenId) {
            case 'user-dashboard':
                loadUserDashboard();
                break;
            case 'admin-dashboard':
                loadAdminDashboard();
                break;
            case 'my-reports-screen':
                loadMyReports();
                break;
            case 'notifications-screen':
                loadNotifications();
                break;
        }
    }
}

// ==================== //
// USER DASHBOARD
// ==================== //

async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    await loadStats();
    await loadNotificationsCount();
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('user-reports-count').textContent = stats.my_reports;
            document.getElementById('user-pending-count').textContent = stats.pending;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// ==================== //
// NOTIFICATION SYSTEM - IMPROVED
// ==================== //

// User Notifications
async function showNotifications() {
    showScreen('notifications-screen');
    await loadNotifications();
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const notificationsList = document.getElementById('notifications-list');
        
        if (data.success && data.notifications.length > 0) {
            const filteredNotifications = filterNotificationList(data.notifications, notificationFilter);
            
            if (filteredNotifications.length > 0) {
                notificationsList.innerHTML = filteredNotifications.map(notification => `
                    <div class="notification-item ${notification.is_read ? '' : 'unread'}" 
                         onclick="markNotificationAsRead('${notification.id}')">
                        <div class="notification-header">
                            <div class="notification-title">
                                <i class="fas ${getNotificationIcon(notification.type)}"></i>
                                ${notification.title || getNotificationTitle(notification.type)}
                            </div>
                            <div class="notification-time">
                                ${formatTimeAgo(notification.created_at)}
                            </div>
                        </div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-meta">
                            <span class="notification-tag tag-${notification.priority || 'system'}">
                                ${notification.priority || 'System'}
                            </span>
                            ${notification.report_type ? `
                                <span class="notification-tag tag-user">
                                    ${notification.report_type}
                                </span>
                            ` : ''}
                        </div>
                        ${!notification.is_read ? `
                            <div class="notification-actions">
                                <button class="btn btn-sm btn-outline notification-action-btn"
                                        onclick="event.stopPropagation(); markNotificationAsRead('${notification.id}')">
                                    <i class="fas fa-check"></i> Mark Read
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `).join('');
            } else {
                showEmptyNotificationState(notificationsList, notificationFilter);
            }
        } else {
            showEmptyNotificationState(notificationsList, 'all');
        }
        
        await loadNotificationsCount();
    } catch (error) {
        console.error('Failed to load notifications:', error);
        const notificationsList = document.getElementById('notifications-list');
        notificationsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Unable to Load Notifications</h4>
                <p>Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadNotifications()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Admin Notifications
async function showAdminNotifications() {
    const modal = document.getElementById('admin-notifications-modal');
    modal.classList.remove('hidden');
    await loadAdminNotifications();
}

// Updated loadAdminNotifications function
async function loadAdminNotifications() {
    try {
        const notificationsList = document.getElementById('admin-notifications-list');
        
        // Show loading state
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p style="color: var(--text-muted);">Loading notifications...</p>
            </div>
        `;
        
        // Get new reports count
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();
        
        if (data.success && data.count > 0) {
            // Get detailed reports info
            const reportsResponse = await fetch('/api/all_reports');
            const reportsData = await reportsResponse.json();
            
            if (reportsData.success) {
                const yesterday = new Date();
                yesterday.setHours(yesterday.getHours() - 24);
                
                const newReports = reportsData.reports.filter(report => {
                    const reportDate = new Date(report.date);
                    return reportDate >= yesterday;
                });
                
                // Categorize reports
                const newReportsList = newReports.filter(r => r.status === 'Pending');
                const updatedReports = newReports.filter(r => r.status === 'In Progress');
                const resolvedReports = newReports.filter(r => r.status === 'Resolved');
                const urgentReports = newReports.filter(r => r.priority === 'Urgent' || r.priority === 'High');
                
                notificationsList.innerHTML = `
                    <div class="notification-summary">
                        <div class="summary-stats">
                            <div class="summary-stat">
                                <span class="summary-stat-value">${data.count}</span>
                                <span class="summary-stat-label">Total New</span>
                            </div>
                            <div class="summary-stat">
                                <span class="summary-stat-value">${newReportsList.length}</span>
                                <span class="summary-stat-label">Pending</span>
                            </div>
                            <div class="summary-stat">
                                <span class="summary-stat-value">${urgentReports.length}</span>
                                <span class="summary-stat-label">Urgent</span>
                            </div>
                        </div>
                        <div class="summary-actions">
                            <button class="btn btn-sm btn-outline" onclick="markAllNotificationsAsRead()" style="flex: 1;">
                                <i class="fas fa-check-double"></i> Mark All Read
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="loadAllReports()" style="flex: 1;">
                                <i class="fas fa-list"></i> View All Reports
                            </button>
                        </div>
                    </div>
                    
                    <div class="notification-categories">
                        <button class="notification-category-btn active" onclick="filterNotifications('all')">
                            All (${data.count})
                        </button>
                        <button class="notification-category-btn" onclick="filterNotifications('new')">
                            New Reports (${newReportsList.length})
                        </button>
                        <button class="notification-category-btn" onclick="filterNotifications('updates')">
                            Updates (${updatedReports.length})
                        </button>
                        <button class="notification-category-btn" onclick="filterNotifications('resolved')">
                            Resolved (${resolvedReports.length})
                        </button>
                        <button class="notification-category-btn" onclick="filterNotifications('urgent')">
                            Urgent (${urgentReports.length})
                        </button>
                    </div>
                    
                    <div id="notifications-container" class="notifications-container">
                        ${renderNotificationItems(newReports)}
                    </div>
                `;
            }
        } else {
            notificationsList.innerHTML = `
                <div class="admin-notifications-empty">
                    <i class="fas fa-bell-slash"></i>
                    <h4 style="margin-bottom: 8px; color: var(--text-primary);">No New Notifications</h4>
                    <p style="margin-bottom: 20px; max-width: 300px; margin-left: auto; margin-right: auto;">
                        You're all caught up! There are no new reports or updates at the moment.
                    </p>
                    <button class="btn btn-outline" onclick="loadAllReports()">
                        <i class="fas fa-chart-bar"></i>
                        View Dashboard
                    </button>
                </div>
            `;
        }
        
        // Update badge count
        await loadAdminNotificationsCount();
        
    } catch (error) {
        console.error('Failed to load admin notifications:', error);
        const notificationsList = document.getElementById('admin-notifications-list');
        notificationsList.innerHTML = `
            <div class="admin-notifications-empty">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                <h4 style="margin-bottom: 8px; color: var(--text-primary);">Unable to Load</h4>
                <p style="margin-bottom: 20px;">Failed to load notifications. Please check your connection.</p>
                <button class="btn btn-outline" onclick="loadAdminNotifications()">
                    <i class="fas fa-redo"></i>
                    Try Again
                </button>
            </div>
        `;
    }
}

// Helper function to render notification items
function renderNotificationItems(reports) {
    return reports.map(report => {
        const reportDate = new Date(report.date);
        const timeAgo = formatTimeAgo(report.date);
        const isNew = (new Date() - reportDate) <= (24 * 60 * 60 * 1000);
        
        let iconClass = 'notification-new';
        let icon = 'fa-plus-circle';
        let title = 'New Report Submitted';
        
        if (report.status === 'In Progress') {
            iconClass = 'notification-update';
            icon = 'fa-sync-alt';
            title = 'Report Updated';
        } else if (report.status === 'Resolved') {
            iconClass = 'notification-resolved';
            icon = 'fa-check-circle';
            title = 'Report Resolved';
        }
        
        if (report.priority === 'Urgent' || report.priority === 'High') {
            iconClass = 'notification-urgent';
            icon = 'fa-exclamation-triangle';
            title = 'Urgent Report';
        }
        
        return `
            <div class="admin-notification-item ${isNew ? 'unread' : ''}" onclick="viewReport(${report.id})">
                ${isNew ? '<div class="notification-badge"></div>' : ''}
                <div class="admin-notification-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="admin-notification-content">
                    <div class="notification-header">
                        <div class="notification-title">${title}</div>
                        <div class="notification-time">
                            <i class="fas fa-clock"></i> ${timeAgo}
                        </div>
                    </div>
                    <div class="notification-message">
                        <strong>${report.problem_type}</strong> reported at ${report.location}
                    </div>
                    <div class="notification-details">
                        <div class="notification-detail-item">
                            <i class="fas fa-user"></i>
                            <span>${report.username}</span>
                        </div>
                        <div class="notification-detail-item">
                            <i class="fas fa-flag"></i>
                            <span>${report.priority} Priority</span>
                        </div>
                        <div class="notification-detail-item">
                            <i class="fas fa-tag"></i>
                            <span class="status-${report.status.toLowerCase().replace(' ', '-')}">${report.status}</span>
                        </div>
                    </div>
                    <div class="notification-actions">
                        <button class="notification-action-btn" onclick="event.stopPropagation(); viewReport(${report.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="notification-action-btn primary" onclick="event.stopPropagation(); updateReportStatus(${report.id})">
                            <i class="fas fa-edit"></i> Update
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to format time ago
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
}

// Notification filtering function
function filterNotifications(filterType) {
    const categoryBtns = document.querySelectorAll('.notification-category-btn');
    categoryBtns.forEach(btn => btn.classList.remove('active'));
    
    const clickedBtn = event.target.closest('.notification-category-btn');
    clickedBtn.classList.add('active');
    
    const notificationItems = document.querySelectorAll('.admin-notification-item');
    notificationItems.forEach(item => {
        switch(filterType) {
            case 'new':
                item.style.display = item.querySelector('.fa-plus-circle, .fa-exclamation-triangle') ? '' : 'none';
                break;
            case 'updates':
                item.style.display = item.querySelector('.fa-sync-alt') ? '' : 'none';
                break;
            case 'resolved':
                item.style.display = item.querySelector('.fa-check-circle') ? '' : 'none';
                break;
            case 'urgent':
                item.style.display = item.querySelector('.fa-exclamation-triangle') ? '' : 'none';
                break;
            default:
                item.style.display = '';
        }
    });
}

// Mark all as read function
function markAllNotificationsAsRead() {
    const unreadItems = document.querySelectorAll('.admin-notification-item.unread');
    unreadItems.forEach(item => {
        item.classList.remove('unread');
        const badge = item.querySelector('.notification-badge');
        if (badge) badge.remove();
    });
    
    // Update badge count
    document.getElementById('admin-notification-badge').classList.add('hidden');
    
    showSnackbar('All notifications marked as read', 'success');
}

// View report function
function viewReport(reportId) {
    // Navigate to admin dashboard and highlight the report
    showScreen('admin-dashboard');
    setTimeout(() => {
        // Scroll to and highlight the report
        const reportElement = document.querySelector(`[data-report-id="${reportId}"]`);
        if (reportElement) {
            reportElement.scrollIntoView({ behavior: 'smooth' });
            reportElement.style.animation = 'highlight-pulse 2s ease';
        }
    }, 100);
}

// Update report status function
async function updateReportStatus(reportId) {
    const modal = document.getElementById('resolution-modal');
    modal.dataset.reportId = reportId;
    modal.classList.remove('hidden');
    document.getElementById('auditor-name').focus();
}

// Notification Helper Functions
function filterNotificationList(notifications, filter) {
    switch(filter) {
        case 'unread':
            return notifications.filter(n => !n.is_read);
        case 'resolved':
            return notifications.filter(n => n.type === 'report_resolved');
        case 'new':
            return notifications.filter(n => n.type === 'report_submitted');
        default:
            return notifications;
    }
}

function filterNotifications(filter) {
    notificationFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.notification-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadNotifications();
}

function filterAdminNotifications(filter) {
    // Similar implementation for admin notifications
    const buttons = document.querySelectorAll('#admin-notifications-modal .filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Filter logic would go here
}

function getNotificationIcon(type) {
    const icons = {
        'report_submitted': 'fa-plus-circle text-primary',
        'report_resolved': 'fa-check-circle text-success',
        'report_updated': 'fa-sync-alt text-warning',
        'report_deleted': 'fa-trash text-danger',
        'system': 'fa-info-circle text-info',
        'urgent': 'fa-exclamation-triangle text-danger'
    };
    return icons[type] || 'fa-bell text-muted';
}

function getAdminNotificationIcon(type) {
    const icons = {
        'new_report': 'fa-file-circle-plus text-primary',
        'report_update': 'fa-file-pen text-warning',
        'urgent_report': 'fa-triangle-exclamation text-danger',
        'system': 'fa-server text-info'
    };
    return icons[type] || 'fa-bell text-muted';
}

function getNotificationTitle(type) {
    const titles = {
        'report_submitted': 'New Report Submitted',
        'report_resolved': 'Report Resolved',
        'report_updated': 'Report Updated',
        'report_deleted': 'Report Deleted',
        'system': 'System Notification'
    };
    return titles[type] || 'Notification';
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return time.toLocaleDateString();
}

async function markNotificationAsRead(notificationId) {
    try {
        await fetch('/api/mark_notification_read', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ notification_id: notificationId })
        });
        
        // Update UI
        const notificationItem = event.target.closest('.notification-item');
        if (notificationItem) {
            notificationItem.classList.remove('unread');
            const actionsDiv = notificationItem.querySelector('.notification-actions');
            if (actionsDiv) actionsDiv.remove();
        }
        
        await loadNotificationsCount();
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        showSnackbar('Marking all as read...', 'info');
        
        await fetch('/api/mark_all_notifications_read', {
            method: 'POST'
        });
        
        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            const actionsDiv = item.querySelector('.notification-actions');
            if (actionsDiv) actionsDiv.remove();
        });
        
        await loadNotificationsCount();
        showSnackbar('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        showSnackbar('Failed to mark all as read', 'error');
    }
}

async function loadNotificationsCount() {
    try {
        const response = await fetch('/api/notifications_count');
        const data = await response.json();
        
        const badge = document.getElementById('notification-badge');
        if (data.success && data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load notifications count:', error);
    }
}

async function loadAdminNotificationsCount() {
    try {
        const response = await fetch('/api/notifications_count');
        const data = await response.json();
        
        const badge = document.getElementById('admin-notification-badge');
        if (data.success && data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load admin notifications count:', error);
    }
}

function showEmptyNotificationState(container, filter) {
    const messages = {
        'all': 'You\'re all caught up! No notifications at this time.',
        'unread': 'No unread notifications.',
        'resolved': 'No resolved report notifications.',
        'new': 'No new report notifications.'
    };
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <h4>No Notifications</h4>
            <p>${messages[filter] || messages['all']}</p>
        </div>
    `;
}

// ==================== //
// REPORT SUBMISSION
// ==================== //

async function handleReportSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    if (!validateReportForm()) {
        return;
    }
    
    try {
        const submitBtn = document.getElementById('submit-report-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        const problemType = document.getElementById('problem-type').value;
        const location = document.getElementById('location').value;
        const issue = document.getElementById('issue').value;
        const priority = document.getElementById('priority').value;
        
        const response = await fetch('/api/submit_report', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                problem_type: problemType,
                location: location,
                issue: issue,
                priority: priority,
                photo_data: photoData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report submitted successfully!', 'success');
            document.getElementById('report-form').reset();
            removePhoto();
            await loadStats();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Report submission error:', error);
        showSnackbar('Failed to submit report. Please try again.', 'error');
    } finally {
        const submitBtn = document.getElementById('submit-report-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
            submitBtn.disabled = false;
        }
    }
}

function validateReportForm() {
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    
    if (!problemType) {
        showSnackbar('Please select a problem type', 'error');
        document.getElementById('problem-type').focus();
        return false;
    }
    
    if (!location.trim()) {
        showSnackbar('Please enter a location', 'error');
        document.getElementById('location').focus();
        return false;
    }
    
    if (!issue.trim()) {
        showSnackbar('Please describe the issue', 'error');
        document.getElementById('issue').focus();
        return false;
    }
    
    return true;
}

// ==================== //
// CAMERA FUNCTIONALITY
// ==================== //

async function openCamera() {
    try {
        const modal = document.getElementById('camera-modal');
        const video = document.getElementById('camera-view');
        
        modal.classList.remove('hidden');
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        stream = mediaStream;
        video.srcObject = stream;
        video.play();
    } catch (error) {
        console.error('Camera error:', error);
        showSnackbar('Failed to access camera. Please check permissions.', 'error');
        closeCamera();
    }
}

function closeCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-view');
    
    modal.classList.add('hidden');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    video.srcObject = null;
}

function capturePhoto() {
    const video = document.getElementById('camera-view');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    photoData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Show preview
    const preview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    
    previewImage.src = photoData;
    preview.classList.remove('hidden');
    
    closeCamera();
    showSnackbar('Photo captured successfully!', 'success');
}

function handleFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showSnackbar('Please select a valid image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showSnackbar('Image size should be less than 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        photoData = e.target.result;
        
        const preview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = photoData;
        preview.classList.remove('hidden');
        
        showSnackbar('Photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoData = null;
    document.getElementById('photo-preview').classList.add('hidden');
}

// ==================== //
// ADMIN DASHBOARD
// ==================== //

async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    await loadAdminStats();
    await loadAllReports();
    await loadAdminNotificationsCount();
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('total-reports').textContent = stats.total;
            document.getElementById('pending-reports').textContent = stats.pending;
            document.getElementById('in-progress-reports').textContent = stats.in_progress;
            document.getElementById('resolved-reports').textContent = stats.resolved;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

async function loadAllReports() {
    try {
        const response = await fetch('/api/all_reports');
        const data = await response.json();
        
        const reportsList = document.getElementById('admin-reports-list');
        
        if (data.success && data.reports.length > 0) {
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span>By: ${report.username}</span>
                        <span>${report.date}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo">
                        </div>
                    ` : ''}
                    <div class="admin-actions">
                        <select class="status-select" onchange="handleStatusChange(this, ${report.id})">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' && report.resolution_notes ? `
                        <div class="resolution-notes">
                            <strong>Resolution Notes:</strong>
                            <p>${report.resolution_notes}</p>
                            ${report.auditor_name ? `<small>Audited by: ${report.auditor_name}</small>` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h4>No Reports</h4>
                    <p>No reports have been submitted yet.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

async function filterReports(period) {
    try {
        const response = await fetch('/api/all_reports');
        const data = await response.json();
        
        if (data.success && data.reports.length > 0) {
            const now = new Date();
            let filteredReports = [];
            
            data.reports.forEach(report => {
                const reportDate = new Date(report.date);
                let include = false;
                
                switch(period) {
                    case 'today':
                        // Check if the report is from today
                        if (reportDate.toDateString() === now.toDateString()) {
                            include = true;
                        }
                        break;
                    case 'week':
                        // Check if the report is from the current week
                        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (reportDate >= oneWeekAgo) {
                            include = true;
                        }
                        break;
                    case 'month':
                        // Check if the report is from the current month
                        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (reportDate >= oneMonthAgo) {
                            include = true;
                        }
                        break;
                    case 'all':
                        include = true;
                        break;
                }
                
                if (include) {
                    filteredReports.push(report);
                }
            });
            
            displayFilteredReports(filteredReports, period);
        } else {
            const reportsList = document.getElementById('admin-reports-list');
            reportsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h4>No Reports</h4>
                    <p>No reports found.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to filter reports:', error);
        showSnackbar('Failed to filter reports', 'error');
    }
}

function displayFilteredReports(reports, period) {
    const reportsList = document.getElementById('admin-reports-list');
    const filterIndicator = document.getElementById('filter-indicator');
    
    if (reports.length > 0) {
        reportsList.innerHTML = reports.map(report => `
            <div class="report-card">
                <div class="report-header">
                    <span class="report-type">${report.problem_type}</span>
                    <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                        ${report.status}
                    </span>
                </div>
                <div class="report-location">
                    <i class="fas fa-location-dot"></i> ${report.location}
                </div>
                <div class="report-issue">${report.issue}</div>
                <div class="report-footer">
                    <span>By: ${report.username}</span>
                    <span>${report.date}</span>
                </div>
                ${report.photo_data ? `
                    <div class="report-photo">
                        <img src="${report.photo_data}" alt="Report photo">
                    </div>
                ` : ''}
                <div class="admin-actions">
                    <select class="status-select" onchange="handleStatusChange(this, ${report.id})">
                        <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                    <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
                ${report.status === 'Resolved' && report.resolution_notes ? `
                    <div class="resolution-notes">
                        <strong>Resolution Notes:</strong>
                        <p>${report.resolution_notes}</p>
                        ${report.auditor_name ? `<small>Audited by: ${report.auditor_name}</small>` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        filterIndicator.textContent = `Showing: ${period.charAt(0).toUpperCase() + period.slice(1)} (${reports.length} reports)`;
    } else {
        reportsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h4>No Reports</h4>
                <p>No reports found for this period.</p>
            </div>
        `;
        filterIndicator.textContent = `Showing: ${period.charAt(0).toUpperCase() + period.slice(1)}`;
    }
}

// ==================== //
// REPORT MANAGEMENT
// ==================== //

function handleStatusChange(selectElement, reportId) {
    const newStatus = selectElement.value;
    
    if (newStatus === 'Resolved') {
        showResolutionModal(reportId, selectElement);
    } else {
        updateStatus(reportId, newStatus);
    }
}

async function updateStatus(reportId, newStatus) {
    try {
        const response = await fetch('/api/update_report_status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                report_id: reportId,
                status: newStatus
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Status updated successfully!', 'success');
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to update status:', error);
        showSnackbar('Failed to update status', 'error');
    }
}

function showResolutionModal(reportId, selectElement) {
    const modal = document.getElementById('resolution-modal');
    modal.dataset.reportId = reportId;
    modal.dataset.selectElement = selectElement.id;
    
    document.getElementById('auditor-name').value = '';
    document.getElementById('resolution-notes').value = '';
    
    modal.classList.remove('hidden');
    document.getElementById('auditor-name').focus();
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirm-resolution-btn');
    confirmBtn.onclick = submitResolution;
}

function cancelResolution() {
    const modal = document.getElementById('resolution-modal');
    const selectElement = document.getElementById(modal.dataset.selectElement);
    
    if (selectElement) {
        selectElement.value = 'In Progress';
    }
    
    modal.classList.add('hidden');
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const auditorName = document.getElementById('auditor-name').value;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    
    if (!auditorName.trim()) {
        showSnackbar('Please enter your name as auditor', 'error');
        document.getElementById('auditor-name').focus();
        return;
    }
    
    if (!resolutionNotes.trim()) {
        showSnackbar('Please provide resolution details', 'error');
        document.getElementById('resolution-notes').focus();
        return;
    }
    
    try {
        const response = await fetch('/api/update_report_with_resolution', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                report_id: parseInt(reportId),
                status: 'Resolved',
                auditor_name: auditorName,
                resolution_notes: resolutionNotes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report resolved successfully!', 'success');
            modal.classList.add('hidden');
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
            const selectElement = document.getElementById(modal.dataset.selectElement);
            if (selectElement) selectElement.value = 'In Progress';
        }
    } catch (error) {
        console.error('Resolution error:', error);
        showSnackbar('Failed to update report', 'error');
        const selectElement = document.getElementById(modal.dataset.selectElement);
        if (selectElement) selectElement.value = 'In Progress';
    }
}

// ==================== //
// MY REPORTS
// ==================== //

async function loadMyReports() {
    try {
        const response = await fetch('/api/user_reports');
        const data = await response.json();
        
        const reportsList = document.getElementById('reports-list');
        
        if (data.success && data.reports.length > 0) {
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span>${report.date}</span>
                        <span>${report.priority}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo">
                        </div>
                    ` : ''}
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes">
                            <strong>Resolution Notes:</strong>
                            <p>${report.resolution_notes || 'No additional details provided.'}</p>
                            ${report.auditor_name ? `<small>Audited by: ${report.auditor_name}</small>` : ''}
                        </div>
                    ` : ''}
                    <div class="report-actions">
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, false)">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h4>No Reports</h4>
                    <p>You haven't submitted any reports yet.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

async function deleteReport(reportId, isAdmin) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        return;
    }
    
    try {
        const endpoint = isAdmin ? '/api/delete_report' : '/api/delete_user_report';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ report_id: reportId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report deleted successfully!', 'success');
            if (isAdmin) {
                await loadAllReports();
                await loadAdminStats();
            } else {
                await loadMyReports();
                await loadStats();
            }
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Delete report error:', error);
        showSnackbar('Failed to delete report', 'error');
    }
}

// ==================== //
// UTILITY FUNCTIONS
// ==================== //

function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
}

function toggleAdminDropdown() {
    const dropdown = document.getElementById('admin-dropdown-menu');
    dropdown.classList.toggle('hidden');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function showSnackbar(message, type = 'info', duration = 4000) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.className = `snackbar ${type}`;
    snackbar.classList.remove('hidden');
    
    setTimeout(() => {
        snackbar.classList.add('hidden');
    }, duration);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(dropdown => {
        dropdown.classList.add('hidden');
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// ==================== //
// NETWORK & NOTIFICATIONS
// ==================== //

function requestNotificationPermission() {
    if (!("Notification" in window)) return false;
    
    if (Notification.permission === "granted") return true;
    
    if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    return false;
}

function setupPeriodicUpdateCheck() {
    if (!currentUser) return;
    
    setInterval(async () => {
        try {
            await checkForUpdates();
        } catch (error) {
            console.error('Update check failed:', error);
        }
    }, 30000);
}

async function checkForUpdates() {
    if (!currentUser) return;
    
    try {
        if (currentUser.role === 'admin') {
            await checkAdminUpdates();
        } else {
            await checkUserUpdates();
        }
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

async function checkUserUpdates() {
    try {
        const response = await fetch('/api/check_updates');
        const data = await response.json();
        
        if (data.success && data.has_updates) {
            // Show browser notification if permitted
            if (Notification.permission === "granted") {
                new Notification("BAYAN Updates", {
                    body: "You have new updates in your reports",
                    icon: "/static/favicon.ico"
                });
            }
            
            // Update badge count
            await loadNotificationsCount();
        }
    } catch (error) {
        console.error('User update check failed:', error);
    }
}

async function checkAdminUpdates() {
    try {
        const response = await fetch('/api/admin_check_updates');
        const data = await response.json();
        
        if (data.success && data.has_updates) {
            // Update badge count
            await loadAdminNotificationsCount();
            
            // Show browser notification if permitted
            if (Notification.permission === "granted") {
                new Notification("BAYAN Admin Updates", {
                    body: "New reports or updates available",
                    icon: "/static/favicon.ico"
                });
            }
        }
    } catch (error) {
        console.error('Admin update check failed:', error);
    }
}

function setupNetworkStatusListener() {
    window.addEventListener('online', () => {
        showSnackbar('Back online. Syncing data...', 'success');
    });
    
    window.addEventListener('offline', () => {
        showSnackbar('You are offline. Some features may be limited.', 'warning');
    });
}

// ==================== //
// FIRST-TIME USER EXPERIENCE
// ==================== //

function checkFirstTimeUser() {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    
    if (!hasSeenOnboarding && currentUser) {
        setTimeout(() => {
            showHelpModal();
            localStorage.setItem('hasSeenOnboarding', 'true');
        }, 1000);
    }
}

function showHelpModal() {
    const modal = document.getElementById('help-modal');
    modal.classList.remove('hidden');
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    modal.classList.add('hidden');
}

// ==================== //
// ADMIN FUNCTIONS
// ==================== //

async function refreshAdminDashboard() {
    try {
        showSnackbar('Refreshing dashboard...', 'info');
        await loadAdminStats();
        await loadAllReports();
        await loadAdminNotificationsCount();
        showSnackbar('Dashboard refreshed!', 'success');
    } catch (error) {
        console.error('Failed to refresh admin dashboard:', error);
        showSnackbar('Failed to refresh dashboard', 'error');
    }
}

function setupPeriodicReportCheck() {
    if (currentUser && currentUser.role === 'admin') {
        setInterval(async () => {
            try {
                await checkAdminUpdates();
            } catch (error) {
                console.error('Periodic report check failed:', error);
            }
        }, 60000);
    }
}

// ==================== //
// EXPORT FUNCTIONS TO WINDOW
// ==================== //

window.toggleDarkMode = toggleDarkMode;
window.showScreen = showScreen;
window.showMyReports = showMyReports;
window.showNotifications = showNotifications;
window.showAdminNotifications = showAdminNotifications;
window.logout = logout;
window.toggleDropdown = toggleDropdown;
window.toggleAdminDropdown = toggleAdminDropdown;
window.togglePassword = togglePassword;
window.openCamera = openCamera;
window.closeCamera = closeCamera;
window.capturePhoto = capturePhoto;
window.handleFileUpload = handleFileUpload;
window.removePhoto = removePhoto;
window.handleStatusChange = handleStatusChange;
window.filterReports = filterReports;
window.filterNotifications = filterNotifications;
window.filterAdminNotifications = filterAdminNotifications;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.markNotificationAsRead = markNotificationAsRead;
window.deleteReport = deleteReport;
window.refreshAdminDashboard = refreshAdminDashboard;
window.closeHelpModal = closeHelpModal;
window.cancelResolution = cancelResolution;

