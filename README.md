# Nesa ERP System

A comprehensive Enterprise Resource Planning (ERP) system built with modern web technologies. The system helps organizations manage their resources, projects, tasks, and performance metrics efficiently.

## Features

- **User Management**
  - Role-based access control
  - User authentication and authorization
  - Profile management

- **Project Management**
  - Project creation and tracking
  - Task assignment and monitoring
  - Timeline management
  - Resource allocation

- **Task Management**
  - Task creation and assignment
  - Progress tracking
  - Priority management
  - Due date monitoring

- **Performance Monitoring**
  - Real-time performance metrics
  - Custom dashboards
  - Analytics and reporting
  - KPI tracking

- **Communication**
  - Notification system
  - Daily reports
  - Team collaboration tools

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- Radix UI Components
- React Hook Form with Zod validation
- Various UI libraries (FullCalendar, Recharts, etc.)

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ORM
- Redis for caching
- Bull for job queues
- JWT authentication
- Winston for logging
- Various security middlewares

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nesaERP.git
   cd nesaERP
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   # Install backend dependencies
   cd myERP-backend
   npm install

   # Install frontend dependencies
   cd ../myERP-frontend
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Backend setup
   cd ../myERP-backend
   cp env.example .env
   # Edit .env with your configuration
   ```

4. Start the development servers:
   ```bash
   # Start backend server
   cd myERP-backend
   npm run dev

   # In a new terminal, start frontend server
   cd myERP-frontend
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Project Structure

```
nesaERP/
├── myERP-frontend/          # Frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Next.js pages
│   │   ├── styles/        # CSS styles
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
│
└── myERP-backend/          # Backend application
    ├── controllers/       # Route controllers
    ├── models/           # Database models
    ├── routes/           # API routes
    ├── middleware/       # Custom middleware
    ├── utils/           # Utility functions
    └── templates/       # Email templates
```

## API Documentation

The API documentation is available at http://localhost:5000/api-docs when running in development mode.

## Security Features

- CORS protection
- XSS prevention
- CSRF protection
- Rate limiting
- Request sanitization
- Helmet security headers
- MongoDB query sanitization

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@nesaerp.com or open an issue in the repository. 