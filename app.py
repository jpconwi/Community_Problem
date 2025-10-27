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
import smtplib
from email.mime.text import MIMEText  # Fixed import
from email.mime.multipart import MIMEMultipart  # Fixed import
import ssl

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

db = SQLAlchemy(app)

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
    resolution_notes = db.Column(db.Text)
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
    max_retries = 5
    for attempt in range(max_retries):
        try:
            print(f"🔄 Database initialization attempt {attempt + 1}/{max_retries}")
            
            # Test database connection
            db.session.execute(text('SELECT 1'))
            print("✅ Database connection successful")
            
            # Create all tables
            db.create_all()
            print("✅ Tables created/verified")
            
            # Add resolution_notes column if it doesn't exist
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
                print(f"⚠️ Column check failed: {e}")
                # Try alternative method
                try:
                    db.session.execute(text('SELECT resolution_notes FROM reports LIMIT 1'))
                    print("✅ resolution_notes column exists (alternative check)")
                except:
                    print("🔄 Adding resolution_notes column (alternative method)...")
                    db.session.execute(text('ALTER TABLE reports ADD COLUMN resolution_notes TEXT'))
                    db.session.commit()
            
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
                # Ensure admin has correct role
                if admin.role != 'admin':
                    admin.role = 'admin'
                    db.session.commit()
                    print("✅ Admin role updated")
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
            time.sleep(2 * (attempt + 1))  # Exponential backoff

# Email Configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_SENDER = "kamikazoozin@gmail.com"
EMAIL_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', 'rzbmwuyjxureticw')

