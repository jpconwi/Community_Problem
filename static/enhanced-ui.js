// enhanced-ui.js - Enhanced UI Functions

let currentPage = 1;
const itemsPerPage = 10;

// Initialize Enhanced UI
function initEnhancedUI() {
    console.log('🚀 Initializing Enhanced UI...');
    
    // Setup dark mode
    initDarkMode();
    
    // Setup problem type buttons
    setupProblemTypeButtons();
    
    // Setup form validation
    setupFormValidation();
    
    // Load initial data
    if (currentUser) {
        updateUserInitials();
        loadDashboardStats();
        loadRecentReports();
    }
    
    // Setup event listeners
    setupEnhancedEventListeners();
}

// Initialize Dark Mode
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateDarkModeIcons(true);
    }
    
    // Add event listener for dark mode toggle
    document.querySelectorAll('[onclick*="toggleDarkMode"]').forEach(btn => {
        btn.addEventListener('click', toggleDarkMode);
    });
}

// Toggle Dark Mode
function toggleDarkMode() {
    const html = document.documentElement;
    const isDarkMode = html.getAttribute('data-theme') === 'dark';
    
    if (isDarkMode) {
        html.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
        updateDarkModeIcons(false);
        showToast('Light mode enabled', 'Switched to light theme', 'info');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
        updateDarkModeIcons(true);
        showToast('Dark mode enabled', 'Switched to dark theme', 'info');
    }
}

// Update Dark Mode Icons
function updateDarkModeIcons(isDark) {
    document.querySelectorAll('.fa-moon, .fa-sun').forEach(icon => {
        if (icon.classList.contains('fa-moon')) {
            icon.style.display = isDark ? 'none' : 'inline-block';
        }
        if (icon.classList.contains('fa-sun')) {
            icon.style.display = isDark ? 'inline-block' : 'none';
        }
    });
}

// Setup Problem Type Buttons
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
            hiddenInput.value = this.dataset.type;
        });
    });
}

// Setup Enhanced Event Listeners
function setupEnhancedEventListeners() {
    // User menu toggle
    const userMenuBtn = document.querySelector('[onclick="toggleUserMenu"]');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', toggleUserMenu);
    }
    
    // Search functionality
    const searchInput = document.getElementById('report-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterReports, 300));
    }
    
    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', goToPrevPage);
        nextBtn.addEventListener('click', goToNextPage);
    }
}

// Toggle User Menu
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Update User Initials
function updateUserInitials() {
    const initials = getInitials(currentUser?.username || 'User');
    
    document.querySelectorAll('#user-avatar, .user-avatar-large').forEach(el => {
        if (el.id === 'user-avatar' || el.classList.contains('user-avatar-large')) {
            el.textContent = initials;
        }
    });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// Show Toast Notification
function showToast(title, message, type = 'info') {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} bg-white border-l-4 rounded-lg shadow-lg p-4 min-w-80 max-w-md animate-slide-in`;
    
    const icons = {
        success: 'fa-check-circle text-green-500',
        error: 'fa-exclamation-circle text-red-500',
        warning: 'fa-exclamation-triangle text-yellow-500',
        info: 'fa-info-circle text-blue-500'
    };
    
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <i class="fas ${icons[type]} text-xl mt-0.5"></i>
            <div class="flex-1">
                <div class="font-semibold text-gray-800">${title}</div>
                <div class="text-sm text-gray-600 mt-1">${message}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('animate-slide-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            
            // Update stats on dashboard
            document.getElementById('user-reports-count').textContent = stats.my_reports || 0;
            document.getElementById('user-pending-count').textContent = stats.pending || 0;
            document.getElementById('user-inprogress-count').textContent = stats.in_progress || 0;
            document.getElementById('user-resolved-count').textContent = stats.resolved || 0;
            
            // Update welcome name
            const welcomeName = document.getElementById('welcome-name');
            if (welcomeName && currentUser) {
                welcomeName.textContent = currentUser.username.split(' ')[0];
            }
        }
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

// Load Recent Reports
async function loadRecentReports() {
    try {
        const container = document.getElementById('recent-reports-list');
        if (!container) return;
        
        // Show loading
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        `;
        
        const response = await fetch('/api/user_reports?limit=5');
        const data = await response.json();
        
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

// Helper Functions
function getReportTypeIcon(type) {
    const icons = {
        'Pothole': 'fa-road',
        'Garbage Collection': 'fa-trash',
        'Street Light': 'fa-lightbulb',
        'Water Leak': 'fa-tint',
        'Noise Complaint': 'fa-volume-up',
        'Other': 'fa-ellipsis-h'
    };
    return icons[type] || 'fa-file-alt';
}

function getReportTypeColor(type) {
    const colors = {
        'Pothole': 'bg-orange-100 text-orange-600',
        'Garbage Collection': 'bg-red-100 text-red-600',
        'Street Light': 'bg-yellow-100 text-yellow-600',
        'Water Leak': 'bg-blue-100 text-blue-600',
        'Noise Complaint': 'bg-purple-100 text-purple-600',
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

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Filter Reports
function filterReports(searchTerm) {
    const rows = document.querySelectorAll('#reports-table-body tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const isVisible = text.includes(searchTerm.toLowerCase());
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });
    
    // Show/hide empty state
    const emptyState = document.getElementById('empty-reports-state');
    if (emptyState) {
        emptyState.classList.toggle('hidden', visibleCount > 0);
    }
}

// Filter by Status
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

// Pagination Functions
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadReports();
    }
}

function goToNextPage() {
    currentPage++;
    loadReports();
}

// Setup Form Validation
function setupFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                showToast('Validation Error', 'Please fill in all required fields correctly', 'error');
            }
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const requiredInputs = form.querySelectorAll('[required]');
    
    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            markInvalid(input, 'This field is required');
            isValid = false;
        } else {
            markValid(input);
        }
    });
    
    return isValid;
}

function markInvalid(input, message) {
    input.classList.add('border-red-500');
    input.classList.remove('border-gray-300');
    
    // Remove existing error
    let error = input.parentElement.querySelector('.error-message');
    if (error) error.remove();
    
    // Add error message
    error = document.createElement('div');
    error.className = 'error-message text-sm text-red-600 mt-1';
    error.textContent = message;
    input.parentElement.appendChild(error);
}

function markValid(input) {
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-300');
    
    // Remove error message
    const error = input.parentElement.querySelector('.error-message');
    if (error) error.remove();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other scripts to load
    setTimeout(initEnhancedUI, 100);
});
