// Global variables
let currentUser = null;
let stream = null;
let photoData = null;
let authCheckTimeout;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting auth check...');
    
    // Set a timeout to ensure loading screen doesn't stay forever
    authCheckTimeout = setTimeout(() => {
        console.log('Auth check timeout reached, forcing login screen');
        hideLoading();
        showScreen('login-screen');
    }, 5000); // 5 second timeout
    
    checkAuthStatus();
    setupEventListeners();
});

// Event listeners
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
    
    // Setup dropdown click handlers
    setupDropdownHandlers();
    
    // Setup problem type buttons
    setupProblemTypeButtons();
}

// Setup problem type buttons
function setupProblemTypeButtons() {
    const buttons = document.querySelectorAll('.problem-type-btn');
    const hiddenInput = document.getElementById('problem-type');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update hidden input value
            if (hiddenInput) {
                hiddenInput.value = this.dataset.type;
            }
        });
    });
    
    // Set initial value
    const firstButton = document.querySelector('.problem-type-btn');
    if (firstButton && hiddenInput) {
        hiddenInput.value = firstButton.dataset.type;
    }
}

// Setup dropdown handlers
function setupDropdownHandlers() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        // User dropdown
        const userDropdown = document.getElementById('user-dropdown');
        const userMenuBtn = document.querySelector('.user-menu');
        
        if (userDropdown && userMenuBtn) {
            const isClickInsideDropdown = userDropdown.contains(event.target);
            const isClickOnMenuBtn = userMenuBtn.contains(event.target);
            
            if (!isClickInsideDropdown && !isClickOnMenuBtn && !userDropdown.classList.contains('hidden')) {
                userDropdown.classList.add('hidden');
            }
        }
        
        // Admin dropdown
        const adminDropdown = document.getElementById('admin-dropdown-menu');
        const adminMenuBtn = document.querySelector('.admin-container .three-dot-menu');
        
        if (adminDropdown && adminMenuBtn) {
            const isClickInsideAdminDropdown = adminDropdown.contains(event.target);
            const isClickOnAdminMenuBtn = adminMenuBtn.contains(event.target);
            
            if (!isClickInsideAdminDropdown && !isClickOnAdminMenuBtn && !adminDropdown.classList.contains('hidden')) {
                adminDropdown.classList.add('hidden');
            }
        }
    });
}

// Enhanced Report functions
async function handleReportSubmit(e) {
    e.preventDefault();
    
    console.log('🔍 Report form submitted - Starting validation');
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    // Get form values
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    const priority = document.getElementById('priority').value;
    
    console.log('📋 Form data:', { problemType, location, issue, priority });
    
    // Validate form
    if (!validateReportForm()) {
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.getElementById('submit-report-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        console.log('📤 Submitting report to server...');
        
        const response = await fetch('/api/submit_report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                problem_type: problemType,
                location: location,
                issue: issue,
                priority: priority,
                photo_data: photoData
            })
        });
        
        const data = await response.json();
        console.log('✅ Submit response:', data);
        
        if (data.success) {
            showSnackbar('Report submitted successfully!', 'success');
            // Reset form
            document.getElementById('report-form').reset();
            removePhoto();
            // Reset problem type buttons
            document.querySelectorAll('.problem-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const firstBtn = document.querySelector('.problem-type-btn');
            if (firstBtn) firstBtn.classList.add('active');
            document.getElementById('problem-type').value = firstBtn?.dataset.type || '';
            
            // Refresh stats
            await loadStats();
            console.log('🔄 Stats refreshed after report submission');
        } else {
            console.error('❌ Report submission failed:', data.message);
            showSnackbar(data.message || 'Failed to submit report', 'error');
        }
    } catch (error) {
        console.error('💥 Report submission error:', error);
        showSnackbar('Failed to submit report. Please try again.', 'error');
    } finally {
        // Reset button state
        const submitBtn = document.getElementById('submit-report-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
            submitBtn.disabled = false;
        }
    }
}

