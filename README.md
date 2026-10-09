# 🛡️ AI-Powered Spam & Phishing Detection System

A comprehensive web-based security platform that uses AI to detect spam messages, phishing attempts, and malicious URLs. The system provides real-time threat detection, an interactive chatbot for security queries, and an admin dashboard for system management.

## ✨ Features

### 🔍 Core Detection Capabilities
- **Email/Message Analysis**: Real-time spam and phishing detection using AI algorithms
- **URL Safety Checker**: Analyze links for potential phishing threats
- **Pattern Recognition**: Advanced detection of suspicious patterns and keywords
- **Threat Scoring**: Confidence-based threat assessment with detailed explanations

### 💬 Interactive Chatbot
- AI-powered security assistant
- Answer queries about phishing and spam threats
- Provide guidance on safe online practices
- Real-time conversation support

### 📊 User Dashboard
- Detection history tracking
- Detailed threat analysis reports
- Export functionality for records
- Personal threat statistics

### 🔐 Admin Panel
- User management system
- System-wide analytics and statistics
- Blocklist management for domains and keywords
- Support ticket handling
- Audit logging

### 🎯 Additional Features
- User authentication (Login/Register)
- Secure JWT-based sessions
- Support ticket system
- Responsive design for all devices
- Dark-themed modern UI

## 🚀 Technology Stack

### Frontend
- **HTML5/CSS3**: Modern, responsive UI
- **JavaScript (ES6+)**: Interactive client-side functionality
- **Fetch API**: RESTful API communication

### Backend
- **Node.js**: Server runtime
- **Express.js**: Web application framework
- **SQLite**: Lightweight database with sql.js
- **JWT**: Secure authentication tokens
- **bcryptjs**: Password hashing

### Security
- Password encryption
- JWT authentication
- CORS enabled
- Input validation
- XSS protection

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/shashikanthmogaveera/Phishing-Detection.git
cd Phishing-Detection
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `server` directory:
```env
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
PORT=3000
```

**Important**: Change the JWT_SECRET to a strong, unique value in production!

### 4. Initialize the Database
The SQLite database will be automatically created when you first run the server. Default admin credentials will be set up.

### 5. Start the Server
```bash
# From the server directory
npm start
```

The server will start on `http://localhost:3000`

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

## 👤 Default Admin Credentials

For first-time access to the admin panel:
- **Email**: `admin@cybershield.com`
- **Password**: `admin123`

⚠️ **Important**: Change these credentials immediately after first login!

## 📁 Project Structure

```
AI-Powered Spam & Phishing Detection System/
├── server/
│   ├── routes/
│   │   ├── auth.js           # Authentication routes
│   │   ├── detections.js     # Detection API endpoints
│   │   ├── chat.js           # Chatbot functionality
│   │   ├── admin.js          # Admin panel routes
│   │   ├── blocklist.js      # Blocklist management
│   │   ├── contact.js        # Contact form handler
│   │   └── support.js        # Support ticket system
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── db.js                 # Database configuration
│   ├── index.js              # Main server file
│   ├── package.json          # Dependencies
│   └── .env                  # Environment variables
├── admin.html                # Admin dashboard
├── admin.js                  # Admin functionality
├── admin.css                 # Admin styles
├── detection.html            # Main detection interface
├── detection.js              # Detection logic
├── detection.css             # Detection styles
├── chatbot.html              # Chatbot interface
├── chatbot.js                # Chatbot logic
├── chatbot.css               # Chatbot styles
├── history.html              # Detection history
├── history.js                # History functionality
├── history.css               # History styles
├── support.html              # Support page
├── support.js                # Support functionality
├── support.css               # Support styles
├── login.html                # Login page
├── signup.html               # Registration page
├── auth.js                   # Authentication logic
├── auth.css                  # Auth page styles
├── index.html                # Landing page
├── style.css                 # Global styles
├── app.js                    # Main application logic
├── api.js                    # API configuration
├── HOW_TO_RUN.md            # Detailed setup guide
└── README.md                 # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Detection
- `POST /api/detections/check` - Analyze message/URL for threats
- `GET /api/detections/history` - Get user's detection history

### Chatbot
- `POST /api/chat` - Send message to chatbot

### Admin (Protected)
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id` - Update user status
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/blocklist` - Get blocklist items
- `POST /api/admin/blocklist` - Add blocklist item
- `DELETE /api/admin/blocklist/:id` - Remove blocklist item

### Support
- `POST /api/support/tickets` - Create support ticket
- `GET /api/support/tickets` - Get user's tickets
- `GET /api/admin/support/tickets` - Get all tickets (admin)
- `PUT /api/admin/support/tickets/:id` - Update ticket status

## 🎯 Usage Guide

### For Regular Users

1. **Register an Account**
   - Click "Sign Up" on the home page
   - Fill in your details
   - Verify your email address

2. **Detect Threats**
   - Navigate to "Detection" page
   - Enter a message, email content, or URL
   - Click "Analyze"
   - Review the threat assessment and recommendations

3. **View History**
   - Access "History" from the navigation
   - See all your previous detections
   - Export reports if needed

4. **Use Chatbot**
   - Click on the chatbot icon
   - Ask questions about security
   - Get instant guidance

### For Administrators

1. **Access Admin Panel**
   - Log in with admin credentials
   - Navigate to `/admin.html`

2. **Manage Users**
   - View all registered users
   - Activate/deactivate accounts
   - Delete spam accounts

3. **Manage Blocklist**
   - Add malicious domains
   - Add spam keywords
   - Remove false positives

4. **Handle Support Tickets**
   - Review user inquiries
   - Update ticket status
   - Respond to issues

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure session management
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content sanitization
- **CORS Configuration**: Controlled cross-origin requests
- **Role-Based Access**: Admin vs User permissions

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is available
- Verify Node.js installation: `node --version`
- Ensure all dependencies are installed: `npm install`

### Database errors
- Delete `server/cybershield.db` and restart
- Check file permissions

### Login issues
- Clear browser cache and cookies
- Check JWT_SECRET in .env file
- Verify database contains user records

### API errors
- Check browser console for error messages
- Verify server is running
- Check network tab in developer tools

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Author

**Shashikanth Mogaveera**
- GitHub: [@shashikanthmogaveera](https://github.com/shashikanthmogaveera)

## 🙏 Acknowledgments

- Thanks to all contributors
- Inspired by modern cybersecurity needs
- Built with the goal of making the internet safer

## 📧 Support

For support, email your queries or create an issue in the GitHub repository.

## 🔮 Future Enhancements

- [ ] Machine learning model integration
- [ ] Email plugin for real-time scanning
- [ ] Browser extension
- [ ] Multi-language support
- [ ] Advanced reporting and analytics
- [ ] API rate limiting
- [ ] Two-factor authentication
- [ ] Mobile application

## 📊 Statistics

- **Detection Accuracy**: Based on pattern matching and AI analysis
- **Response Time**: < 500ms average
- **Supported Languages**: English
- **Database**: SQLite (lightweight, portable)

---

**Note**: This is a security tool for educational and practical purposes. Always keep your system updated and follow security best practices.

⭐ Star this repository if you find it helpful!
