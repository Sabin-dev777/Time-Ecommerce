const User = require('../model/userModel');
const jwt = require('jsonwebtoken');
const generateToken = require('../config/jwtToken');
const isBlocked = async (req, res, next) => {
    try {
      const token = req.cookies.jwt; // Check for JWT in cookies
  
      if (!token) {
        req.session.returnTo = req.originalUrl; // Store the current URL for redirection after login
        return res.redirect('/login');
      }
  
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // Decode the JWT
      const user = await User.findById(decodedToken.id); // Find the user by ID
  
      if (user) {
        console.log('hi')
        if (user.isBlocked) {
          // If the user is blocked, render the 403 page
          return res.status(403).render('403', {
            message: 'Your account has been blocked. Please contact support for further assistance.',
          });
        }
        req.user = user; // Attach user data to the request object
        return next(); // Proceed to the next middleware or route handler
      } else {
        req.session.returnTo = req.originalUrl; // Store the current URL for redirection
        return res.redirect('/login'); // Redirect to login if user not found
      }
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return res.status(500).render('500', { message: 'Internal Server Error' }); // Handle unexpected errors
    }
  };
  module.exports = isBlocked;  