// Form validation
function validateReportForm() {
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    
    if (!problemType) {
        showSnackbar('Please select a problem type', 'error');
        const firstBtn = document.querySelector('.problem-type-btn');
        if (firstBtn) firstBtn.focus();
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

// Authentication functions
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/api/user_info');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response:', data);
        
        // Clear the timeout since we got a response
        clearTimeout(authCheckTimeout);
        
        if (data.success) {
            currentUser = data.user;
            
            // Request notification permission
            requestNotificationPermission();
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                loadAdminDashboard();
            } else {
                showScreen('user-dashboard');
                loadUserDashboard();
            }
        } else {
            console.log('Not logged in, showing login screen');
            showScreen('login-screen');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Clear the timeout on error too
        clearTimeout(authCheckTimeout);
        showScreen('login-screen');
    } finally {
        hideLoading();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showSnackbar('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showSnackbar('Logging in...', 'info');
        console.log(`Attempting login for: ${email}`);
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            currentUser = data.user;
            console.log(`Login successful! User role: ${currentUser.role}`);
            
            // Request notification permission
            requestNotificationPermission();
            
            if (currentUser.role === 'admin') {
                console.log('Redirecting to admin dashboard...');
                showScreen('admin-dashboard');
                await loadAdminDashboard();
            } else {
                console.log('Redirecting to user dashboard...');
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            showSnackbar('Login successful!', 'success');
        } else {
            console.error('Login failed:', data.message);
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showSnackbar('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Register form submitted');
    
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                phone,
                password,
                confirm_password: confirmPassword
            })
        });
        
        const data = await response.json();
        console.log('Register response:', data);
        
        if (data.success) {
            showSnackbar('Account created successfully!', 'success');
            showScreen('login-screen');
            // Clear form
            document.getElementById('register-form').reset();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showSnackbar('Registration failed. Please try again.', 'error');
    }
}

