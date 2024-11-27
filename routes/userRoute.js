const User = require('../model/userModel');
const express = require('express');
const user_route = express()
user_route.set('view engine','ejs')
user_route.set('views','./views/user')




const userCtrl = require('../controller/userCtrl');

const Auth = require('../middlewares/authMiddle');

const isBlocked = require('../middlewares/isBlocked');
const { blockUser } = require('../controller/adminCtrl');
const orderCtrl = require('../controller/orderCtrl')



user_route.get('/register',userCtrl.loadRegister);
user_route.post('/register',userCtrl.userRegister);
user_route.post('/verify-otp',userCtrl.verifyOtp);
user_route.post('/resend-otp',userCtrl.resendOtp)
user_route.get('/verify-otp',userCtrl.loadVerifyOtp)
user_route.get('/otp-success',userCtrl.otpSuccess);


user_route.get('/',Auth.guestUser,userCtrl.loadLogin);
user_route.post('/login',userCtrl.userLogin);
user_route.get('/home',Auth.verifyToken,userCtrl.loadHome)
user_route.get('/logout',Auth.verifyToken,userCtrl.userLogout);
user_route.get('/forgot',userCtrl.loadForgot)
user_route.post('/forgot',userCtrl.verifyForgot);
user_route.get('/forget-password',userCtrl.loadforgetPassword);
user_route.post('/forget-password',userCtrl.resetPassword)
user_route.get('/home',Auth.verifyToken,isBlocked,userCtrl.loadHome);
// user_route.get('/useraccount',Auth.verifyToken,isBlocked,userCtrl.editLoad);
user_route.post('/edit-load',Auth.verifyToken,isBlocked,userCtrl.updateProfile)

user_route.get('/useraccount',Auth.verifyToken,isBlocked,userCtrl.userAccount);
user_route.get('/cart',Auth.verifyToken,isBlocked,userCtrl.loadCart);
user_route.post('/product/addto-cart',Auth.verifyTokenAndRedirect,isBlocked,userCtrl.addToCart);
user_route.delete('/delete-product',Auth.verifyToken,isBlocked,userCtrl.deleteCart);
user_route.get('/update-quantity',userCtrl.updateQuantity)
user_route.get('/wishlist',Auth.verifyToken,userCtrl.loadWishlist);
user_route.post('/wishlist/add',Auth.verifyToken,userCtrl.addToWishList);
user_route.get('/product/details/:productId',userCtrl.productDetail);
user_route.post('/cart/add-from-wishlist',Auth.verifyToken,userCtrl.addToCart);
user_route.post('/wishlist/remove',Auth.verifyToken,userCtrl.removeFromWishlist);
user_route.get('/checkout',Auth.verifyToken,isBlocked,userCtrl.loadCheckout,userCtrl.addAddress);
user_route.get('/add-address', Auth.verifyToken, (req, res) => {
    res.render('add-address'); // Create this view in your `views` directory
  });
user_route.get('/add-address',Auth.verifyToken,isBlocked,userCtrl.loadAddAddress)
user_route.post('/add-address',Auth.verifyToken,isBlocked,userCtrl.addAddress);
user_route.post('/address/add',Auth.verifyToken,userCtrl.addAddress)
user_route.post('/add-address-profile',Auth.verifyToken,userCtrl.addAddressProfile);
user_route.post('/set-default-address/:addressId',Auth.verifyToken,userCtrl.setDeafultAddress)
user_route.post('/place-order/:cartId',Auth.verifyToken,isBlocked,orderCtrl.createOrder);
user_route.get('/payment/success',orderCtrl.paymentSuccess);
user_route.get('/payment/cancel/:cartId',Auth.verifyToken,orderCtrl.paymentCancel);

user_route.post('/apply-coupon/:cartId',Auth.verifyToken,userCtrl.applyCoupon);
user_route.post('/remove-coupon/:cartId', Auth.verifyToken, userCtrl.removeCoupon);
user_route.get('/view-order/:orderId',Auth.verifyToken,userCtrl.viewOrder);
user_route.post('/cancel-order',Auth.verifyToken,userCtrl.cancelOrder);
user_route.post('/orders/:orderId/request-return',Auth.verifyToken, userCtrl.requestReturn)





module.exports = user_route;
