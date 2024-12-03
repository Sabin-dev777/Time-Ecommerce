const express = require('express');
const path = require('path');
const mime = require('mime-types');
const dbConnect = require('./db/dbConnect');
const cookie = require('cookie-parser');
const nocache = require('nocache');
const session = require('express-session');
const dotenv = require('dotenv').config(); // Load environment variables

const app = express();

// Database connection
dbConnect();

// Middleware setup
app.use('/user-assets/magiczoom/magiczoom.css', (req, res, next) => {
    res.type('text/css'); // Set the MIME type to text/css
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookie());
app.use(nocache());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
const userRoute = require('./routes/userRoute');
app.use('/', userRoute);
const adminRoute = require('./routes/adminRoute');
app.use('/admin', adminRoute);
const productRoute = require('./routes/productRoute');
app.use('/product', productRoute);

// Start server with port from .env or fallback to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
