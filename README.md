# Suaza ERP System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-blue.svg)](https://www.postgresql.org/)

> Complete Enterprise Resource Planning (ERP) system designed specifically for agricultural and commercial enterprises.

## 🎯 Overview

Suaza ERP is a comprehensive business management system that streamlines operations for agricultural enterprises. Built with modern web technologies, it provides a robust platform for managing customers, products, sales, and generating detailed business reports.

### Key Highlights

- 🏢 **Enterprise-Ready**: Scalable architecture for growing businesses
- 🔐 **Secure**: JWT authentication with role-based access control
- 📱 **Responsive**: Modern UI that works on all devices
- 🚀 **Fast**: Optimized performance with TypeScript and modern React
- 📊 **Analytics**: Comprehensive reporting and dashboard features

## ✨ Features

### 🧑‍💼 Customer Management
- Complete customer database with document validation
- Credit limit management and tracking
- Advanced search and filtering capabilities
- Support for multiple document types (CC, CE, NIT, RUT, PASSPORT)

### 📦 Product Management
- Real-time inventory control
- Product categorization system
- Barcode support for quick identification
- Low stock alerts and notifications
- Cost and pricing management

### 💰 Sales Management
- Multi-product sales transactions
- Multiple payment methods (Cash, Credit, Transfer)
- Automatic tax calculations (VAT 19%)
- Electronic invoicing capabilities
- Support for "General Customer" sales

### 📈 Reporting System
- Sales reports by date range
- Best-selling products analysis
- Inventory status reports
- Customer statistics and insights
- Interactive dashboard with key metrics

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Material-UI (MUI)** - Professional component library
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication
- **React Hot Toast** - User notifications

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **Prisma ORM** - Database toolkit and query builder
- **JWT** - JSON Web Token authentication
- **Express Validator** - Input validation middleware
- **Rate Limiting** - Security and performance

### Database
- **PostgreSQL** - Robust relational database
- **Prisma Migrations** - Database schema management
- **Optimized Relationships** - Efficient data modeling

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (version 12 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/suaza-erp-system.git
   cd suaza-erp-system
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create a new PostgreSQL database
   # Option 1: Using psql command line
   psql -U postgres
   CREATE DATABASE suaza_db;
   \q
   
   # Option 2: Using pgAdmin (GUI)
   # 1. Open pgAdmin
   # 2. Right-click on "Databases"
   # 3. Select "Create" > "Database"
   # 4. Name: suaza_db
   # 5. Click "Save"
   ```

5. **Configure environment variables**
   ```bash
   # Backend
   cd ../backend
   cp .env.example .env
   # Edit .env with your database and JWT configurations
   
   # Frontend
   cd ../frontend
   cp .env.example .env
   # Edit .env with your API URL
   ```

6. **Set up the database**
   ```bash
   cd ../backend
   npx prisma migrate dev
   npx prisma generate
   ```

7. **Start the development servers**
   ```bash
   # Terminal 1: Start backend server
   cd backend
   npm run dev
   
   # Terminal 2: Start frontend server
   cd frontend
   npm start
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📁 Project Structure

```
suaza-erp-system/
├── backend/                 # Backend application
│   ├── src/
│   │   ├── middleware/      # Authentication & validation
│   │   ├── routes/         # API endpoints
│   │   ├── utils/          # Utility functions
│   │   └── server.js       # Main server file
│   ├── prisma/             # Database schema & migrations
│   ├── package.json
│   └── .env.example
├── frontend/               # Frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts
│   │   └── App.tsx         # Main app component
│   ├── public/             # Static assets
│   ├── package.json
│   └── .env.example
├── deployment/             # Deployment configurations
├── docker-compose.yml      # Docker setup
└── README.md
```

## 🔧 Configuration

### Database Setup

#### PostgreSQL Installation

**Windows:**
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Install pgAdmin (optional, for GUI management)

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Or download from postgresql.org
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Database Configuration

1. **Create the database:**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE suaza_db;
   
   # Create user (optional, for security)
   CREATE USER suaza_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE suaza_db TO suaza_user;
   
   # Exit
   \q
   ```

2. **Update your .env file:**
   ```env
   # For local development
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/suaza_db"
   
   # Or with custom user
   DATABASE_URL="postgresql://suaza_user:your_password@localhost:5432/suaza_db"
   ```

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/suaza_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"

# Server
PORT=5000
NODE_ENV=development

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_APP_NAME=Suaza ERP
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Customer Endpoints
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Product Endpoints
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Sales Endpoints
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Create new sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

### Reports Endpoints
- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/inventory` - Inventory reports
- `GET /api/dashboard` - Dashboard statistics

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# Run all tests
npm run test:all
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Error: connection refused
# Solution: Make sure PostgreSQL is running
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS
# Windows: Start PostgreSQL service from Services

# Error: database does not exist
# Solution: Create the database
psql -U postgres -c "CREATE DATABASE suaza_db;"

# Error: authentication failed
# Solution: Check your password in .env file
# Make sure the password matches your PostgreSQL user password
```

#### Prisma Issues
```bash
# Error: Prisma Client not generated
# Solution: Generate Prisma Client
npx prisma generate

# Error: Migration failed
# Solution: Reset and re-run migrations
npx prisma migrate reset
npx prisma migrate dev

# Error: Schema not found
# Solution: Check if schema.prisma exists in backend/prisma/
```

#### Frontend Issues
```bash
# Error: Cannot find module
# Solution: Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install

# Error: Port 3000 already in use
# Solution: Kill the process or use different port
npm start -- --port 3001
```

#### Backend Issues
```bash
# Error: Port 5000 already in use
# Solution: Change port in .env or kill the process
# In .env: PORT=5001

# Error: JWT secret not set
# Solution: Add JWT_SECRET to .env file
JWT_SECRET="your-super-secret-jwt-key-here"
```

## 🚀 Deployment

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

### Manual Deployment

#### Backend Deployment
```bash
cd backend
npm run build
npm start
```

#### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy the 'build' folder to your hosting service
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Your Name**
- Email: your-email@example.com
- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/your-profile)

## 🙏 Acknowledgments

- [Material-UI](https://mui.com/) for the amazing component library
- [Prisma](https://www.prisma.io/) for the excellent ORM
- [React](https://reactjs.org/) for the powerful UI framework
- [PostgreSQL](https://www.postgresql.org/) for the robust database
- [Express.js](https://expressjs.com/) for the web framework

## 📞 Support

If you have any questions or need help:

- 📧 Email: support@suaza-erp.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/suaza-erp-system/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/suaza-erp-system/discussions)

---

<div align="center">
  <p>Made with ❤️ for agricultural enterprises</p>
  <p>⭐ Star this repository if you found it helpful!</p>
</div>