const User = require("../model/userModel");
const generateToken = require("../config/jwtToken");
const UserOtpVerification = require("../model/userOtp");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Products = require("../model/productModel");
const Address = require("../model/addressModel");
const randomString = require("randomstring");
const Cart = require("../model/cartModel");
const Coupon = require("../model/couponModel");
const Orders = require("../model/orderModel");
const PDFDocument = require("pdfkit");

//load register
const loadRegister = async (req, res) => {
  try {
    res.render("registration");
  } catch (error) {
    console.log(error);
  }
};

//register user
const userRegister = async (req, res) => {
  const { email, firstname, lastname, mobile, password, confirmPassword } =
    req.body;

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };
  const validatePassword = (password) => {
    const re = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return re.test(String(password));
  };
  const validateName = (name) => {
    const re = /^[A-Za-z]+$/;
    return re.test(String(name));
  };
  const validateMobile = (mobile) => {
    const re = /^[0-9]{11}$/;
    return re.test(String(mobile));
  };

  let errors = {};

  if (!firstname || !validateName(firstname)) {
    errors.firstname = "First name should contain only letters";
  }
  if (!lastname || !validateName(lastname)) {
    errors.lastname = "Last name should contain only letters";
  }
  if (!email || !validateEmail(email)) {
    errors.email = "Invalid email format";
  }
  if (!mobile || !validateMobile(mobile)) {
    errors.mobile =
      "Mobile number should contain only numeric characters and at least 10 characters";
  }
  if (!password || !validatePassword(password)) {
    errors.password =
      "Password must be at least 8 characters and should include one alphabet";
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors }); // Return here to stop further execution
  }

  try {
    const findUser = await User.findOne({ email: email });
    if (findUser && findUser.isverified) {
      return res.status(400).json({ errors: { email: "User already exists" } }); // Return here to stop further execution
    }
    if (!findUser) {
      const user = new User({
        firstname,
        lastname,
        email,
        mobile,
        password,
      });

      const userData = await user.save();
      await sendOtpVerificationEmail(userData, res);
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ errors: { server: "Internal server error" } }); // Return here to stop further execution
  }
};
//nodemailer
let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

//send otp verification email

