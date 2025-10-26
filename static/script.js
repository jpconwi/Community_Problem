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
}

function handleStatusChange(selectElement, reportId) {
    if (selectElement.value === 'Resolved') {
        showResolutionModal(reportId, selectElement);
    }
}

function showResolutionModal(reportId, selectElement) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('resolution-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'resolution-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Resolution Details</h3>
                    <button class="close-btn" onclick="document.getElementById('resolution-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Please provide details on how this issue was resolved:</p>
                    <div class="form-group">
                        <textarea id="resolution-notes" placeholder="Describe the resolution steps, materials used, or any other relevant details..." rows="4" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; resize: vertical;"></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="cancelResolution()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" id="confirm-resolution-btn">
                        Submit Resolution
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Store the current select element and report ID
    modal.dataset.reportId = reportId;
    modal.dataset.selectElement = selectElement.id;
    
    // Show modal
    modal.classList.remove('hidden');
    document.getElementById('resolution-notes').focus();
}

function cancelResolution() {
    const modal = document.getElementById('resolution-modal');
    const selectElement = document.getElementById(modal.dataset.selectElement);
    
    // Reset to previous value
    selectElement.value = 'In Progress';
    
    modal.classList.add('hidden');
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    
    if (!resolutionNotes.trim()) {
        showSnackbar('Please provide resolution details', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/update_report_with_resolution', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: reportId,
                status: 'Resolved',
                resolution_notes: resolutionNotes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report resolved and notification email sent!');
            modal.classList.add('hidden');
            document.getElementById('resolution-notes').value = '';
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        showSnackbar('Failed to update report', 'error');
    }
}

// Update the existing updateStatus function to handle Resolved status differently
async function updateStatus(reportId, newStatus) {
    console.log(`Updating report ${reportId} to status: ${newStatus}`);
    
    try {
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
        console.log('Update response:', data);
        
        if (data.success) {
            showSnackbar('Status updated successfully!');
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Update status error:', error);
        showSnackbar('Failed to update status', 'error');
    }
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    
    console.log(`Submitting resolution for report ${reportId}:`, resolutionNotes);
    
    if (!resolutionNotes.trim()) {
        showSnackbar('Please provide resolution details', 'error');
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
                resolution_notes: resolutionNotes
            })
        });
        
        const data = await response.json();
        console.log('Resolution response:', data);
        
        if (data.success) {
            showSnackbar('Report resolved and notification sent!');
            modal.classList.add('hidden');
            document.getElementById('resolution-notes').value = '';
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Submit resolution error:', error);
        showSnackbar('Failed to update report', 'error');
    }
}

// Add event listener for the resolution modal button
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'confirm-resolution-btn') {
        submitResolution();
    }
});


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

// Delete report functions
async function deleteReport(reportId, isAdmin = false) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        return;
    }
    
    try {
        const endpoint = isAdmin ? '/api/delete_report' : '/api/delete_user_report';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: reportId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report deleted successfully!');
            // Reload the appropriate list
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

// Add confirmation modal for delete (optional enhancement)
function showDeleteConfirmation(reportId, isAdmin = false) {
    const modal = document.getElementById('delete-confirmation-modal');
    if (!modal) {
        // Create modal if it doesn't exist
        createDeleteConfirmationModal();
    }
    
    const modalInstance = document.getElementById('delete-confirmation-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    // Set up the confirmation button
    confirmBtn.onclick = function() {
        deleteReport(reportId, isAdmin);
        modalInstance.classList.add('hidden');
    };
    
    modalInstance.classList.remove('hidden');
}

function createDeleteConfirmationModal() {
    const modalHTML = `
        <div id="delete-confirmation-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Delete Report</h3>
                    <button class="close-btn" onclick="document.getElementById('delete-confirmation-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete this report?</p>
                    <p style="color: #ef4444; font-size: 14px; margin-top: 10px;">This action cannot be undone.</p>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('delete-confirmation-modal').classList.add('hidden')">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-danger" id="confirm-delete-btn">
                        Delete Report
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
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
        showSnackbar('Logging in...');
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
            
            if (currentUser.role === 'admin') {
                console.log('Redirecting to admin dashboard...');
                showScreen('admin-dashboard');
                await loadAdminDashboard();
            } else {
                console.log('Redirecting to user dashboard...');
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            showSnackbar('Login successful!');
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
        showSnackbar('Creating account...');
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
            showSnackbar('Account created successfully!');
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

async function logout() {
    try {
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            photoData = null;
            showScreen('login-screen');
            showSnackbar('Logged out successfully!');
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Dashboard functions
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

// Report functions
async function handleReportSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    const priority = document.getElementById('priority').value;
    
    if (!problemType || !location || !issue) {
        showSnackbar('Please fill in all required fields!', 'error');
        return;
    }
    
    try {
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
        
        if (data.success) {
            showSnackbar('Report submitted successfully!');
            document.getElementById('report-form').reset();
            removePhoto();
            await loadStats();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        showSnackbar('Failed to submit report. Please try again.', 'error');
    }
}

// Photo functions
function openCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-view');
    
    modal.classList.remove('hidden');
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(mediaStream) {
            stream = mediaStream;
            video.srcObject = stream;
        })
        .catch(function(error) {
            console.error('Camera error:', error);
            showSnackbar('Failed to access camera', 'error');
            closeCamera();
        });
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
    showSnackbar('Photo captured successfully!');
}

function handleFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showSnackbar('Please select a valid image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        photoData = e.target.result;
        
        // Show preview
        const preview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = photoData;
        preview.classList.remove('hidden');
        
        showSnackbar('Photo uploaded successfully!');
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoData = null;
    document.getElementById('photo-preview').classList.add('hidden');
}

// Navigation functions
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`Screen ${screenId} is now active`);
    } else {
        console.error(`Screen ${screenId} not found!`);
    }
}

function showMyReports() {
    showScreen('my-reports-screen');
    loadMyReports();
}

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
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                        </div>
                    ` : ''}
                    ${report.status === 'Resolved' && report.resolution_notes ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #10b981;">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                <i class="fas fa-check-circle" style="color: #10b981; margin-right: 8px;"></i>
                                <strong style="color: #047857; font-size: 14px;">Admin Resolution:</strong>
                            </div>
                            <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4; background: white; padding: 10px; border-radius: 6px; border: 1px solid #d1fae5;">
                                ${report.resolution_notes}
                            </p>
                        </div>
                    ` : ''}
                    ${report.status === 'Resolved' && !report.resolution_notes ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <div style="display: flex; align-items: center;">
                                <i class="fas fa-info-circle" style="color: #f59e0b; margin-right: 8px;"></i>
                                <strong style="color: #d97706; font-size: 14px;">Status: Resolved</strong>
                            </div>
                            <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
                                Your report has been marked as resolved. No additional details were provided by the admin.
                            </p>
                        </div>
                    ` : ''}
                    <div class="report-actions" style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, false)" style="padding: 8px 12px; font-size: 12px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No reports yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

function showNotifications() {
    showScreen('notifications-screen');
    loadNotifications();
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const notificationsList = document.getElementById('notifications-list');
        
        if (data.success && data.notifications.length > 0) {
            notificationsList.innerHTML = data.notifications.map(notification => `
                <div class="notification-card">
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${notification.created_at}</div>
                </div>
            `).join('');
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-bell-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No notifications</p>
                </div>
            `;
        }
        
        // Update badge
        await loadNotificationsCount();
    } catch (error) {
        console.error('Failed to load notifications:', error);
        showSnackbar('Failed to load notifications', 'error');
    }
}

// Admin functions
async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const adminContainer = document.querySelector('.admin-container');
    adminContainer.innerHTML = `
        <div class="screen-header">
            <h2>Admin Dashboard</h2>
            <button class="btn btn-danger" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        </div>
        
        <div class="admin-stats" id="admin-stats">
            <!-- Stats will be loaded here -->
        </div>
        
        <div class="card">
            <h3>Recent Reports</h3>
            <div id="admin-reports-list">
                <!-- Reports will be loaded here -->
            </div>
        </div>
    `;
    
    await loadAdminStats();
    await loadAllReports();
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            const statsContainer = document.getElementById('admin-stats');
            
            statsContainer.innerHTML = `
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.total}</div>
                    <div class="admin-stat-label">Total Reports</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.pending}</div>
                    <div class="admin-stat-label">Pending</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.in_progress}</div>
                    <div class="admin-stat-label">In Progress</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.resolved}</div>
                    <div class="admin-stat-label">Resolved</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

