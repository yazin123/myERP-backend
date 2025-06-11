# Nesa ERP Backend

A robust and scalable Enterprise Resource Planning (ERP) system built with Node.js, Express, and MongoDB.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Features

- 🔐 Complete Authentication System with JWT
- 👥 Role-Based Access Control (RBAC)
- 📧 Email Verification & Password Reset
- 🔒 Two-Factor Authentication (2FA)
- 📱 Session Management & Device Tracking
- 🚀 Real-time Notifications via WebSocket
- 📊 Comprehensive Admin Dashboard
- 📁 File Upload & Management
- 📝 Audit Logging
- 🔍 Advanced Search & Filtering
- 📈 Performance Monitoring
- 🛡️ Security Features

## Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 5.0
- Redis (for caching and rate limiting)
- SMTP Server (for email functionality)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/nesa-erp.git
cd nesa-erp/myERP-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit the .env file with your configuration (see Environment Variables section)
```

4. Initialize the database:
```bash
# This command will:
# - Set up initial database schema
# - Create required indexes
# - Initialize RBAC permissions
npm run init:db
```

5. Create superadmin account:
```bash
# This will create an admin account with the credentials from your .env file
# Default email: admin@nesaerp.com
# Default password: Check your .env file or console output
npm run init:superadmin
```

6. Start the development server:
```bash
npm run dev
# Server will start at http://localhost:5000
# API docs will be available at http://localhost:5000/api-docs
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Application
NODE_ENV=development        # development, production, or test
PORT=5000                  # Port number for the server
API_VERSION=v1            # API version for versioning
FRONTEND_URL=http://localhost:3000  # URL of your frontend application

# Database
MONGODB_URI=mongodb://localhost:27017/nesa-erp  # MongoDB connection string
REDIS_URL=redis://localhost:6379                # Redis connection string

# Authentication
JWT_SECRET=your-jwt-secret          # Secret key for JWT signing
JWT_ACCESS_EXPIRY=15m              # Access token expiry (15 minutes)
JWT_REFRESH_EXPIRY=7d              # Refresh token expiry (7 days)
COOKIE_SECRET=your-cookie-secret    # Secret for cookie signing

# Email
SMTP_HOST=smtp.example.com         # SMTP server host
SMTP_PORT=587                      # SMTP server port
SMTP_USER=your-email@example.com   # SMTP username
SMTP_PASS=your-password           # SMTP password
EMAIL_FROM=noreply@nesaerp.com    # Sender email address

# Security
ALLOWED_ORIGINS=http://localhost:3000  # Comma-separated list of allowed CORS origins
RATE_LIMIT_WINDOW=15                   # Rate limit window in minutes
RATE_LIMIT_MAX=100                     # Maximum requests per window

# File Upload
UPLOAD_DIR=uploads                     # Directory for file uploads
MAX_FILE_SIZE=5MB                      # Maximum file size (in bytes, e.g., 5MB = 5 * 1024 * 1024)
```

## API Documentation

### Base URL
```
https://api.nesaerp.com/api
```

### Authentication
All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <access_token>
```

### 1. Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string",
  "remember": "boolean"
}
```

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

### 2. Password Management

#### Forgot Password
```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "string"
}
```

#### Reset Password
```http
POST /auth/reset-password/:token
Content-Type: application/json

{
  "password": "string"
}
```

#### Change Password
```http
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### 3. Two-Factor Authentication

#### Enable 2FA
```http
POST /auth/2fa/enable
Authorization: Bearer <token>
```

#### Verify 2FA
```http
POST /auth/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "string"
}
```

### 4. Session Management

#### Get Active Sessions
```http
GET /auth/sessions
Authorization: Bearer <token>
```

#### Terminate Session
```http
DELETE /auth/sessions/:sessionId
Authorization: Bearer <token>
```

### 5. User Management

#### Get Profile
```http
GET /auth/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "string",
  "phone": "string",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "postalCode": "string"
  }
}
```

### 6. Common Routes

#### Projects
```http
# Get all projects
GET /projects
Authorization: Bearer <token>
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 10)
  - search: string
  - status: 'active' | 'completed' | 'on-hold'

# Create new project
POST /projects
Authorization: Bearer <token>
Content-Type: application/json
{
  "name": "string",
  "description": "string",
  "startDate": "date",
  "endDate": "date",
  "status": "active" | "completed" | "on-hold",
  "members": ["userId"],
  "department": "departmentId"
}

# Get project by ID
GET /projects/:id
Authorization: Bearer <token>

# Update project
PUT /projects/:id
Authorization: Bearer <token>
Content-Type: application/json
{
  "name": "string",
  "description": "string",
  "status": "string",
  // ... other fields
}

# Delete project
DELETE /projects/:id
Authorization: Bearer <token>
```

#### Tasks
```http
# Get all tasks
GET /tasks
Authorization: Bearer <token>
Query Parameters:
  - page: number
  - limit: number
  - status: 'pending' | 'in-progress' | 'completed'
  - priority: 'low' | 'medium' | 'high'
  - projectId: string

# Create task
POST /tasks
Authorization: Bearer <token>
Content-Type: application/json
{
  "title": "string",
  "description": "string",
  "projectId": "string",
  "assignedTo": "userId",
  "priority": "low" | "medium" | "high",
  "dueDate": "date"
}

# Other task endpoints follow similar pattern...
```

#### Departments
```http
GET    /departments
POST   /departments
GET    /departments/:id
PUT    /departments/:id
DELETE /departments/:id
```

### 7. WebSocket Notifications

Connect to:
```
ws://api.nesaerp.com/notifications?token=<access_token>
```

Notification Types:
```javascript
{
  "type": "NOTIFICATION_TYPE",  // Type of notification
  "data": {                    // Notification data
    "id": "string",           // Notification ID
    "title": "string",        // Notification title
    "message": "string",      // Notification message
    "timestamp": "date",      // When the notification was created
    "read": boolean,          // Whether the notification has been read
    "metadata": {             // Additional data specific to notification type
      // ... varies by type
    }
  }
}
```

Common Notification Types:
- `TASK_ASSIGNED`: When a task is assigned to you
- `TASK_UPDATED`: When a task you're involved with is updated
- `PROJECT_UPDATE`: Updates about projects you're part of
- `MENTION`: When you're mentioned in comments
- `DEADLINE_REMINDER`: Reminders about upcoming deadlines
- `SYSTEM_ALERT`: System-wide notifications

## Development

### Running in Development Mode
```bash
npm run dev
```

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage Requirements
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Deployment

1. Build the application:
```bash
npm run build
```

2. Start in production:
```bash
npm start
```

### Using Docker
```bash
# Build image
docker build -t nesa-erp-backend .

# Run container
docker run -p 5000:5000 nesa-erp-backend
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@nesaerp.com or open an issue in the repository. 