const sendOtpVerificationEmail = async ({ _id, email }, res) => {
  try {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Verify your email",
      html: `<p>Enter <b>${otp}</b> in the app to verify your email address and complete registration.</p>`,
    };

    // Hash the OTP
    const saltRounds = 10;
    const hashedOtp = await bcrypt.hash(otp, saltRounds);
    const expiryTime = Date.now() + 60000; // 1 minute expiry time
    const newOtpVerification = new UserOtpVerification({
      userId: _id,
      otp: hashedOtp,
      createdAt: Date.now(),
      expiresAt: expiryTime,
    });

    await newOtpVerification.save();
    await transporter.sendMail(mailOptions);

    // Send the remaining time back to the frontend
    res
      .status(200)
      .json({
        success: true,
        userId: _id,
        remainingTime: expiryTime - Date.now(),
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//load verify otp

const loadVerifyOtp = async (req, res) => {
  try {
    const userId = req.query.userId;

    // Fetch the OTP verification record for the user
    const otpVerification = await UserOtpVerification.findOne({ userId });

    // Calculate the remaining time (in milliseconds)
    const remainingTime = Math.max(otpVerification.expiresAt - Date.now(), 0);

    res.render("verifyOtp", {
      userId,
      remainingTime,
      errorMessage: req.query.errorMessage || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// verify otp
const verifyOtp = async (req, res) => {
  const { userId, userEnteredOTP } = req.body;

  try {
    // Fetch the OTP verification record for the user
    const otpVerification = await UserOtpVerification.findOne({
      userId,
      expiresAt: { $gt: Date.now() }, // Check if OTP is still valid
    });

    if (otpVerification) {
      // Compare the user's entered OTP with the stored hashed OTP
      const isOTPValid = await bcrypt.compare(
        userEnteredOTP,
        otpVerification.otp
      );

      if (isOTPValid) {
        // Mark the user as verified (update your User model accordingly)
        await User.findByIdAndUpdate(userId, { isverified: true });

        // Optionally, you may want to delete the OTP verification record
        await UserOtpVerification.findByIdAndDelete(otpVerification._id);

        res.redirect("/otp-success");
      } else {
        // If OTP is invalid, re-render the OTP verification page with an error message
        res.render("verifyOtp", {
          userId,
          remainingTime: otpVerification.expiresAt - Date.now(), // Pass remaining time again
          errorMessage: "Invalid OTP entered. Please try again.",
        });
      }
    } else {
      // If OTP has expired, re-render the OTP verification page with an error message
      res.render("verifyOtp", {
        userId,
        remainingTime: 0, // Set remaining time to 0 to show that it has expired
        errorMessage: "OTP has expired. Please request a new one.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "ERROR",
      message: "Internal server error",
    });
  }
};

// Resend OTP
const resendOtp = async (req, res) => {
  const { userId } = req.body;

  try {
    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Send a new OTP
    await sendOtpVerificationEmail(user, res);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//load otp-success

const otpSuccess = async (req, res) => {
  try {
    res.render("otp-success");
  } catch (error) {
    console.log(error);
  }
};

//load login
const loadLogin = async (req, res) => {
  console.log(req.user);
  try {
    if (req.user) {
      return res.redirect("/home");
    }

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    return res.render("login");
  } catch (error) {
    console.log(error);
  }
};
//login user
const userLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userData = await User.findOne({ email });

    const isMatch = await userData.isPasswordMatched(password);
    if (!isMatch) {
      return res.render("login", { message: "Invalid credentials" });
    }

    if (userData && (await userData.isPasswordMatched(password))) {
      // if(userData.isBlocked == true){
      //     res.cookie('jwt'," ",{maxAge:1})
      //     return res.send('<h1>sorry you have been blocked</h1><br><a href="/">Bck to login</a>')
      // }
      const token = generateToken(userData);

      res.cookie("jwt", token, { httpOnly: true, maxAge: 3600000 });
      const returnTo = req.session.returnTo || "/home";

      delete req.session.returnTo;
      return res.redirect(returnTo);

      // res.redirect("/home");
    } else {
      return res.render("login", { message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
  }
};
//load home
const loadHome = async (req, res) => {
  const userId = req.user.id;
  console.log(userId);

  const { page = 1, limit = 10 } = req.query; // Fetch page and limit from query params
  const pageNum = Math.max(1, parseInt(page)); // Ensure the page is at least 1
  const itemsPerPage = Math.max(1, parseInt(limit)); // Ensure the limit is at least 1

  try {
    const userData = await User.findOne({ _id: userId });

    // Pagination for wallet transactions
    const totalTransactions = userData.walletTransactions.length;
    const totalPages = Math.ceil(totalTransactions / itemsPerPage);
    const paginatedTransactions = userData.walletTransactions.slice(
      (pageNum - 1) * itemsPerPage,
      pageNum * itemsPerPage
    );

    // Fetch cart and wishlist quantities
    const cart = await Cart.findOne({ userId, orderPlaced: false });
    const wishlist = await Wishlist.findOne({ userId });

    const cartQuantity = cart ? cart.items.length : 0;
    const wishlistQuantity = wishlist ? wishlist.products.length : 0;

    // Fetch addresses and orders
    const addresses = await Address.find({ user: userId });
    const defaultAddress = await Address.findOne({
      user: userId,
      isDefault: true,
    });
    const orders = await Orders.find({ user: userId });

    // Render the home page
    res.render("home", {
      user: {
        ...req.user,
        walletTransactions: paginatedTransactions,
        walletBalance: userData.walletBalance,
        totalTransactions,
      },
      addresses,
      defaultAddress,
      orders,
      cartQuantity,
      wishlistQuantity,
      page: pageNum,
      totalPages,
    });
  } catch (error) {
    console.log(error);
  }
};

//logout
const userLogout = async (req, res) => {
  res.cookie("jwt", " ", { maxAge: 1 });
  res.redirect("/login");
};

//load forgot password
const loadForgot = async (req, res) => {
  try {
    res.render("forget");
  } catch (error) {}
};

//verify forgot
const validator = require("validator");
const crypto = require("crypto");
const userOtp = require("../model/userOtp");
const { Console, error } = require("console");

const verifyForgot = async (req, res) => {
  try {
    const email = req.body.email;

    // Validate email
    if (!validator.isEmail(email)) {
      return res.render("forget", { message: "Invalid email format" });
    }

    const findUser = await User.findOne({ email });

    if (findUser) {
      if (!findUser.isverified) {
        return res.render("forget", { message: "Email is not verified" });
      } else {
        const randomString = crypto.randomBytes(20).toString("hex");

        // Update the user's token
        const updatedUser = await User.updateOne(
          { email },
          { $set: { token: randomString } },
          { upsert: true }
        );

        // Send reset password email
        sendResetPasswordMail(findUser.firstname, findUser.email, randomString);

        return res.render("forget", {
          message: "Please check your mail to reset your password",
        });
      }
    } else {
      return res.render("forget", { message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    return res.render("forget", { message: "Something went wrong" });
  }
};

// Send reset password mail
const sendResetPasswordMail = async (firstname, email, token) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Reset Password",
      html: `<p>Hi '${firstname}', please click <a href="http://127.0.0.1:5000/forget-password?token=${token}">here</a> to reset your password.</p>`,
    };

    transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(error);
  }
};

//load reset password

const loadforgetPassword = async (req, res) => {
  try {
    const token = req.query.token;
    const tokenData = await User.findOne({ token: token });
    if (tokenData) {
      res.render("reset-password", { userid: tokenData._id });
    } else {
      res.render("403");
    }
  } catch (error) {}
};

//reset password

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, userid } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.render("reset-password", {
        message: "Passwords do not match",
        userid,
      });
    }

    // Hash the new password
    const securePassword = await bcrypt.hash(password, 10);

    // Update user password and clear the token
    await User.findByIdAndUpdate(
      { _id: userid },
      { $set: { password: securePassword, token: "" } }
    );

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    return res.render("reset-password", {
      message: "Something went wrong",
      userid: req.body.userid,
    });
  }
};

//load user account

const userAccount = async (req, res) => {
  const user = req.user;
  try {
    res.render("home", { user });
  } catch (error) {
    console.log(error);
  }
};

//edit user
// const editLoad = async(req,res)=>{
//     try {
//         const user = req.q
//         const userData = await User.findOne({_id:id})
//         if(userData){
//             res.render('useraccount',{user:userData})
//         }
//         else{
//             res.redirect('/home')
//         }

//     } catch (error) {

//         console.log(error)
//     }

// }
const updateProfile = async (req, res) => {
  const { id } = req.user;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !req.body.firstname ||
    !req.body.lastname ||
    !req.body.email ||
    !req.body.mobile ||
    !emailRegex.test(req.body.email)
  ) {
    return res.redirect("/home");
  }

  try {
    const userData = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          email: req.body.email,
          mobile: req.body.mobile,
        },
      },
      { new: true }
    );

    if (userData) {
      res.status(200).redirect("/home");
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.log(error.message);
  }
};

const loadAddAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    const cart = await Cart.findOne({ userId }).populate("items.product");
    res.render("checkoutwithaddress", {
      products: cart.items,
      cartId: cart._id,
    });
  } catch (error) {}
};

// add address
const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;

    const { house, street, city, landmark, state, country, zip, source } =
      req.body;
    const newAddress = new Address({
      house,
      street,
      city,
      landmark,
      state,
      country,
      zip,

      user: userId,
    });

    // Save the address
    const savedAddress = await newAddress.save();

    if (source === "home") {
      res.redirect("/home");
    } else {
      res.redirect("/checkout");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
//add address in profile
const addAddressProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { house, street, city, landmark, state, country, zip } = req.body;
    // console.log(userId)
    const address = new Address({
      house,
      street,
      city,
      landmark,
      state,
      country,
      zip,
      user: userId,
    });
    const savedAddress = await address.save();
    // res.redirect(201).redirect({ message: 'Address added successfully', address: savedAddress });
    res.redirect("/home#address");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
//set default address
const setDeafultAddress = async (req, res) => {
  const userId = req.user.id;
  const addressId = req.params.addressId;

  try {
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      { $set: { isDefault: true } },
      { new: true }
    );
    res.json(updatedAddress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//loadCart

const loadCart = async (req, res) => {
  try {
    const user = req.user;
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId, orderPlaced: false }).populate(
      "items.product"
    );
    let wishlistQuantity = 0;
    let cartQuantity = 0;
    if (user) {
      const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId: user._id });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    if (!cart || !cart.items) {
      res.render("cart", {
        products: [],
        user,
        cartQuantity,
        wishlistQuantity,
      });
    } else {
      const activeItems = cart.items.filter((item) => item.isActive);
      res.render("cart", {
        products: activeItems,
        user,
        cartQuantity,
        wishlistQuantity,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

//add to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, size } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You need to be logged in to add items to your cart",
        redirectTo: "/login",
      });
    }

    if (!quantity || !size) {
      return res
        .status(400)
        .json({ success: false, message: "Quantity and size are required" });
    }

    let cart = await Cart.findOne({ userId, orderPlaced: false });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const product = await Products.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const sizeDetail = product.sizes.find((item) => item.size === size);
    if (!sizeDetail || sizeDetail.quantity < quantity) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Insufficient stock for the selected size",
        });
    }

    const maxAllowedQuantity = Math.min(5, sizeDetail.quantity);
    if (quantity > maxAllowedQuantity) {
      return res.status(400).json({
        success: false,
        message: `You can only add up to ${maxAllowedQuantity} units for this size`,
      });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.size === size &&
        item.isActive
    );

    if (existingItemIndex !== -1) {
      const existingQuantity = cart.items[existingItemIndex].quantity;
      if (existingQuantity + quantity > maxAllowedQuantity) {
        return res.status(400).json({
          success: false,
          message: `You can only have up to ${maxAllowedQuantity} units for this size in your cart`,
        });
      }
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        size,
        isActive: true,
      });
    }

    // Recalculate the total
    let total = 0;
    for (const item of cart.items) {
      const itemProduct = await Products.findById(item.product);
      if (!itemProduct) {
        console.error(`Product with ID ${item.product} not found`);
        continue;
      }
      const price = itemProduct.discountedPrice || itemProduct.price;
      total += price * item.quantity;
    }

    if (isNaN(total)) {
      console.error("Cart total calculated as NaN");
      return res
        .status(500)
        .json({ success: false, message: "Failed to calculate cart total" });
    }

    cart.total = total;
    await cart.save();

    // Remove the product from the wishlist
    await Wishlist.updateOne({ userId }, { $pull: { products: productId } });

    return res.json({
      success: true,
      message: "Item added to cart and removed from wishlist",
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

//delete product from cart
const deleteCart = async (req, res) => {
  try {
    const userId = req.user;
    const productId = req.query.id;

    // Find the user's cart
    const cart = await Cart.findOne({ userId, orderPlaced: false });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex((item) =>
      item.product.equals(productId)
    );
    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the cart" });
    }

    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);

    // Save the updated cart
    await cart.save();

    // Optionally, update the product's stock count if needed
    // await updateProductStock(productId);

    res
      .status(200)
      .json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//update-quantity
const updateQuantity = async (req, res) => {
  const productId = req.query.id;
  const action = req.query.action;
  const selectedSize = req.query.size;

  try {
    // Find the user's cart
    const cart = await Cart.findOne({
      "items.product": productId,
      orderPlaced: false,
    });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found." });
    }

    // Find the index of the item in the cart
    const itemIndex = cart.items.findIndex(
      (item) => item.product.equals(productId) && item.size === selectedSize
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Product not found in the cart." });
    }

    // Find the product and size details
    const item = cart.items[itemIndex];
    const product = await Products.findById(item.product);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const sizeDetail = product.sizes.find((size) => size.size === selectedSize);

    if (!sizeDetail) {
      return res.status(404).json({ error: "Product size not found." });
    }
    const maxAllowedQuantity = Math.min(5, sizeDetail.quantity);
    // Update the quantity based on the action
    if (action === "increase") {
      if (item.quantity + 1 > maxAllowedQuantity) {
        return res
          .status(400)
          .json({
            error: `You can only have up to ${maxAllowedQuantity} units for this size in your cart`,
          });
      }
      item.quantity += 1;
    } else if (action === "decrease") {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        // If quantity is reduced to 1 or lower, remove the item
        cart.items.splice(itemIndex, 1);
      }
    }

    // Recalculate the total price for the cart
    let total = 0;
    for (const cartItem of cart.items) {
      const cartProduct = await Products.findById(cartItem.product);
      if (cartProduct) {
        total +=
          (cartProduct.discountedPrice || cartProduct.price) *
          cartItem.quantity;
      }
    }

    // Update the cart total
    cart.total = total;

    // Save the updated cart and product
    await cart.save();
    await product.save();

    const productTotal =
      (product.discountedPrice || product.price) * item.quantity;
    return res.json({
      quantity: item.quantity,
      total,
      countInStock: sizeDetail.quantity,
      productTotal,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//wishlist

const Wishlist = require("../model/wishlistModel"); // Path to your Wishlist model

const loadWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    let wishlistQuantity = 0;
    let cartQuantity = 0;

    // Calculate cartQuantity and wishlistQuantity if the user exists
    if (userId) {
      const cart = await Cart.findOne({ userId, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    // Find the wishlist for the user and populate product details
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products",
      select: "name description price images", // Include only necessary fields
    });

    if (!wishlist || wishlist.products.length === 0) {
      return res.render("wishlist", {
        wishlistItems: [],
        user: req.user,
        cartQuantity,
        wishlistQuantity,
        message: "Your wishlist is empty.",
      });
    }

    // Render the wishlist page
    res.render("wishlist", {
      wishlistItems: wishlist.products,
      user: req.user,
      cartQuantity,
      wishlistQuantity,
      message: null,
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.status(500).render("wishlist", {
      wishlistItems: [],
      user: req.user,
      cartQuantity: 0,
      wishlistQuantity: 0,
      message: "An error occurred while loading your wishlist.",
    });
  }
};

//add to wishlist

const addToWishList = async (req, res) => {
  const { productId } = req.body;
  const userId = req.user._id;

  try {
    // Check if the product ID is valid
    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });
    }

    // Find the user's wishlist
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      // Create a new wishlist if it doesn't exist
      await Wishlist.create({ userId, products: [productId] });
      return res.json({ success: true, message: "Product added to wishlist" });
    }

    // Check if the product is already in the wishlist
    if (wishlist.products.includes(productId)) {
      return res
        .status(400)
        .json({ success: false, message: "Product already in wishlist" });
    }

    // Add the product to the wishlist
    wishlist.products.push(productId);
    await wishlist.save();

    res.json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const productDetail = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Products.findById(productId);
    console.log(product);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product); // Return product details
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching product details" });
  }
};

