const express = require('express');

const product_route = express();
const Product = require('../model/productModel');

 product_route.set('view engine','ejs');
 product_route.set('views','./views/product');


 const productCtrl = require('../controller/productCtrl');
 const userCtrl = require('../controller/userCtrl');
 const Auth = require('../middlewares/authMiddle')


 product_route.get('/',Auth.guestUser,productCtrl.shopProducts);

 product_route.get('/select-product',Auth.guestUser,productCtrl.loadProductDetail);

 product_route.get('/product/:id',async(req,res)=>{
    try {
        const product = await Product.findById(req.params.id);

    } catch (error) {
        
    }

 })
 product_route.get('/search',Auth.guestUser,productCtrl.shopProducts);
 product_route.get('/landing',Auth.guestUser,productCtrl.loadHome)
product_route.get('/:brandId',productCtrl.shopProducts);




 module.exports = product_route;