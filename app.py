from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import base64
import os
import re
from flask_cors import CORS
from PIL import Image
import io
from flask_mail import Mail, Message

# Initialize Flask with explicit static folder paths
app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')

app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-2024')
CORS(app)

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://communitycare_user:3YInYGOvAJr8QvR0UxpMFP2aTapzHaHs@dpg-d3u5itn5r7bs73f91rrg-a/communitycare')

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_recycle': 300,
    'pool_pre_ping': True
}

# Email configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@communitycare.com')

db = SQLAlchemy(app)
mail = Mail(app)

# Database Models with extend_existing=True
class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Report(db.Model):
    __tablename__ = 'reports'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    problem_type = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    issue = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='Pending')
    priority = db.Column(db.String(20), default='Medium')
    photo_data = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    resolution_notes = db.Column(db.Text)  # Add this line for resolution notes
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    __tablename__ = 'notifications'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'))
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='status_update')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AdminLog(db.Model):
    __tablename__ = 'admin_logs'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Initialize database
with app.app_context():
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"🔄 Database initialization attempt {attempt + 1}/{max_retries}")
            
            # Test database connection
            db.session.execute(text('SELECT 1'))
            print("✅ Database connection successful")
            
            # Create all tables
            db.create_all()
            print("✅ Tables created/verified")
            
            # Check if resolution_notes column exists using inspector
            try:
                inspector = db.inspect(db.engine)
                columns = [col['name'] for col in inspector.get_columns('reports')]
                if 'resolution_notes' not in columns:
                    print("🔄 Adding resolution_notes column to reports table...")
                    db.session.execute(text('ALTER TABLE reports ADD COLUMN resolution_notes TEXT'))
                    db.session.commit()
                    print("✅ resolution_notes column added successfully")
                else:
                    print("✅ resolution_notes column already exists")
            except Exception as e:
                print(f"⚠️  Column check failed: {e}")
            
            # Create admin user if not exists
            admin = User.query.filter_by(email='admin@community.com').first()
            if not admin:
                print("🔄 Creating admin user...")
                admin = User(
                    username='admin',
                    password=generate_password_hash('admin123'),
                    email='admin@community.com',
                    role='admin'
                )
                db.session.add(admin)
                db.session.commit()
                print("✅ Admin user created successfully!")
            else:
                print(f"✅ Admin user already exists: {admin.username} (role: {admin.role})")
            
            print("✅ Database initialized successfully!")
            break
            
        except Exception as e:
            print(f"❌ Database initialization attempt {attempt + 1} failed: {e}")
            db.session.rollback()
            
            if attempt == max_retries - 1:
                print("💥 All database initialization attempts failed")
                print("🔄 Starting application anyway...")
            import time
            time.sleep(2)

