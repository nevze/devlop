# API Platform

A comprehensive REST API platform built with Node.js, Express, MongoDB, and modern technologies. This platform provides a robust foundation for building scalable APIs with features like authentication, rate limiting, caching, and more.

## Features

### Core Infrastructure
- Express.js web framework
- MongoDB with Mongoose ODM
- JWT authentication
- Firebase Google authentication
- Redis for rate limiting and caching

### Authentication System
- Email/password authentication with validation
- Firebase Google OAuth integration
- JWT token management (access & refresh tokens)
- Password hashing using bcrypt
- Password reset functionality

### API Management
- Custom API key generation and validation
- Rate limiting based on membership tiers
- Request logging and analytics
- API versioning support

### Membership System
- Tier management (Free/Basic/Pro/Enterprise)
- Usage tracking and limiting
- Automated tier expiration handling
- Payment integration (Stripe/PayPal)

### Admin Features
- Comprehensive user management dashboard
- User activity monitoring
- Membership management
- API usage analytics
- Audit logging system

### Web Scraping System
- Cheerio/Puppeteer for scraping
- Proxy rotation system
- Data validation and cleaning
- Caching mechanism for scraped data
- Rate limiting for external requests

### Security Features
- CSRF protection
- XSS prevention
- Rate limiting
- Input sanitization
- SQL injection prevention
- Data encryption at rest
- Secure password storage
- HTTPS enforcement
- Secure headers
- Cookie security

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- Firebase project (for Google authentication)
- SendGrid account (for production emails)
- Stripe account (for payments)

## Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/yourusername/api-platform.git
cd api-platform
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create environment file:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Update the \`.env\` file with your configuration values

5. Create required directories:
\`\`\`bash
mkdir logs
mkdir public/images
\`\`\`

6. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

See \`.env.example\` for all required environment variables.

## Project Structure

\`\`\`
src/
├── config/             # Configuration files
├── controllers/        # Route controllers
├── middleware/         # Custom middleware
├── models/            # Database models
├── routes/            # API routes
├── utils/             # Utility functions
├── views/             # Email templates
│   └── emails/
└── server.js          # Application entry point
\`\`\`

## API Documentation

### Authentication Endpoints

- \`POST /auth/register\` - Register new user
- \`POST /auth/login\` - Login user
- \`POST /auth/logout\` - Logout user
- \`POST /auth/refresh-token\` - Refresh JWT token
- \`POST /auth/forgot-password\` - Request password reset
- \`POST /auth/reset-password/:token\` - Reset password
- \`GET /auth/verify-email/:token\` - Verify email
- \`POST /auth/google\` - Google authentication

### User Endpoints

- \`GET /api/users/me\` - Get current user
- \`PUT /api/users/me\` - Update user profile
- \`POST /api/users/api-keys\` - Generate API key
- \`GET /api/users/usage\` - Get API usage stats

### Admin Endpoints

- \`GET /api/admin/users\` - List all users
- \`GET /api/admin/analytics\` - Get platform analytics
- \`PUT /api/admin/users/:id\` - Update user
- \`DELETE /api/admin/users/:id\` - Delete user

## Development

### Running Tests
\`\`\`bash
npm test
\`\`\`

### Linting
\`\`\`bash
npm run lint
\`\`\`

### Building for Production
\`\`\`bash
npm run build
\`\`\`

## Deployment

1. Set up production environment variables
2. Build the application
3. Start the server:
\`\`\`bash
npm start
\`\`\`

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens are short-lived
- Rate limiting is enabled
- Input validation and sanitization
- CORS is configured
- Security headers are set
- HTTPS is enforced in production

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@yourdomain.com or join our Discord server. 