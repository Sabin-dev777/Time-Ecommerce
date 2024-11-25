const express = require('express');
const path = require('path')
const mime = require('mime-types')

const dbConnect = require('./db/dbConnect');
const cookie = require('cookie-parser');
const nocache = require('nocache');
const session = require('express-session')


const app = express();
const dotenv = require('dotenv').config();


const cookieParser = require('cookie-parser');




dbConnect();
app.use('/user-assets/magiczoom/magiczoom.css', (req, res, next) => {
    res.type('text/css'); // Set the MIME type to text/css
    next();
});


  app.use( express.static(path.join(__dirname, 'public')));


app.use(express.json());
app.use(cookieParser());
app.use(nocache());
app.use(express.urlencoded({extended:false}));
app.use(session({secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:true,cookie:{secure:process.env.NODE_ENV==='production'}}))
const userRoute =require('./routes/userRoute');
app.use('/',userRoute);
const adminRoute = require('./routes/adminRoute');
app.use('/admin',adminRoute);
const productRoute = require('./routes/productRoute');
app.use('/product',productRoute);



app.listen(5000,()=>{
    console.log('server is listening to the port 5000');
})