# Email Functions
def send_resolution_email(user, report, resolution_notes):
    """Send email notification to user when their report is resolved"""
    try:
        subject = f"Your Report Has Been Resolved - {report.problem_type}"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }}
                .report-details {{ background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }}
                .status-resolved {{ color: #16a34a; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #64748b; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>CommunityCare</h1>
                    <p>Your Report Has Been Resolved!</p>
                </div>
                <div class="content">
                    <p>Hello <strong>{user.username}</strong>,</p>
                    <p>We're pleased to inform you that your community report has been resolved.</p>
                    
                    <div class="report-details">
                        <h3>Report Details:</h3>
                        <p><strong>Problem Type:</strong> {report.problem_type}</p>
                        <p><strong>Location:</strong> {report.location}</p>
                        <p><strong>Issue:</strong> {report.issue}</p>
                        <p><strong>Status:</strong> <span class="status-resolved">Resolved</span></p>
                        <p><strong>Resolution Date:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}</p>
                    </div>
                    
                    <div class="report-details">
                        <h3>Resolution Details:</h3>
                        <p>{resolution_notes or 'No additional details provided.'}</p>
                    </div>
                    
                    <p>Thank you for helping us improve our community!</p>
                    
                    <div class="footer">
                        <p>This is an automated message from CommunityCare Report System.</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Hello {user.username},
        
        Your community report has been resolved!
        
        Report Details:
        - Problem Type: {report.problem_type}
        - Location: {report.location}
        - Issue: {report.issue}
        - Status: Resolved
        - Resolution Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}
        
        Resolution Details:
        {resolution_notes or 'No additional details provided.'}
        
        Thank you for helping us improve our community!
        
        This is an automated message from CommunityCare Report System.
        """
        
        msg = Message(
            subject=subject,
            recipients=[user.email],
            html=html_body,
            body=text_body
        )
        
        mail.send(msg)
        print(f"✅ Resolution email sent to {user.email}")
        
    except Exception as e:
        print(f"❌ Failed to send email to {user.email}: {e}")
        raise

# Routes
@app.route('/api/update_report_with_resolution', methods=['POST'])
def update_report_with_resolution():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        data = request.get_json()
        report = Report.query.get(data.get('report_id'))
        if report:
            report.status = data.get('status')
            report.resolution_notes = data.get('resolution_notes', '')
            db.session.commit()
            
            # Get user details for email
            user = User.query.get(report.user_id)
            
            # Create notification for the user
            notification = Notification(
                user_id=report.user_id,
                report_id=report.id,
                message=f'Your report "{report.problem_type}" has been resolved: {data.get("resolution_notes", "No details provided")}',
                type='status_update'
            )
            db.session.add(notification)
            db.session.commit()
            
            # Send email notification
            if user and user.email:
                try:
                    send_resolution_email(user, report, data.get('resolution_notes', ''))
                except Exception as e:
                    print(f"Failed to send email: {e}")
                    # Don't fail the whole request if email fails
            
            return jsonify({'success': True, 'message': 'Status updated successfully and notification sent!'})
        else:
            return jsonify({'success': False, 'message': 'Report not found'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Failed to update status'})

@app.route('/api/delete_report', methods=['POST'])
def delete_report():
    """Delete a report - users can delete their own, admins can delete any"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        report_id = data.get('report_id')
        
        report = Report.query.get(report_id)
        if not report:
            return jsonify({'success': False, 'message': 'Report not found'})
        
        # Users can only delete their own reports, admins can delete any
        user_role = session.get('role', 'user')
        if user_role != 'admin' and report.user_id != session['user_id']:
            return jsonify({'success': False, 'message': 'Unauthorized to delete this report'})
        
        # Delete associated notifications first
        Notification.query.filter_by(report_id=report_id).delete()
        
        # Delete the report
        db.session.delete(report)
        db.session.commit()
        
        # Log admin action if admin deleted the report
        if user_role == 'admin':
            admin_log = AdminLog(
                admin_id=session['user_id'],
                action='delete_report',
                target_type='report',
                target_id=report_id,
                details=f'Deleted report #{report_id} by user #{report.user_id}'
            )
            db.session.add(admin_log)
            db.session.commit()
        
        return jsonify({'success': True, 'message': 'Report deleted successfully!'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Failed to delete report'})

@app.route('/api/delete_user_report', methods=['POST'])
def delete_user_report():
    """Endpoint specifically for users to delete their own reports"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        report_id = data.get('report_id')
        
        report = Report.query.filter_by(id=report_id, user_id=session['user_id']).first()
        if not report:
            return jsonify({'success': False, 'message': 'Report not found or unauthorized'})
        
        # Delete associated notifications
        Notification.query.filter_by(report_id=report_id).delete()
        
        # Delete the report
        db.session.delete(report)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Report deleted successfully!'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Failed to delete report'})


@app.route('/api/debug/check_admin')
def check_admin():
    """Check if admin user exists and can login"""
    try:
        admin = User.query.filter_by(email='admin@community.com').first()
        if admin:
            # Test password
            password_ok = check_password_hash(admin.password, 'admin123')
            return jsonify({
                'success': True,
                'admin_exists': True,
                'username': admin.username,
                'role': admin.role,
                'password_correct': password_ok,
                'user_id': admin.id
            })
        else:
            return jsonify({'success': True, 'admin_exists': False})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/debug/create_admin_force')
def create_admin_force():
    """Force create admin user"""
    try:
        # Delete existing admin if any
        admin = User.query.filter_by(email='admin@community.com').first()
        if admin:
            db.session.delete(admin)
            db.session.commit()
        
        # Create new admin
        new_admin = User(
            username='admin',
            password=generate_password_hash('admin123'),
            email='admin@community.com',
            role='admin'
        )
        db.session.add(new_admin)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Admin user created forcefully',
            'user': {
                'username': new_admin.username,
                'email': new_admin.email,
                'role': new_admin.role
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
                
@app.route('/api/debug/users')
def debug_users():
    """Debug endpoint to check all users"""
    try:
        users = User.query.all()
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'created_at': user.created_at.isoformat() if user.created_at else None
            })
        return jsonify({'success': True, 'users': users_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/submit_report', methods=['POST'])
def submit_report():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        
        # Compress photo data if it's too large
        photo_data = data.get('photo_data')
        if photo_data and len(photo_data) > 50000:  # If larger than 50KB
            # Truncate very large images to prevent memory issues
            photo_data = None
        
        report = Report(
            user_id=session['user_id'],
            name=session['username'],
            problem_type=data.get('problem_type'),
            location=data.get('location'),
            issue=data.get('issue'),
            priority=data.get('priority', 'Medium'),
            photo_data=photo_data,  # Use compressed version
            date=datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        )
        db.session.add(report)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Report submitted successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Failed to submit report'})

@app.route('/api/user_reports')
def get_user_reports():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    try:
        # Only select necessary columns - NO photo data in list view
        reports = db.session.query(
            Report.id,
            Report.problem_type,
            Report.location,
            Report.issue,
            Report.status,
            Report.priority,
            Report.date,
            Report.resolution_notes
        ).filter_by(user_id=session['user_id']).order_by(Report.created_at.desc()).all()
        
        reports_data = []
        for report in reports:
            # Truncate long issues for list view
            issue = report.issue
            if issue and len(issue) > 200:
                issue = issue[:200] + '...'
                
            report_data = {
                'id': report.id,
                'problem_type': report.problem_type,
                'location': report.location,
                'issue': issue,
                'status': report.status,
                'priority': report.priority,
                'date': report.date,
                'resolution_notes': report.resolution_notes
                # NO photo_data in list view - load separately if needed
            }
            reports_data.append(report_data)
        
        return jsonify({'success': True, 'reports': reports_data})
    
    except Exception as e:
        print(f"Error loading user reports: {e}")
        return jsonify({'success': False, 'message': 'Failed to load reports'})

@app.route('/api/stats')
def get_stats():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    user_id = session['user_id']
    role = session.get('role', 'user')
    
    try:
        if role == 'admin':
            total = db.session.query(Report.id).count()
            pending = db.session.query(Report.id).filter_by(status='Pending').count()
            in_progress = db.session.query(Report.id).filter_by(status='In Progress').count()
            resolved = db.session.query(Report.id).filter_by(status='Resolved').count()
            
            stats = {
                'total': total,
                'pending': pending,
                'in_progress': in_progress,
                'resolved': resolved
            }
        else:
            my_reports = db.session.query(Report.id).filter_by(user_id=user_id).count()
            pending = db.session.query(Report.id).filter_by(user_id=user_id, status='Pending').count()
            
            stats = {
                'my_reports': my_reports,
                'pending': pending
            }
        
        return jsonify({'success': True, 'stats': stats})
    
    except Exception as e:
        print(f"Error loading stats: {e}")
        return jsonify({'success': False, 'message': 'Failed to load statistics'})

@app.route('/api/all_reports')
def get_all_reports():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        # Use pagination by default with small page size
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 15, type=int)  # Small page size
        
        # Only select essential columns - NO photo data in list view
        reports_pagination = db.session.query(
            Report.id,
            Report.problem_type,
            Report.location,
            Report.issue,
            Report.status,
            Report.priority,
            Report.date,
            Report.resolution_notes,
            User.username
        ).join(User).order_by(Report.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        reports_data = []
        for report in reports_pagination.items:
            # Truncate long text fields
            issue = report.issue
            if issue and len(issue) > 200:
                issue = issue[:200] + '...'
                
            report_data = {
                'id': report.id,
                'problem_type': report.problem_type,
                'location': report.location,
                'issue': issue,
                'status': report.status,
                'priority': report.priority,
                'date': report.date,
                'username': report.username,
                'resolution_notes': report.resolution_notes
                # NO photo_data in list view - load separately if needed
            }
            reports_data.append(report_data)
        
        return jsonify({
            'success': True, 
            'reports': reports_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': reports_pagination.total,
                'pages': reports_pagination.pages
            }
        })
    
    except Exception as e:
        print(f"Error loading all reports: {e}")
        return jsonify({'success': False, 'message': 'Failed to load reports'})

@app.route('/api/report_details/<int:report_id>')
def get_report_details(report_id):
    """Get detailed report data including photos (load on demand)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({'success': False, 'message': 'Report not found'})
        
        # Check permissions
        user_role = session.get('role', 'user')
        if user_role != 'admin' and report.user_id != session['user_id']:
            return jsonify({'success': False, 'message': 'Unauthorized'})
        
        user = User.query.get(report.user_id)
        
        report_data = {
            'id': report.id,
            'problem_type': report.problem_type,
            'location': report.location,
            'issue': report.issue,
            'status': report.status,
            'priority': report.priority,
            'date': report.date,
            'photo_data': report.photo_data,  # Only load photos when specifically requested
            'username': user.username if user else 'Unknown',
            'resolution_notes': report.resolution_notes
        }
        
        return jsonify({'success': True, 'report': report_data})
    
    except Exception as e:
        print(f"Error loading report details: {e}")
        return jsonify({'success': False, 'message': 'Failed to load report details'})

@app.route('/api/update_report_status', methods=['POST'])
def update_report_status():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        data = request.get_json()
        report = Report.query.get(data.get('report_id'))
        if report:
            report.status = data.get('status')
            db.session.commit()
            return jsonify({'success': True, 'message': 'Status updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'Report not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': 'Failed to update status'})

# Basic notifications endpoints (simplified)
@app.route('/api/notifications')
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    notifications = Notification.query.filter_by(user_id=session['user_id']).order_by(Notification.created_at.desc()).limit(10).all()
    notifications_data = []
    for notification in notifications:
        notifications_data.append({
            'message': notification.message,
            'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M')
        })
    
    return jsonify({'success': True, 'notifications': notifications_data})

@app.route('/api/notifications_count')
def get_notifications_count():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    count = Notification.query.filter_by(user_id=session['user_id'], is_read=False).count()
    return jsonify({'count': count})
            
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

# API Routes (simplified for testing)
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        print(f"🔐 Login attempt for: {email}")
        
        if not email or not password:
            return jsonify({
                'success': False,
                'message': 'Email and password are required!'
            })
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"📋 User found: {user.username}, Role: {user.role}")
            if check_password_hash(user.password, password):
                session['user_id'] = user.id
                session['username'] = user.username
                session['role'] = user.role
                session['email'] = user.email
                
                print(f"✅ Login successful: {user.username} (role: {user.role})")
                
                return jsonify({
                    'success': True,
                    'message': f'Welcome back, {user.username}!',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'role': user.role,
                        'email': user.email
                    }
                })
            else:
                print("❌ Invalid password")
                return jsonify({
                    'success': False,
                    'message': 'Invalid email or password!'
                })
        else:
            print("❌ User not found")
            return jsonify({
                'success': False,
                'message': 'Invalid email or password!'
            })
            
    except Exception as e:
        print(f"💥 Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'Login failed. Please try again.'
        })

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if not all([username, email, password, confirm_password]):
            return jsonify({'success': False, 'message': 'Please fill in all required fields!'})
        
        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match!'})
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists!'})
        
        new_user = User(
            username=username,
            email=email,
            password=generate_password_hash(password)
        )
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully!'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': 'Error creating account!'})

@app.route('/api/user_info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    return jsonify({
        'success': True,
        'user': {
            'id': session.get('user_id'),
            'username': session.get('username'),
            'role': session.get('role'),
            'email': session.get('email')
        }
    })

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully!'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
