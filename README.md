# CommunityCare - Report System

A web application for reporting community issues with photo upload capabilities.

## Features

- User registration and authentication
- Report submission with photo upload/capture
- Real-time notifications
- Admin dashboard for report management
- Responsive design for mobile and desktop

## Deployment on Render

### Prerequisites

- GitHub account
- Render account

### Steps

1. **Fork/Upload to GitHub**
   - Upload all files to a GitHub repository

2. **Create Database on Render**
   - Go to Render Dashboard
   - Click "New" → "PostgreSQL"
   - Choose "Free" plan
   - Set database name to `community_reports`
   - Create database

3. **Deploy Web Service**
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure service:
     - Name: `community-report-system`
     - Environment: `Python`
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `gunicorn app:app`
   - Add Environment Variables:
     - `DATABASE_URL`: (Copy from your PostgreSQL database)
     - `SECRET_KEY`: (Generate a random secret key)

4. **Access Your Application**
   - Your app will be available at the provided Render URL

## Default Admin Account

- Email: `admin@community.com`
- Password: `admin123`

## Local Development

1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Set environment variables:
   - `DATABASE_URL`: Your database URL
   - `SECRET_KEY`: Your secret key
6. Run the application: `python app.py`

## Environment Variables

- `DATABASE_URL`: PostgreSQL database connection string
- `SECRET_KEY`: Flask secret key for session security

## Database Schema

The application uses the following main tables:
- `users`: User accounts and profiles
- `reports`: Community issue reports
- `notifications`: User notifications
- `admin_logs`: Admin activity logs