const User = require('../model/userModel');
const jwt = require('jsonwebtoken');
const generateToken = require('../config/jwtToken');

const isBlocked = async (req, res, next) => {
    console.log('hi')
  try {
      const token = req.cookies.jwt;
      
      if (!token) {
          req.session.returnTo = req.originalUrl;
          return res.redirect('/login');
      }

      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decodedToken.id);

      if (user && user.isBlocked === false) {
          return next();
      } else {
          return res.status(403).render('403');
      }
  } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = isBlocked;
