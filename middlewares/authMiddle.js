const jwt = require('jsonwebtoken');
const User = require('../model/userModel');


const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (user) {
                req.user = user;
                return next();
            } else {
                req.session.returnTo = req.originalUrl
                console.log('1'+ req.session.returnTo)
                return res.redirect('/login');
            }
        } else {
            req.session.returnTo = req.originalUrl
            // console.log(req)
            console.log('2'+ req.session.returnTo)
          
            return res.redirect('/login');
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        req.session.returnTo = req.originalUrl
        console.log('3'+ req.session.returnTo)
        return res.redirect('/login');
    }
};

const verifyTokenAndRedirect = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (user) {
                req.user = user;
                return next();
            } else {
                req.session.returnTo = req.originalUrl
                console.log('1'+ req.session.returnTo)
                return res.redirect('/login');
            }
        } else {
            req.session.returnTo = "/product/select-product?id="+req.body.productId
            // req.session.returnTo = req.body.productId?`/product/select-product?id={req.body.productId}`: req.originalUrl;
            // console.log(req)
            console.log('2'+ req.session.returnTo)
           
            return res.redirect('/login');
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        req.session.returnTo = req.originalUrl
        console.log('3'+ req.session.returnTo)
        return res.redirect('/login');
    }
};
   
   
const isAdmin = async(req,res,next)=>{
    const {email} = req.user;
    const adminUser = await User.findOne({email});
    if(adminUser.role !== "admin"){
        throw new Error('You are not admin')
    }
    else{
        next();
    }
}
const guestUser = async(req,res,next)=>{
    try {
        const token = req.cookies.jwt;
        if(token){
            const decoded = jwt.verify(token,process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if(user){
                req.user = user
            }

        }
        return next()
    } catch (error) {
        console.error('Error verifying token:', error);
        return next();
        
    }
}

const redirectIfAuthenticated = (req, res, next) => {
    console.log(req.user)
    console.log('authe')
    if (req.user) {
        
      return res.redirect('/home'); // Redirect authenticated users
    }
    next(); // Allow unauthenticated users to proceed
  };
    

module.exports = {
    verifyToken,
    isAdmin,
    verifyTokenAndRedirect,
    guestUser,
    redirectIfAuthenticated
}