// Assuming that 'Cart' and 'Wishlist' models are already set up.
const addToCartFromWishlist = async (req, res) => {
  const { productId, size, quantity } = req.body;
  const userId = req.user._id; // Assuming user ID is available in the session

  try {
    const product = await Products.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const sizeOption = product.sizes.find((s) => s.size === size);
    if (!sizeOption || sizeOption.quantity < quantity) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Insufficient stock for the selected size",
        });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [], total: 0 });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId && item.size === size
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        size,
        quantity,
        isActive: true,
        discountedPrice: product.discountedPrice || product.price,
      });
    }

    cart.total = cart.items.reduce(
      (total, item) => total + item.discountedPrice * item.quantity,
      0
    );
    await cart.save();

    res.json({ success: true, message: "Product added to cart" });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user is authenticated and userId is available in req.user
    const { productId } = req.body;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res
        .status(404)
        .json({ success: false, message: "Wishlist not found" });
    }

    // Check if the product exists in the wishlist
    const productIndex = wishlist.products.indexOf(productId);
    if (productIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found in wishlist" });
    }

    // Remove the product from the wishlist
    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    res.json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

//checkout
const loadCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const coupons = await Coupon.find();
    const cart = await Cart.findOne({ userId, orderPlaced: false }).populate(
      "items.product"
    );
    let wishlistQuantity = 0;
    let cartQuantity = 0;
    if (user) {
      const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId: user._id });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    const addresses = await Address.find({ user: userId });
    const defaultAddress = await Address.findOne({
      user: userId,
      isDefault: true,
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // Since the discount is already applied and saved in `cart.total`,
    // we don't need to calculate it again.
    const newSubtotal = cart.total;

    const checkoutData = {
      products: cart.items.filter((el) => el.isActive),
      cartId: cart._id,
      addresses,
      defaultAddress,
      user,
      coupons,
      cart,
      appliedCoupon: cart.appliedCoupon, // This is for informational purposes, such as displaying the applied coupon code.
      newSubtotal,
      cartQuantity,
      wishlistQuantity,
    };

    res.render("checkout", checkoutData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to calculate discount
function calculateDiscount(total, coupon) {
  const discountPercentage = coupon.discount; // Assuming coupon has a 'discount' field
  const discountAmount = total * (discountPercentage / 100);

  return discountAmount;
}

//apply coupon

const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.id;
    const { couponCode } = req.query;
    const { cartId } = req.params;

    // Find the cart and populate its items
    const cart = await Cart.findById(cartId).populate("items.product");
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    if (cart.appliedCoupon) {
      return res
        .status(400)
        .json({ error: "A coupon is already applied to this cart" });
    }

    const coupon = await Coupon.findOne({ couponCode });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });

    const currentDate = new Date();
    if (coupon.validUntil < currentDate || !coupon.status) {
      return res.status(400).json({ error: "Coupon is not valid." });
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({ error: "Coupon has reached its total usage limit." });
    }

    // Check if the cart meets the minimum purchase amount required for this coupon
    const originalTotal = cart.total;
    if (originalTotal < coupon.minPurchaseAmount) {
      return res.status(400).json({
        error: `Minimum purchase of ₹${coupon.minPurchaseAmount} is required to apply this coupon.`,
      });
    }

    // Calculate the discount with maximum discount cap
    const discountAmount = (originalTotal * coupon.discount) / 100;
    const cappedDiscount = coupon.maxDiscount
      ? Math.min(discountAmount, coupon.maxDiscount)
      : discountAmount;
    const updatedTotal = originalTotal - cappedDiscount;

    // Update cart and coupon usage
    cart.total = updatedTotal;
    cart.appliedCoupon = coupon._id;
    await cart.save();

    coupon.usageCount += 1;
    coupon.appliedCarts.push(cartId);
    coupon.usersApplied.push(userId);
    await coupon.save();

    // Send the updated total back to the client
    return res.json({
      newSubtotal: updatedTotal,
      discountApplied: cappedDiscount,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//remove coupon
const removeCoupon = async (req, res) => {
  try {
    const { cartId } = req.params;

    // Find the cart and populate its items
    const cart = await Cart.findById(cartId).populate("items.product");
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    if (!cart.appliedCoupon)
      return res.status(400).json({ error: "No coupon applied to this cart" });

    // Recalculate original total based on item prices
    let originalTotal = 0;
    cart.items.forEach((item) => {
      const product = item.product;
      const itemPrice = product.discountedPrice || product.price || 0;
      originalTotal += itemPrice * item.quantity;
    });

    // Update cart and remove coupon
    cart.total = originalTotal;
    cart.appliedCoupon = null;
    await cart.save();

    return res.json({
      message: "Coupon removed successfully",
      total: cart.total,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//view order
const mongoose = require("mongoose"); // Make sure to import mongoose

const viewOrder = async (req, res) => {
  const user = req.user;
  const orderId = req.session.orderId || req.params.orderId;

  let wishlistQuantity = 0;
  let cartQuantity = 0;
  if (user) {
    const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
    cartQuantity = cart ? cart.items.length : 0;

    const wishlist = await Wishlist.findOne({ userId: user._id });
    wishlistQuantity = wishlist ? wishlist.products.length : 0;
  }

  // Validate orderId
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ error: "Invalid Order ID format." });
  }

  try {
    const orders = await Orders.findById(orderId)
      .populate({ path: "user", select: "firstname lastname mobile" })
      .populate({
        path: "cartItems",
        populate: {
          path: "items.product", // Populate the `product` field inside each `cartItem`
          model: "Products", // Specify the model name if needed
        },
      })
      .populate({
        path: "cartItems", // Re-populate the cart to also populate the applied coupon
        populate: {
          path: "appliedCoupon", // Populate the applied coupon inside the cart
          model: "Coupon",
          select: "couponCode", // Select only the fields you need
        },
      })
      .populate("shippingAddress"); // Populate the shipping address

    if (!orders) {
      return res
        .status(404)
        .render("payment-success", { message: "Order not found" });
    }

    const shippingAddress = orders.shippingAddress
      ? orders.shippingAddress
      : null;

    res.render("view-order", {
      orders: orders,
      user,
      shippingAddress,
      orderId: orders._id,
      cartQuantity,
      wishlistQuantity,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res
      .status(500)
      .render("payment-success", { message: "Internal server error" });
  }
};

//cancel order
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Orders.findById(orderId);

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.orderStatus === "cancelled") {
      return res.json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    order.orderStatus = "cancelled";
    await order.save();

    let refundAmount = null;

    if (
      order.paymentOption === "paypal" &&
      order.refundStatus === "NotRequested"
    ) {
      const refundResult = await refundToWallet(orderId);

      if (!refundResult.success) {
        return res.status(500).json({ message: refundResult.message });
      }

      refundAmount = order.totalprice;
      order.status = "Refunded";
      await order.save();
    }

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      refundAmount,
    });
  } catch (error) {
    console.error("Error during order cancellation:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
const refundToWallet = async (orderId) => {
  try {
    const order = await Orders.findById(orderId).populate("user");

    if (!order) {
      return { success: false, message: "Order not found" };
    }
    if (
      order.paymentOption !== "paypal" ||
      order.refundStatus !== "NotRequested"
    ) {
      return { success: false, message: "Refund not applicable" };
    }

    const user = order.user;
    user.walletBalance += order.totalprice;

    user.walletTransactions.push({
      amount: order.totalprice,
      date: new Date(),
      type: "Credit",
      description: `Refund for Order #${order._id}`,
    });

    await user.save();
    order.refundStatus = "Completed";
    await order.save();

    return { success: true };
  } catch (error) {
    console.error("Error processing refund:", error);
    return { success: false, message: "Internal server error" };
  }
};

const requestReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user._id; // Assuming req.user contains the authenticated user's details
    console.log(orderId, userId);

    // Find the order by ID and check if it's delivered
    const order = await Orders.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).send("Unauthorized request"); // User is trying to access someone else's order
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).send("Only delivered orders can be returned"); // Only "delivered" orders can be returned
    }

    // Check if return is already requested
    if (order.returnRequest.isRequested) {
      return res.status(400).send("Return already requested");
    }

    // Update the return request status
    order.returnRequest.isRequested = true;
    order.returnRequest.status = "requested";
    await order.save();

    res
      .status(200)
      .json({ success: true, message: "Return request successfully created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  loadRegister,
  userRegister,
  loadLogin,
  verifyForgot,
  loadforgetPassword,
  resetPassword,
  userLogin,
  loadHome,
  userLogout,
  loadForgot,
  loadVerifyOtp,
  verifyOtp,
  loadHome,
  updateProfile,
  resendOtp,
  otpSuccess,
  userAccount,
  loadCart,
  addToCart,
  loadWishlist,
  addToWishList,
  removeFromWishlist,
  productDetail,
  addToCartFromWishlist,
  loadCheckout,
  addAddressProfile,
  addAddress,
  loadAddAddress,
  deleteCart,
  updateQuantity,
  setDeafultAddress,

  applyCoupon,
  calculateDiscount,
  removeCoupon,
  viewOrder,
  cancelOrder,
  refundToWallet,
  requestReturn,
};
