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
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                        <select class="status-select" data-report-id="${report.id}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-outline" onclick="updateStatus(${report.id}, this.previousElementSibling.value)" style="padding: 8px 12px;">
                            Update
                        </button>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
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