async function loadAllReports(page = 1) {
    try {
        const response = await fetch(`/api/all_reports?page=${page}&per_page=15`);
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
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" style="flex: 2; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; min-width: 120px;" onchange="handleStatusChange(this, ${report.id})">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-outline" onclick="updateStatus(${report.id}, this.parentElement.querySelector('.status-select').value)" style="padding: 8px 12px; flex: 1;">
                            Update
                        </button>
                        <button class="btn btn-outline" onclick="loadReportDetails(${report.id})" style="padding: 8px 12px; flex: 1;">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 8px 12px; flex: 1;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.resolution_notes ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                            <strong style="color: #1e40af; font-size: 14px;">Resolution Details:</strong>
                            <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                        </div>
                    ` : ''}
                </div>
            `).join('');
            
            // Add pagination controls
            if (data.pagination.pages > 1) {
                reportsList.innerHTML += `
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
                        ${data.pagination.page > 1 ? 
                            `<button class="btn btn-outline" onclick="loadAllReports(${data.pagination.page - 1})" style="padding: 8px 16px;">
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>` : ''
                        }
                        <span style="padding: 8px 16px; color: #64748b;">
                            Page ${data.pagination.page} of ${data.pagination.pages}
                        </span>
                        ${data.pagination.page < data.pagination.pages ? 
                            `<button class="btn btn-outline" onclick="loadAllReports(${data.pagination.page + 1})" style="padding: 8px 16px;">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>` : ''
                        }
                    </div>
                `;
            }
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

async function loadReportDetails(reportId) {
    try {
        const response = await fetch(`/api/report_details/${reportId}`);
        const data = await response.json();
        
        if (data.success) {
            const report = data.report;
            // Show details in a modal or expand the report card
            showReportDetailsModal(report);
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to load report details:', error);
        showSnackbar('Failed to load report details', 'error');
    }
}

function showReportDetailsModal(report) {
    // Create and show a modal with full report details including photo
    const modalHTML = `
        <div id="report-details-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Report Details</h3>
                    <button class="close-btn" onclick="document.getElementById('report-details-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
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
                            <div class="report-photo" style="margin-top: 15px;">
                                <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px;">
                            </div>
                        ` : ''}
                        ${report.resolution_notes ? `
                            <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                                <strong style="color: #1e40af; font-size: 14px;">Resolution Details:</strong>
                                <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('report-details-modal').classList.add('hidden')">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('report-details-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('report-details-modal').classList.remove('hidden');
}

async function updateStatus(reportId, newStatus) {
    try {
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
        
        if (data.success) {
            showSnackbar('Status updated successfully!');
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        showSnackbar('Failed to update status', 'error');
    }
}

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
        loadingScreen.classList.remove('active');
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

// Temporary fix function
function forceShowLogin() {
    console.log('Manual override: forcing login screen');
    hideLoading();
    showScreen('login-screen');
}









