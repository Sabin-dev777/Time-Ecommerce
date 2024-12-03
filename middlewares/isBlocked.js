const User = require('../model/userModel');
const jwt = require('jsonwebtoken');
const generateToken = require('../config/jwtToken');
const isBlocked = async (req, res, next) => {
    try {
      const token = req.cookies.jwt; // Check for JWT in cookies
  
      // If no token exists, allow the user to proceed (e.g., to the login page)
      if (!token) {
        return next(); // Skip the middleware for unauthenticated users
      }
  
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // Decode the JWT
      const user = await User.findById(decodedToken.id); // Find the user by ID
  
      if (user) {
        if (user.isBlocked) {
          // If the user is blocked, render the 403 page
          return res.status(403).render('403', {
            message: 'Your account has been blocked. Please contact support for further assistance.',
          });
        }
        req.user = user; // Attach user data to the request object
        return next(); // Proceed to the next middleware or route handler
      } else {
        // If user is not found, redirect to login
        req.session.returnTo = req.originalUrl; // Store the current URL for redirection
        return res.redirect('/login');
      }
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        // Handle invalid or expired token by redirecting to login
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
      }
      console.error('Error checking if user is blocked:', error);
      return res.status(500).render('500', { message: 'Internal Server Error' }); // Handle unexpected errors
    }
  };
  
  module.exports = isBlocked;
  