def send_resolution_email(user_email, username, report_details, resolution_notes, admin_name):
    """Send resolution email notification using Gmail SMTP"""
    try:
        # Validate email parameters
        if not user_email or not username:
            print("❌ Missing email parameters")
            return False
            
        # Validate Gmail credentials
        if not EMAIL_SENDER or not EMAIL_PASSWORD:
            print("❌ Gmail credentials not configured")
            return False
            
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"✅ Report Resolved: {report_details.get('problem_type', 'Unknown')}"
        message["From"] = f"CommunityCare <{EMAIL_SENDER}>"
        message["To"] = user_email
        
        # Plain text version
        text = f"""
Dear {username},

Great news! Your community report has been resolved by our admin team.

📋 REPORT DETAILS:
• Problem Type: {report_details['problem_type']}
• Location: {report_details['location']}
• Issue: {report_details['issue']}
• Status: ✅ Resolved

📝 RESOLUTION DETAILS:
{resolution_notes}

👨‍💼 Resolved by: {admin_name}

Thank you for helping us improve our community! Your reports make a difference.

Best regards,
CommunityCare Team

---
This is an automated notification. Please do not reply to this email.
        """.strip()

        # HTML version
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 10px; overflow: hidden; }}
        .header {{ background: #2563eb; color: white; padding: 25px; text-align: center; }}
        .content {{ padding: 25px; }}
        .report-details {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }}
        .resolution {{ background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a; }}
        .footer {{ text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }}
        .status-badge {{ background: #16a34a; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏘️ CommunityCare</h1>
            <h2>Report Successfully Resolved</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{username}</strong>,</p>
            <p>Great news! Your community report has been resolved by our admin team.</p>
            
            <div class="report-details">
                <h3>📋 Report Details</h3>
                <p><strong>Problem Type:</strong> {report_details['problem_type']}</p>
                <p><strong>Location:</strong> {report_details['location']}</p>
                <p><strong>Issue:</strong> {report_details['issue']}</p>
                <p><strong>Status:</strong> <span class="status-badge">RESOLVED</span></p>
            </div>
            
            <div class="resolution">
                <h3>📝 Resolution Details</h3>
                <p>{resolution_notes}</p>
            </div>
            
            <p><strong>👨‍💼 Resolved by:</strong> {admin_name}</p>
            
            <p>Thank you for helping us keep our community clean and safe! Your active participation makes a real difference.</p>
            
            <div class="footer">
                <p>This is an automated message from CommunityCare System</p>
                <p>Please do not reply to this email</p>
            </div>
        </div>
    </div>
</body>
</html>
        """
        
        # Add both versions to the message
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Create secure connection with Gmail SMTP server
        context = ssl.create_default_context()
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_SENDER, user_email, message.as_string())
        
        print(f"✅ Email sent successfully to {user_email}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        print(f"❌ Gmail authentication failed. Check your app password.")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ SMTP error sending email to {user_email}: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Failed to send email to {user_email}: {str(e)}")
        return False

# Routes

@app.route('/api/update_report_with_resolution', methods=['POST'])
def update_report_with_resolution():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        data = request.get_json()
        report = Report.query.get(data.get('report_id'))
        if report:
            old_status = report.status
            report.status = data.get('status')
            report.resolution_notes = data.get('resolution_notes', '')
            db.session.commit()
            
            # Get user details for email notification
            user = User.query.get(report.user_id)
            admin_user = User.query.get(session['user_id'])
            
            # Create notification for the user
            notification = Notification(
                user_id=report.user_id,
                report_id=report.id,
                message=f'Your report "{report.problem_type}" has been resolved: {data.get("resolution_notes", "No details provided")}',
                type='status_update'
            )
            db.session.add(notification)
            db.session.commit()
            
            # Send email notification if:
            # 1. User has email
            # 2. Status changed to Resolved
            # 3. Resolution notes are provided (but don't require them)
            email_sent = False
            email_error = None
            
            if (user and user.email and 
                report.status == 'Resolved' and 
                old_status != 'Resolved'):
                
                report_details = {
                    'problem_type': report.problem_type,
                    'location': report.location,
                    'issue': report.issue
                }
                
                # Use resolution notes if provided, otherwise use default message
                resolution_notes = data.get('resolution_notes', 'The issue has been resolved by our team.')
                
                email_sent = send_resolution_email(
                    user.email,
                    user.username,
                    report_details,
                    resolution_notes,
                    admin_user.username if admin_user else 'Admin'
                )
                
                if email_sent:
                    print(f"✅ Resolution email sent to {user.email}")
                    # Log the email action
                    admin_log = AdminLog(
                        admin_id=session['user_id'],
                        action='send_resolution_email',
                        target_type='user',
                        target_id=user.id,
                        details=f'Sent resolution email for report #{report.id} to {user.email}'
                    )
                    db.session.add(admin_log)
                    db.session.commit()
                else:
                    print(f"❌ Failed to send email to {user.email}")
                    email_error = "Failed to send email notification"
            
            message = 'Status updated successfully!'
            if email_sent:
                message += ' Email notification sent to user.'
            elif email_error:
                message += f' {email_error}.'
            
            return jsonify({
                'success': True, 
                'message': message,
                'email_sent': email_sent
            })
        else:
            return jsonify({'success': False, 'message': 'Report not found'})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating report: {e}")
        return jsonify({'success': False, 'message': 'Failed to update status'})

@app.route('/api/debug/test_email')
def debug_test_email():
    """Debug endpoint to test email functionality"""
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    try:
        test_email = session.get('email')
        if not test_email:
            return jsonify({'success': False, 'message': 'No email found in session'})
        
        test_details = {
            'problem_type': 'Test Issue',
            'location': 'Test Location',
            'issue': 'This is a test issue to verify email functionality'
        }
        
        success = send_resolution_email(
            test_email,
            session.get('username', 'Test User'),
            test_details,
            'This is a test resolution message to verify email functionality is working correctly.',
            'Test Admin'
        )
        
        return jsonify({
            'success': True,
            'email_sent': success,
            'message': f'Test email {"sent successfully" if success else "failed to send"} to {test_email}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Test failed: {str(e)}'})

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
        report = Report(
            user_id=session['user_id'],
            name=session['username'],
            problem_type=data.get('problem_type'),
            location=data.get('location'),
            issue=data.get('issue'),
            priority=data.get('priority', 'Medium'),
            photo_data=data.get('photo_data'),
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
    
    reports = Report.query.filter_by(user_id=session['user_id']).order_by(Report.created_at.desc()).all()
    reports_data = []
    for report in reports:
        report_data = {
            'id': report.id,
            'problem_type': report.problem_type,
            'location': report.location,
            'issue': report.issue,
            'status': report.status,
            'priority': report.priority,
            'date': report.date,
            'photo_data': report.photo_data
        }
        
        # Safely add resolution_notes if the column exists
        try:
            if hasattr(report, 'resolution_notes'):
                report_data['resolution_notes'] = report.resolution_notes
            else:
                report_data['resolution_notes'] = None
        except:
            report_data['resolution_notes'] = None
            
        reports_data.append(report_data)
    
    return jsonify({'success': True, 'reports': reports_data})

@app.route('/api/stats')
def get_stats():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    user_id = session['user_id']
    role = session.get('role', 'user')
    
    if role == 'admin':
        total = Report.query.count()
        pending = Report.query.filter_by(status='Pending').count()
        in_progress = Report.query.filter_by(status='In Progress').count()
        resolved = Report.query.filter_by(status='Resolved').count()
        
        stats = {
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'resolved': resolved
        }
    else:
        my_reports = Report.query.filter_by(user_id=user_id).count()
        pending = Report.query.filter_by(user_id=user_id, status='Pending').count()
        
        stats = {
            'my_reports': my_reports,
            'pending': pending
        }
    
    return jsonify({'success': True, 'stats': stats})

@app.route('/api/all_reports')
def get_all_reports():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    reports = Report.query.order_by(Report.created_at.desc()).all()
    reports_data = []
    for report in reports:
        user = User.query.get(report.user_id)
        report_data = {
            'id': report.id,
            'problem_type': report.problem_type,
            'location': report.location,
            'issue': report.issue,
            'status': report.status,
            'priority': report.priority,
            'date': report.date,
            'photo_data': report.photo_data,
            'username': user.username if user else 'Unknown'
        }
        
        # Safely add resolution_notes if the column exists
        try:
            if hasattr(report, 'resolution_notes'):
                report_data['resolution_notes'] = report.resolution_notes
            else:
                report_data['resolution_notes'] = None
        except:
            report_data['resolution_notes'] = None
            
        reports_data.append(report_data)
    
    return jsonify({'success': True, 'reports': reports_data})

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