// Enhanced logout function
async function logout() {
    try {
        console.log('🔄 Attempting logout...');
        
        // Show loading state
        showSnackbar('Logging out...', 'info');
        
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Logout successful');
            currentUser = null;
            photoData = null;
            stream = null;
            
            // Clear any stored data
            localStorage.removeItem('userReports');
            localStorage.removeItem('lastUpdateCheck');
            localStorage.removeItem('lastAdminUpdateCheck');
            localStorage.removeItem('lastNewReportCount');
            
            // Reset any UI elements
            document.getElementById('login-form')?.reset();
            document.getElementById('register-form')?.reset();
            document.getElementById('report-form')?.reset();
            
            // Close any open dropdowns
            const userDropdown = document.getElementById('user-dropdown');
            const adminDropdown = document.getElementById('admin-dropdown-menu');
            if (userDropdown) userDropdown.classList.add('hidden');
            if (adminDropdown) adminDropdown.classList.add('hidden');
            
            // Close any open modals
            document.getElementById('camera-modal')?.classList.add('hidden');
            document.getElementById('resolution-modal')?.classList.add('hidden');
            
            // Stop camera stream if active
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
            console.error('❌ Logout failed:', data.message);
            showSnackbar('Logout failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('💥 Logout error:', error);
        showSnackbar('Failed to logout. Please check your connection.', 'error');
    }
}

// Dashboard functions
async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('dropdown-user-name').textContent = currentUser.username;
    document.getElementById('welcome-name').textContent = currentUser.username.split(' ')[0];
    document.getElementById('user-avatar').textContent = getInitials(currentUser.username);
    
    await loadStats();
    await loadNotificationsCount();
    await loadRecentReports();
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('user-reports-count').textContent = stats.my_reports || 0;
            document.getElementById('user-pending-count').textContent = stats.pending || 0;
            document.getElementById('user-inprogress-count').textContent = stats.in_progress || 0;
            document.getElementById('user-resolved-count').textContent = stats.resolved || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadRecentReports() {
    try {
        const response = await fetch('/api/user_reports?limit=5');
        const data = await response.json();
        
        const container = document.getElementById('recent-reports-list');
        if (!container) return;
        
        if (data.success && data.reports.length > 0) {
            container.innerHTML = data.reports.map(report => `
                <div class="recent-report-item">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${getReportTypeColor(report.problem_type)}">
                            <i class="fas ${getReportTypeIcon(report.problem_type)}"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="font-medium truncate">${report.problem_type}</p>
                            <span class="report-status-badge report-status-${report.status.toLowerCase().replace(' ', '-')}">
                                ${report.status}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 truncate">${report.location}</p>
                        <p class="text-xs text-gray-400">${formatDate(report.date)}</p>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-file-alt text-4xl mb-3 opacity-30"></i>
                    <p>No recent reports</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load recent reports:', error);
    }
}

function getReportTypeIcon(type) {
    const icons = {
        'Pothole': 'fa-road',
        'Garbage': 'fa-trash',
        'Light': 'fa-lightbulb',
        'Water': 'fa-tint',
        'Noise': 'fa-volume-up',
        'Other': 'fa-ellipsis-h'
    };
    return icons[type] || 'fa-file-alt';
}

function getReportTypeColor(type) {
    const colors = {
        'Pothole': 'bg-orange-100 text-orange-600',
        'Garbage': 'bg-red-100 text-red-600',
        'Light': 'bg-yellow-100 text-yellow-600',
        'Water': 'bg-blue-100 text-blue-600',
        'Noise': 'bg-purple-100 text-purple-600',
        'Other': 'bg-gray-100 text-gray-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
}

async function loadNotificationsCount() {
    try {
        const response = await fetch('/api/notifications_count');
        const data = await response.json();
        
        const badge = document.getElementById('notification-badge');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load notifications count:', error);
    }
}

// Browser Notification Functions
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return false;
    }
    
    if (Notification.permission === "granted") {
        console.log("Notification permission already granted");
        return true;
    }
    
    if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Notification permission granted");
                showSnackbar('Notifications enabled! You will receive updates.', 'success');
            }
        });
    }
    
    return false;
}

// Navigation functions
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        console.log(`Screen ${screenId} is now visible`);
    } else {
        console.error(`Screen ${screenId} not found!`);
    }
}

function showMyReports() {
    // Close dropdown before switching
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
        userDropdown.classList.add('hidden');
    }
    
    showScreen('my-reports-screen');
    loadMyReportsPage();
}

async function loadMyReportsPage() {
    try {
        // Show loading
        document.getElementById('loading-reports').classList.remove('hidden');
        document.getElementById('empty-reports-state').classList.add('hidden');
        
        const response = await fetch('/api/user_reports');
        const data = await response.json();
        
        const tbody = document.getElementById('reports-table-body');
        const emptyState = document.getElementById('empty-reports-state');
        
        if (data.success && data.reports.length > 0) {
            tbody.innerHTML = data.reports.map(report => `
                <tr>
                    <td class="py-3 px-4 text-sm">${report.id}</td>
                    <td class="py-3 px-4 text-sm">${report.problem_type}</td>
                    <td class="py-3 px-4 text-sm">${report.location}</td>
                    <td class="py-3 px-4 text-sm">${formatDate(report.date)}</td>
                    <td class="py-3 px-4">
                        <span class="report-status-badge report-status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-sm">${report.priority}</td>
                    <td class="py-3 px-4">
                        <button onclick="viewReport(${report.id})" class="text-primary-600 hover:text-primary-700 text-sm">
                            View
                        </button>
                    </td>
                </tr>
            `).join('');
            emptyState.classList.add('hidden');
        } else {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
        }
        
        // Update stats
        updateMyReportsStats(data.reports || []);
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    } finally {
        document.getElementById('loading-reports').classList.add('hidden');
    }
}

function updateMyReportsStats(reports) {
    const total = reports.length;
    const pending = reports.filter(r => r.status === 'Pending').length;
    const inProgress = reports.filter(r => r.status === 'In Progress').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('inprogress-count').textContent = inProgress;
    document.getElementById('resolved-count').textContent = resolved;
}

function filterReports(searchTerm) {
    const rows = document.querySelectorAll('#reports-table-body tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const isVisible = text.includes(searchTerm.toLowerCase());
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });
}

function filterByStatus(status) {
    const rows = document.querySelectorAll('#reports-table-body tr');
    
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
            return;
        }
        
        const statusCell = row.querySelector('.report-status-badge');
        if (statusCell) {
            const rowStatus = statusCell.textContent.toLowerCase().replace(' ', '-');
            row.style.display = rowStatus === status ? '' : 'none';
        }
    });
}

// Dropdown functions
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
}

function toggleAdminDropdown() {
    const dropdown = document.getElementById('admin-dropdown-menu');
    dropdown.classList.toggle('hidden');
}

// Admin functions
async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    await loadAdminStats();
    await loadAllReports();
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('total-reports').textContent = stats.total || 0;
            document.getElementById('pending-reports').textContent = stats.pending || 0;
            document.getElementById('in-progress-reports').textContent = stats.in_progress || 0;
            document.getElementById('resolved-reports').textContent = stats.resolved || 0;
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
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                        </div>
                    ` : ''}
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" style="flex: 2; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; min-width: 120px;" onchange="handleStatusChange(this, ${report.id})">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 8px 12px; flex: 1;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
                                <strong style="color: #1e40af; font-size: 14px;">Resolution Details</strong>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                    ${report.auditor_name ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-user-check"></i> Audited by: ${report.auditor_name}
                                        </span>
                                    ` : ''}
                                    ${report.resolved_at ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-clock"></i> Resolved: ${report.resolved_at}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            ${report.resolution_notes ? `
                                <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">No resolution details provided.</p>
                            `}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>No reports found</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load all reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

function handleStatusChange(selectElement, reportId) {
    const newStatus = selectElement.value;
    console.log(`🔄 Status change for report ${reportId}: ${newStatus}`);
    
    if (newStatus === 'Resolved') {
        showResolutionModal(reportId, selectElement);
    } else {
        updateStatus(reportId, newStatus);
    }
}

async function updateStatus(reportId, newStatus) {
    try {
        console.log(`📤 Updating report ${reportId} to status: ${newStatus}`);
        const response = await fetch('/api/update_report_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: reportId,
                status: newStatus
            })
        });
        
        const data = await response.json();
        console.log('Status update response:', data);
        
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
    console.log(`📝 Showing resolution modal for report ${reportId}`);
    
    const modal = document.getElementById('resolution-modal');
    modal.dataset.reportId = reportId;
    modal.dataset.selectElement = selectElement.id;
    
    // Clear previous inputs
    document.getElementById('auditor-name').value = '';
    document.getElementById('resolution-notes').value = '';
    
    // Show modal
    modal.classList.remove('hidden');
    document.getElementById('auditor-name').focus();
}

function cancelResolution() {
    console.log('❌ Resolution cancelled');
    const modal = document.getElementById('resolution-modal');
    const selectElement = document.getElementById(modal.dataset.selectElement);
    
    // Reset to previous value (In Progress)
    if (selectElement) {
        selectElement.value = 'In Progress';
    }
    
    modal.classList.add('hidden');
    document.getElementById('auditor-name').value = '';
    document.getElementById('resolution-notes').value = '';
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const auditorName = document.getElementById('auditor-name').value;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    
    console.log(`📤 Submitting resolution for report ${reportId}:`, { auditorName, resolutionNotes });
    
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: parseInt(reportId),
                status: 'Resolved',
                auditor_name: auditorName,
                resolution_notes: resolutionNotes
            })
        });
        
        const data = await response.json();
        console.log('Resolution submission response:', data);
        
        if (data.success) {
            showSnackbar('Report resolved successfully!', 'success');
            modal.classList.add('hidden');
            document.getElementById('auditor-name').value = '';
            document.getElementById('resolution-notes').value = '';
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
            // Reset the select element if failed
            const selectElement = document.getElementById(modal.dataset.selectElement);
            if (selectElement) {
                selectElement.value = 'In Progress';
            }
        }
    } catch (error) {
        console.error('Resolution error:', error);
        showSnackbar('Failed to update report', 'error');
        // Reset the select element if error
        const selectElement = document.getElementById(modal.dataset.selectElement);
        if (selectElement) {
            selectElement.value = 'In Progress';
        }
    }
}

// Set up resolution button event listener
document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('confirm-resolution-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', submitResolution);
    }
});

// Utility functions
function showSnackbar(message, type = 'success') {
    // Create snackbar if it doesn't exist
    let snackbar = document.getElementById('snackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        snackbar.className = 'snackbar hidden';
        document.body.appendChild(snackbar);
    }
    
    snackbar.textContent = message;
    snackbar.className = `snackbar ${type}`;
    snackbar.classList.remove('hidden');
    
    setTimeout(() => {
        snackbar.classList.add('hidden');
    }, 3000);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        console.log('Loading screen hidden');
    }
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

// Dark Mode Functions
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateDarkModeIcons(true);
    }
}

function toggleDarkMode() {
    const html = document.documentElement;
    const isDarkMode = html.getAttribute('data-theme') === 'dark';
    
    if (isDarkMode) {
        html.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
        updateDarkModeIcons(false);
        showSnackbar('Light mode enabled', 'success');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
        updateDarkModeIcons(true);
        showSnackbar('Dark mode enabled', 'success');
    }
}

function updateDarkModeIcons(isDark) {
    const toggleBtns = document.querySelectorAll('.dark-mode-toggle');
    
    toggleBtns.forEach(btn => {
        const moonIcon = btn.querySelector('.fa-moon');
        const sunIcon = btn.querySelector('.fa-sun');
        
        if (moonIcon && sunIcon) {
            if (isDark) {
                moonIcon.classList.add('hidden');
                sunIcon.classList.remove('hidden');
            } else {
                moonIcon.classList.remove('hidden');
                sunIcon.classList.add('hidden');
            }
        }
    });
}

// Initialize dark mode on load
initDarkMode();

// Export functions for global use
window.showScreen = showScreen;
window.toggleDarkMode = toggleDarkMode;
window.togglePassword = togglePassword;
window.toggleUserMenu = toggleUserMenu;
window.toggleAdminDropdown = toggleAdminDropdown;
window.showMyReports = showMyReports;
window.logout = logout;
window.openCamera = openCamera;
window.closeCamera = closeCamera;
window.capturePhoto = capturePhoto;
window.handleFileUpload = handleFileUpload;
window.removePhoto = removePhoto;
