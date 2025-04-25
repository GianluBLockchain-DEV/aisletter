# rewrite better the code, write comment on each functions for better read the code. output in single '.md' file

Below is a cleaned-up, well-commented, and more readable version of your Node.js + Express authentication project. Each function is documented for clarity. Copy and save this as a single `.md` file.

---

# Node.js Express Authentication System

A step-by-step implementation of user registration, login, logout, password reset, and email notifications using JWT, Nodemailer, Sequelize, and MySQL.

---

## **Project Structure**

```
project-root/
  .env
  package.json
  app.js
  config/
    db.js
  models/
    User.js
  controllers/
    authController.js
  routes/
    auth.js
  utils/
    email.js
  views/
    register.html
    login.html
    forgot.html
    reset.html
```

---

## **Environment Variables (`.env`)**

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_db_password
DB_NAME=auth_demo
JWT_RESET_SECRET=your_jwt_secret_key
JWT_RESET_EXPIRES=1h
SESSION_SECRET=another_secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
BASE_URL=http://localhost:3000
```

---

## **1. Express App Initialization (`app.js`)**

```js
require('dotenv').config(); // Load environment variables

const express = require('express');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const sequelize = require('./config/db');

const app = express();

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.json()); // Parse JSON bodies

// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Secret for signing session ID cookie
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set true if using HTTPS
  })
);

// Mount authentication routes
app.use('/', authRoutes);

// Sync database and start server
sequelize.sync().then(() =&gt; {
  app.listen(process.env.PORT, () =&gt; {
    console.log(`Server running on port ${process.env.PORT}`);
  });
});
```

---

## **2. Database Connection (`config/db.js`)**

```js
const { Sequelize } = require("sequelize");
require("dotenv").config();

/**
 * Initializes Sequelize instance for MySQL connection.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false, // Disable SQL logging
  }
);

module.exports = sequelize;
```

---

## **3. User Model (`models/User.js`)**

```js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

/**
 * User model definition: id, email, password.
 */
class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "User",
    timestamps: true, // Adds createdAt &amp; updatedAt
  }
);

module.exports = User;
```

---

## **4. Email Utility (`utils/email.js`)**

```js
const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * Configures Nodemailer SMTP transporter.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // Use TLS if true
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends an HTML email.
 * @param {Object} param0 - { to, subject, html }
 */
async function sendEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

module.exports = sendEmail;
```

---

## **5. Auth Controller (`controllers/authController.js`)**

```js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/email');
require('dotenv').config();

/**
 * Registers a new user, hashes password, sends welcome email.
 */
exports.register = async (req, res) =&gt; {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send('Email and password required.');

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ email, password: hashed });

  const html = '<p>Welcome! Your account has been created.</p>';
  await sendEmail({ to: user.email, subject: 'Welcome!', html });

  res.send('Registration successful. Please log in.');
};

/**
 * Logs in a user, checks credentials, creates session.
 */
exports.login = async (req, res) =&gt; {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(400).send('Invalid credentials.');

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).send('Invalid credentials.');

  req.session.userId = user.id;
  res.redirect('/dashboard'); // Redirect to protected page
};

/**
 * Logs out the user by destroying session and clearing cookie.
 */
exports.logout = (req, res) =&gt; {
  req.session.destroy(err =&gt; {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

/**
 * Handles forgot password: sends reset link if user exists.
 */
exports.forgotPassword = async (req, res) =&gt; {
  const { email } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user)
    return res.send('If that email exists, you will receive reset instructions.');

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_RESET_SECRET,
    { expiresIn: process.env.JWT_RESET_EXPIRES }
  );
  const resetURL = `${process.env.BASE_URL}/reset?token=${token}`;
  const html = `<p>Click <a href="${resetURL}">here</a> to reset your password.</p>`;

  await sendEmail({ to: user.email, subject: 'Password Reset', html });
  res.send('Password reset instructions sent to email.');
};

/**
 * Resets password using the provided JWT token.
 */
exports.resetPassword = async (req, res) =&gt; {
  const { token, password } = req.body;
  try {
    const payload = jwt.verify(token, process.env.JWT_RESET_SECRET);
    const hashed = await bcrypt.hash(password, 12);
    await User.update(
      { password: hashed },
      { where: { id: payload.id } }
    );
    res.send('Password has been reset.');
  } catch (err) {
    res.status(400).send('Token invalid or expired.');
  }
};
```

---

## **6. Auth Routes (`routes/auth.js`)**

```js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Registration form (GET)
router.get('/register', (req, res) =&gt; res.sendFile('register.html', { root: './views' }));
// Handle registration (POST)
router.post('/register', authController.register);

// Login form (GET)
router.get('/login', (req, res) =&gt; res.sendFile('login.html', { root: './views' }));
// Handle login (POST)
router.post('/login', authController.login);

// Logout route
router.get('/logout', authController.logout);

// Forgot password form (GET)
router.get('/forgot', (req, res) =&gt; res.sendFile('forgot.html', { root: './views' }));
// Handle forgot password (POST)
router.post('/forgot', authController.forgotPassword);

// Reset password form (GET)
router.get('/reset', (req, res) =&gt; res.sendFile('reset.html', { root: './views' }));
// Handle reset (POST)
router.post('/reset', authController.resetPassword);

module.exports = router;
```

---

## **7. Basic HTML Views (`views/*.html`)**

**register.html**

```html
&lt;form action="/register" method="POST"&gt; &lt;input type="email"
name="email" placeholder="Email" required /&gt; &lt;input type="password"
name="password" placeholder="Password" required /&gt; &lt;button
type="submit"&gt;Register&lt;/button&gt; &lt;/form&gt;
```

**login.html**

```html
&lt;form action="/login" method="POST"&gt; &lt;input type="email" name="email"
placeholder="Email" required /&gt; &lt;input type="password" name="password"
placeholder="Password" required /&gt; &lt;button
type="submit"&gt;Login&lt;/button&gt; &lt;/form&gt;
```

**forgot.html**

```html
&lt;form action="/forgot" method="POST"&gt; &lt;input type="email" name="email"
placeholder="Your registered email" required /&gt; &lt;button
type="submit"&gt;Send Reset Link&lt;/button&gt; &lt;/form&gt;
```

**reset.html**

```html
&lt;form action="/reset" method="POST"&gt; &lt;input type="hidden" name="token"
value="&lt;%= token %&gt;" /&gt; &lt;input type="password" name="password"
placeholder="New password" required /&gt; &lt;button type="submit"&gt;Reset
Password&lt;/button&gt; &lt;/form&gt;
```

---

## **How to Run**

- Install dependencies: `npm install`
- Configure `.env`
- Start server: `node app.js`
- Access:
  - Register: `http://localhost:3000/register`
  - Login: `http://localhost:3000/login`
  - Forgot Password: `http://localhost:3000/forgot`

---

**Every function is now clearly documented, and the code is organized for readability and maintainability.**
