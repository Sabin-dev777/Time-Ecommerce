const User = require("../model/userModel");
const mongoose = require("mongoose");
const Category = require("../model/categoryModel");
const Products = require("../model/productModel");
const Orders = require("../model/orderModel");
const Cart = require("../model/cartModel");
const generateToken = require("../config/jwtToken");
const Coupon = require("../model/couponModel");
const path = require("path");
const fs = require("fs");
const Sales = require("../model/salesSchema");
const Offers = require("../model/offerModal");
const Banners = require("../model/bannerModal");
const Brands = require("../model/brandModel");
const ExcelJS = require("exceljs");

//load login

const loadLogin = async (req, res) => {
  try {
    res.render("adminlogin");
  } catch (error) {
    console.log(error);
  }
};

//laod admin register
const loadAdminRegister = async (req, res) => {
  try {
    res.render("adminregistration");
  } catch (error) {
    console.log(error);
  }
};

//admin registration

const adminRegister = async (req, res) => {
  const { email, firstname, lastname, mobile, password } = req.body;
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
    const re = /^[0-9]+$/;
    return re.test(String(mobile));
  };

  try {
    if (!email || !firstname || !lastname || !mobile || !password) {
      return res.render("adminregistration", {
        message: "All fields are required",
      });
    }
    if (!validateEmail(email)) {
      return res.render("adminregistration", {
        message: "Invalid email format",
      });
    }
    if (!validatePassword(password)) {
      return res.render("adminregistration", {
        message:
          "Password must be atleast 8 characters and should include one alphabet",
      });
    }
    if (!validateName(firstname)) {
      return res.render("adminregistration", {
        message: "first name should contain only letters",
      });
    }
    if (!validateName(lastname)) {
      return res.render("adminregistration", {
        message: "lastname should contain only alphabets",
      });
    }
    if (!validateMobile(mobile)) {
      return res.render("adminregistration", {
        message: "Mobile number should contain only numeric characters",
      });
    }

    const findUser = await User.findOne({ email: email });
    if (findUser && (await User.findOne({ isverified: true }))) {
      return res.render("adminregistration", { message: "user already exist" });
    }
    if (!findUser) {
      const user = new User({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: email,
        mobile: req.body.mobile,
        password: req.body.password,
        role: "admin",
      });

      const userData = await user.save();
      return res.render("registersuccess");
    }
  } catch (error) {
    console.log(error);
  }
};

//admin login

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const findUser = await User.findOne({ email });

    // Check if user exists and their role is 'admin'
    if (
      findUser &&
      findUser.role === "admin" && // Check if the user's role is 'admin'
      (await findUser.isPasswordMatched(password))
    ) {
      // Generate token and set cookie
      const token = generateToken(findUser);

      res.cookie("jwt", token, { httpOnly: true, maxAge: 3600000 });

      return res.redirect("/admin/home");
    } else {
      // Return error message for incorrect credentials or non-admin users
      return res.render("adminlogin", {
        message: "Invalid email, password, or you are not authorized.",
      });
    }
  } catch (error) {
    console.log(error);
    return res.render("adminlogin", {
      message: "Something went wrong. Please try again.",
    });
  }
};

//admin logout
const adminLogout = async (req, res) => {
  res.cookie("jwt", " ", { maxAge: 1 });
  res.redirect("/admin");
};

//load home

const adminHome = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const ordersData = await Orders.find().skip(skip).limit(limit);
    const totalOrdersCount = await Orders.countDocuments();

    const totalPages = Math.ceil(totalOrdersCount / limit);
    // Total Revenue
    const totalRevenue = await Orders.aggregate([
      { $match: { orderStatus: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalprice" } } },
    ]);

    // Orders Count
    const totalOrders = await Orders.countDocuments({
      orderStatus: { $ne: "orderPlaced" },
    });

    // Canceled Orders Count
    const cancelledOrders = await Orders.countDocuments({
      orderStatus: "cancelled",
    });
    const refundedOrders = await Orders.countDocuments({
      orderStatus: "refunded",
    });

    // Products Count
    const totalProducts = await Products.countDocuments();

    // Monthly Earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);

    const monthlyEarnings = await Orders.aggregate([
      {
        $match: {
          orderStatus: "Order placed",
          dateOrdered: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalprice" } } },
    ]);

    // Sales by Month
    const salesByMonth = await Orders.aggregate([
      { $match: { orderStatus: "confirmed" } },
      {
        $project: {
          month: { $month: "$dateOrdered" },
          year: { $year: "$dateOrdered" },
          totalprice: 1,
        },
      },
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          total: { $sum: "$totalprice" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Revenue by Country
    const revenueByCountry = await Orders.aggregate([
      { $match: { orderStatus: "Order placed" } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "addresses",
          localField: "user.address",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: "$address" },
      {
        $group: {
          _id: "$address.country",
          totalRevenue: { $sum: "$totalprice" },
        },
      },
    ]);

    res.render("home", {
      revenue: totalRevenue[0]?.total || 0,
      totalOrders,
      ordersData,
      products: totalProducts,
      monthlyEarnings: monthlyEarnings[0]?.total || 0,
      revenueByCountry,
      salesByMonth,
      totalOrders,
      cancelledOrders,
      currentPage: page,
      totalPages,
      refundedOrders, // Pass the canceledOrders to the template
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const userList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to 1 if page is not specified
    const limit = 10; // Number of users per page
    const skip = (page - 1) * limit;

    // Fetch paginated users
    const usersData = await User.find({ role: "user" }).skip(skip).limit(limit);

    // Count total users for pagination
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalPages = Math.ceil(totalUsers / limit); // Calculate total pages

    res.render("users", {
      users: usersData,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error.message);
  }
};

//block user

const blockUser = async (req, res) => {
  const { id } = req.query;
  try {
    const userData = await User.findByIdAndUpdate(
      { _id: id },
      { $set: { isBlocked: true } },
      { new: true }
    );
    res.redirect("/admin/users");
  } catch (error) {
    console.log(error);
  }
};

// unblock useer

const unblockUser = async (req, res) => {
  const { id } = req.query;
  try {
    userData = await User.findByIdAndUpdate(
      { _id: id },
      { $set: { isBlocked: false } },
      { new: true }
    );
    res.redirect("/admin/users");
  } catch (error) {}
};
const createCategory = async (req, res) => {
  try {
    const { name, description, gender } = req.body;

    // Validate required fields
    if (!name || !description || !gender) {
      const categories = await Category.find({});
      const totalCategories = await Category.countDocuments();
      const totalPages = Math.ceil(totalCategories / 10); // Assuming 10 items per page
      return res.render("categories", {
        message: "All fields are required.",
        categories,
        currentPage: 1,
        totalPages,
      });
    }

    // Normalize the name to lowercase for case-insensitive comparison
    const normalizedName = name.trim().toLowerCase();

    // Check if a category with the same name already exists
    const existingCategory = await Category.findOne({
      name: normalizedName,
    });

    if (existingCategory) {
      const categories = await Category.find({});
      const totalCategories = await Category.countDocuments();
      const totalPages = Math.ceil(totalCategories / 10);
      return res.render("categories", {
        message: "Category with the same name already exists.",
        categories,
        currentPage: 1,
        totalPages,
      });
    }

    // Create the new category
    const category = new Category({
      name: normalizedName,
      description,
      gender,
    });

    const categoryData = await category.save();

    if (categoryData) {
      return res.redirect("/admin/category");
    } else {
      const categories = await Category.find({});
      const totalCategories = await Category.countDocuments();
      const totalPages = Math.ceil(totalCategories / 10);
      return res.render("categories", {
        message: "Failed to create category.",
        categories,
        currentPage: 1,
        totalPages,
      });
    }
  } catch (error) {
    console.error(error);
    const categories = await Category.find({});
    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / 10);
    return res.render("categories", {
      message: "An error occurred while creating the category.",
      categories,
      currentPage: 1,
      totalPages,
    });
  }
};


// list category
const listCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page, default to 1
    const limit = 10; // Categories per page
    const skip = (page - 1) * limit; // Number of documents to skip

    // Fetch limited categories based on pagination parameters
    const categoryData = await Category.find().skip(skip).limit(limit);

    // Count total documents for pagination
    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit); // Calculate total pages

    res.render("categories", {
      categories: categoryData,
      currentPage: page, // Ensure this is passed
      totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
//get category

const getCategory = async (req, res) => {
  try {
    const categories = await Category.find();
    return categories;
  } catch (error) {
    console.log(error);
  }
};

//edit category load
const editCategoryLoad = async (req, res) => {
  try {
    const { id } = req.query;
    const categoryData = await Category.findById(id);

    if (!categoryData) {
      return res.redirect("/admin/category");
    }

    res.render("edit-category", { categories: categoryData });
  } catch (error) {
    console.error(error);
    return res.redirect("/admin/category");
  }
};

// edit category
const editCategory = async (req, res) => {
  const { id } = req.query;

  try {
    const { name, description, gender } = req.body;

    // Validate required fields
    if (!name || !description || !gender) {
      const categories = await Category.findById(id);
      return res.render("edit-category", {
        message: "All fields are required.",
        categories,
      });
    }

    // Check if a category with the same name or slug already exists (excluding current category)
    const existingCategory = await Category.findOne({
      _id: { $ne: id }, // Exclude current category from check
      $or: [{ name }],
    });

    if (existingCategory) {
      const categories = await Category.findById(id);
      return res.render("edit-category", {
        message: "Another category with the same name already exists.",
        categories,
      });
    }

    // Update the category
    const category = await Category.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          description,
          gender,
        },
      },
      { new: true }
    );

    if (category) {
      return res.redirect("/admin/category");
    } else {
      const categories = await Category.findById(id);
      return res.render("edit-category", {
        message: "Failed to update category.",
        categories,
      });
    }
  } catch (error) {
    console.error(error);
    const categories = await Category.findById(id);
    return res.render("edit-category", {
      message: "An error occurred while updating the category.",
      categories,
    });
  }
};

//delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.query;

    const categoryData = await Category.findByIdAndUpdate(
      { _id: id },
      { $set: { isDeleted: true } },
      { $upsert: true },
      { new: true }
    );
    if (categoryData) {
      res.redirect("/admin/category");
    }
  } catch (error) {
    console.log(error);
  }
};
//undo deleteCategory
const undoDeleteCategory = async (req, res) => {
  try {
    const { id } = req.query;

    const categoryData = await Category.findByIdAndUpdate(
      { _id: id },
      { $set: { isDeleted: false } },
      { new: true }
    );
    if (categoryData) {
      res.redirect("/admin/category");
    }
  } catch (error) {}
};

//load product list

const loadproducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the current page from query parameters, default to 1
    const limit = 10; // Number of products per page
    const skip = (page - 1) * limit;

    // Get paginated products
    const productData = await Products.find()
      .populate("category", "name")
      .populate("brand", "brandname")
      .sort({ dateCreated: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalProducts = await Products.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("productlist", {
      products: productData,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error);
  }
};

// load product form
const loadProductForm = async (req, res) => {
  try {
    const categories = await getCategory();
    const brands = await Brands.find(); // Fetch brands
    res.render("product-form1", { categories, brands });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      richDescription,
      brand,
      price,
      category,
      sizes,
      gender,
      badgeText,
    } = req.body;
    const images = req.files ? req.files.map((file) => file.filename) : [];

    // Check required fields
    if (!name || !description || !price || !category || !sizes || !gender) {
      return res
        .status(400)
        .json({
          error:
            "All fields are required: name, description, price, category, sizes, and gender",
        });
    }

    // Price validation
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    // Sizes validation
    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one size with quantity is required" });
    }
    const sizesArray = sizes.map((sizeData) => ({
      size: sizeData.size,
      quantity: parseInt(sizeData.quantity, 10),
    }));
    const invalidSize = sizesArray.some(
      (size) => !size.size || isNaN(size.quantity) || size.quantity <= 0
    );
    if (invalidSize) {
      return res
        .status(400)
        .json({
          error: "Each size must have a valid name and positive quantity",
        });
    }

    // Calculate total stock count
    const countInStock = sizesArray.reduce(
      (total, size) => total + size.quantity,
      0
    );

    if (images.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    // Create and save product
    const product = new Products({
      name,
      description,
      richDescription,
      brand,
      price: parsedPrice,
      category,
      countInStock,
      sizes: sizesArray,
      images,
      gender,
      badgeText,
    });
    await product.save();
    res.redirect("/admin/product-list");
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

//load edit product

const loadEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const products = await Products.findById(id)
      .populate("category", "name")
      .populate("brand", "name"); // Populate brand
    const categories = await getCategory();
    const brands = await Brands.find(); // Fetch brands

    if (!products) {
      return res.status(404).render("product-edit", {
        categories,
        brands,
        products: null,
        message: "Product not found",
      });
    }

    res.render("product-edit", { categories, brands, products });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const deleteImage = async (req, res) => {
  const imageName = req.query.image;

  const imagePath = path.join(__dirname, "..", "public", "uploads", imageName);

  try {
    const product = await Products.findOne({ images: imageName });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "product not found" });
    }
    await Products.updateMany(
      { images: imageName },
      { $pull: { images: imageName } }
    );

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res
          .status(500)
          .json({ success: false, message: "Error deleting file" });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

//edit product
const editProduct = async (req, res) => {
  const { id } = req.query;

  try {
    const {
      name,
      description,
      richDescription,
      brand,
      price,
      category,
      sizes,
      gender,
      badgeText,
    } = req.body;
    const images = req.files ? req.files.map((file) => file.filename) : [];

    // Fetch categories and brands for rendering
    const categories = await getCategory();
    const brands = await Brands.find();

    // Find the product by ID
    const product = await Products.findById(id)
      .populate("category", "name")
      .populate("brand", "name");

    if (!product) {
      return res.status(404).render("product-edit", {
        products: null,
        categories,
        brands,
        message: "Product not found",
      });
    }

    // Validate required fields
    if (
      !name ||
      !description ||
      !richDescription ||
      !brand ||
      !price ||
      !category ||
      !gender
    ) {
      return res.render("product-edit", {
        products: product,
        categories,
        brands,
        message: "All fields are required",
      });
    }

    // Validate price: ensure it's a positive number
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.render("product-edit", {
        products: product,
        categories,
        brands,
        message: "Price must be a positive number",
      });
    }

    // Parse sizes from form data and validate them
    const sizesArray = Array.isArray(sizes)
      ? sizes.map((sizeData) => ({
          size: sizeData.size,
          quantity: parseInt(sizeData.quantity, 10),
        }))
      : [];

    // Validate sizes: ensure each size has a valid name and a positive quantity
    const invalidSize = sizesArray.some(
      (size) => !size.size || isNaN(size.quantity) || size.quantity <= 0
    );
    if (invalidSize) {
      return res.render("product-edit", {
        products: product,
        categories,
        brands,
        message:
          "Each size must have a valid size name and a positive quantity",
      });
    }

    // Filter images to keep and add new ones
    const imagesToKeep = product.images.filter(
      (image) =>
        !req.body.deletedImages || !req.body.deletedImages.includes(image)
    );
    const updatedImages = [...imagesToKeep, ...images];

    // Update the product
    const updatedProduct = await Products.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          description,
          richDescription,
          brand,
          price: parsedPrice, // Use the validated price
          category,
          sizes: sizesArray,
          images: updatedImages,
          gender,
          badgeText, // Include badgeText
        },
      },
      { new: true }
    );

    if (updatedProduct) {
      return res.redirect("/admin/product-list");
    } else {
      return res.status(400).render("product-edit", {
        products: product,
        categories,
        brands,
        message: "Failed to update the product",
      });
    }
  } catch (error) {
    console.log("Error updating product:", error);
    return res.status(500).send("Server Error");
  }
};

//delete product

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.query;
    const product = await Products.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true } },
      { $upsert: true },
      { new: true }
    );
    if (product) {
      res.redirect("/admin/product-list");
    }
  } catch (error) {}
};
//undo delete product

const undoDeleteProduct = async (req, res) => {
  try {
    const { id } = req.query;
    const product = await Products.findByIdAndUpdate(
      id,
      { $set: { isDeleted: false } },
      { $upsert: true },
      { new: true }
    );
    if (product) {
      res.redirect("/admin/product-list");
    }
  } catch (error) {}
};
//load orders

const loadOrder = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number from query parameter
    const limit = 10; // Number of orders per page
    const skip = (page - 1) * limit;

    // Get paginated orders
    const orders = await Orders.find()
      .sort({ dateOrdered: -1 })
      .populate({ path: "user", select: "firstname lastname email" })
      .populate({
        path: "cartItems",
        populate: { path: "items.product", model: "Products" },
      })
      .skip(skip)
      .limit(limit);

    // Get total count of orders for pagination
    const totalOrders = await Orders.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    // Process order data
    const orderData = orders.map((order) => {
      const itemsTotal = order.cartItems.reduce((acc, cartItem) => {
        const itemTotal = cartItem.items.reduce((itemAcc, item) => {
          return itemAcc + item.product.price * item.quantity;
        }, 0);
        return acc + itemTotal;
      }, 0);
      return {
        id: order._id,
        orderId: order.orderId,
        user: order.user,
        cartItems: order.cartItems.map((cartItem) => ({
          items: cartItem.items.map((item) => ({
            product: item.product,
            quantity: item.quantity,
          })),
        })),
        orderStatus: order.orderStatus,
        status: order.status,
        payment: order.paymentOption,
        dateOrdered: order.dateOrdered,
        orderTotal: itemsTotal,
      };
    });

    res.render("orders", {
      orders: orderData,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error);
  }
};

const orderDetails = async (req, res) => {
  const orderId = req.query.id;

  try {
    const order = await Orders.findById(orderId)
      .populate({ path: "user", select: "firstname lastname mobile" }) // Populate user details
      .populate({
        path: "cartItems", // Populate cart items
        populate: { path: "items.product", model: "Products" }, // Populate product details within cart items
      })
      .populate({
        path: "shippingAddress", // Populate address details
        model: "Address", // Reference the Address model
      });

    if (!order) {
      return res.render("orders-detail", { order: null });
    }

    res.render("orders-detail", { order });
  } catch (error) {
    console.log("Error fetching order details:", error);
    res.status(500).send("Internal Server Error");
  }
};


const changeOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    const order = await Orders.findOne({ orderId });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Update the order status in the database
    order.orderStatus = newStatus;
    await order.save();

    // Respond with success and the new status
    return res.json({
      success: true,
      message: "Order status updated successfully",
      statusColor: "success",
    });
  } catch (error) {
    console.error("Error during order status change:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
//loadcreatecoupon
const loadCoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number from query parameter
    const limit = 10; // Number of coupons per page
    const skip = (page - 1) * limit;

    // Fetch paginated coupons
    const coupons = await Coupon.find().skip(skip).limit(limit);

    // Get the total count of coupons to calculate pagination
    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / limit);

    // Render the page with coupons and pagination information
    res.render("coupon-add", {
      coupons,
      formData: {},
      message: null,
      currentPage: page, // Ensure currentPage is always passed
      totalPages,
    });
  } catch (error) {
    console.log(error);
    res.render("coupon-add", {
      coupons: [],
      formData: {},
      message: "Error loading coupons",
      currentPage: 1,
      totalPages: 1,
    });
  }
};

const createCoupon = async (req, res) => {
  let { couponCode, discount, validUntil, minPurchaseAmount, maxDiscount } =
    req.body;

  let formData = {
    couponCode,
    discount,
    validUntil,
    minPurchaseAmount,
    maxDiscount,
  };
  let errors = {}; // Object to hold field-specific error messages

  try {
    // Ensure couponCode is in uppercase
    if (couponCode) {
      couponCode = couponCode.toUpperCase();
    } else {
      errors.couponCode = "Coupon code is required";
    }

    // Validate discount
    if (discount >= 100) {
      errors.discount = "Discount cannot be equal to or greater than 100%";
    }

    // Validate maxDiscount and minPurchaseAmount
    if (maxDiscount && maxDiscount <= 0) {
      errors.maxDiscount = "Maximum discount must be greater than 0";
    }

    if (minPurchaseAmount && minPurchaseAmount < 0) {
      errors.minPurchaseAmount = "Minimum purchase amount cannot be negative";
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ couponCode });
    if (existingCoupon) {
      errors.couponCode = "Coupon code already exists";
    }

    // If there are errors, re-render the form with error messages
    if (Object.keys(errors).length > 0) {
      return res.render("coupon-add", {
        errors,
        formData,
        coupons: await Coupon.find(),
        currentPage: 1,
        totalPages: Math.ceil((await Coupon.countDocuments()) / 10),
      });
    }

    // Parse the validUntil date
    const parsedValidUntil = new Date(validUntil);

    // Create a new coupon
    const coupon = new Coupon({
      couponCode,
      discount,
      validUntil: parsedValidUntil,
      minPurchaseAmount,
      maxDiscount,
    });

    // Save the coupon to the database
    await coupon.save();

    // Redirect to the form after successful creation
    res.redirect("/admin/create-coupon");
  } catch (error) {
    console.error(error);
    res.render("coupon-add", {
      message: "Internal Server Error",
      formData,
      errors,
      coupons: await Coupon.find(),
      currentPage: 1,
      totalPages: Math.ceil((await Coupon.countDocuments()) / 10),
    });
  }
};

//load edit coupon
const loadEditCoupon = async (req, res) => {
  const { couponId } = req.params;

  try {
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Pass coupon and an empty formData object
    res.render("coupon-edit", { coupon, formData: {}, errors: {} });
  } catch (error) {
    console.error("Error fetching coupon for editing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//edit coupon
const editCoupon = async (req, res) => {
  const { couponId } = req.params;
  let {
    couponCode,
    discount,
    validUntil,
    status,
    maxDiscount,
    minPurchaseAmount,
  } = req.body;

  let errors = {};

  // Validate inputs
  if (!discount || isNaN(discount) || discount <= 0 || discount >= 100) {
    errors.discount = "Discount must be a valid number between 1 and 99";
  }

  if (!validUntil) {
    errors.validUntil = "Validity date is required";
  }

  if (!minPurchaseAmount || isNaN(minPurchaseAmount) || minPurchaseAmount < 0) {
    errors.minPurchaseAmount =
      "Minimum purchase amount must be a non-negative number";
  }

  if (!maxDiscount || isNaN(maxDiscount) || maxDiscount <= 0) {
    errors.maxDiscount = "Maximum discount must be a positive number";
  }

  // Check if there are any errors
  if (Object.keys(errors).length > 0) {
    const coupon = await Coupon.findById(couponId);

    return res.render("coupon-edit", {
      errors,
      formData: {
        couponCode,
        discount,
        validUntil,
        status,
        maxDiscount,
        minPurchaseAmount,
      },
      coupon,
    });
  }

  try {
    // Update coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        $set: {
          discount,
          validUntil,
          status,
          maxDiscount,
          minPurchaseAmount,
        },
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.render("coupon-edit", {
        errors: { general: "Coupon not found" },
        formData: {
          couponCode,
          discount,
          validUntil,
          status,
          maxDiscount,
          minPurchaseAmount,
        },
        coupon: await Coupon.findById(couponId),
      });
    }

    // Redirect to the coupon list after successful update
    res.redirect("/admin/create-coupon");
  } catch (error) {
    console.error("Error editing coupon:", error);
    res.render("coupon-edit", {
      errors: { general: "Internal Server Error" },
      formData: {
        couponCode,
        discount,
        validUntil,
        status,
        maxDiscount,
        minPurchaseAmount,
      },
      coupon: await Coupon.findById(couponId),
    });
  }
};

//update order status

const updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const { status, estimatedDelivery } = req.body;
  try {
    const order = await Orders.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not Found" });
    }

    order.status = status;
    order.estimatedDelivery = estimatedDelivery;
    order.updatedAt = Date.now();
    await order.save();

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

//load offer
const loadOffer = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get current page from query, default to 1
    const limit = 10; // Number of offers per page
    const skip = (page - 1) * limit;

    const totalOffers = await Offers.countDocuments(); // Count total offers
    const totalPages = Math.ceil(totalOffers / limit); // Calculate total pages

    // Fetch limited offers based on pagination parameters
    const offers = await Offers.find()
      .populate("category", "name")
      .populate("product", "name")
      .skip(skip)
      .limit(limit);

    const categories = await Category.find();
    const products = await Products.find();

    const formData = {};
    const errors = {};

    res.render("offer-add", {
      offers,
      categories,
      products,
      formData,
      errors,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error loading offers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//create offer
const createOffer = async (req, res) => {
  let {
    title,
    description,
    type,
    value,
    category,
    product,
    startDate,
    endDate,
    isActive,
  } = req.body;
  const errors = {};

  // Validate inputs
  if (!title) errors.title = "Offer title is required";
  if (!description) errors.description = "Description is required";
  if (!type || !["percentage", "fixed", "bogo"].includes(type))
    errors.type = "Valid offer type is required";
  if (isNaN(value) || value < 0 || (type === "percentage" && value >= 100))
    errors.value = "Invalid offer value";
  if (!startDate) errors.startDate = "Start date is required";
  if (!endDate) errors.endDate = "End date is required";

  if (Object.keys(errors).length > 0) {
    // Fetch categories and products for rendering
    const categories = await Category.find();
    const products = await Products.find();

    // Fetch offers for pagination
    const page = 1; // Reset to page 1 on error
    const limit = 10;
    const totalOffers = await Offers.countDocuments();
    const totalPages = Math.ceil(totalOffers / limit);
    const offers = await Offers.find()
      .populate("category", "name")
      .populate("product", "name")
      .limit(limit)
      .skip((page - 1) * limit);

    return res.render("offer-add", {
      errors,
      formData: req.body,
      categories,
      products,
      offers,
      currentPage: page,
      totalPages,
    });
  }
  // Convert dates from strings to Date objects
  startDate = new Date(startDate);
  endDate = new Date(endDate);

  // Check if dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  // Validate and format ObjectId fields
  if (category && !mongoose.Types.ObjectId.isValid(category))
    errors.category = "Invalid category ID";
  if (product && !mongoose.Types.ObjectId.isValid(product))
    errors.product = "Invalid product ID";

  if (Object.keys(errors).length > 0) {
    // Fetch categories and products for rendering
    const categories = await Category.find();
    const products = await Products.find();
    const offers = await Offers.find()
      .populate("category", "name")
      .populate("product", "name");

    return res.render("offer-add", {
      errors,
      formData: req.body,
      categories,
      products,
      offers,
      currentPage: 1, // Include offers in the context
    });
  }

  try {
    const newOffer = new Offers({
      title,
      description,
      type,
      value,
      category: category || null,
      product: product || null,
      startDate,
      endDate,
      isActive: !!isActive,
    });

    await newOffer.save();

    // Update prices if an offer is created
    if (product) {
      const targetProduct = await Products.findById(product);
      if (targetProduct) {
        let discountedPrice = targetProduct.price;
        if (type === "percentage") {
          discountedPrice =
            targetProduct.price - targetProduct.price * (value / 100);
        } else if (type === "fixed") {
          discountedPrice = targetProduct.price - value;
        }
        discountedPrice = Math.max(discountedPrice, 0); // Ensure the price is not negative
        await Products.findByIdAndUpdate(product, { discountedPrice });
      }
    } else if (category) {
      const productsInCategory = await Products.find({ category });
      for (const prod of productsInCategory) {
        let discountedPrice = prod.price;
        if (type === "percentage") {
          discountedPrice = prod.price - prod.price * (value / 100);
        } else if (type === "fixed") {
          discountedPrice = prod.price - value;
        }
        discountedPrice = Math.max(discountedPrice, 0); // Ensure the price is not negative
        await Products.findByIdAndUpdate(prod._id, { discountedPrice });
      }
    }

    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Error creating offer:", error);
    res
      .status(500)
      .json({ error: "Error creating offer", details: error.message });
  }
};

//load edit offer
const loadEditoffer = async (req, res) => {
  const { offerId } = req.params;

  try {
    const offer = await Offers.findById(offerId);

    if (!offer) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const categories = await Category.find(); // Assuming Category is a model for categories
    const products = await Products.find();

    res.render("edit-offer", { offer, categories, products }); // Render the edit-coupon view with the coupon data
  } catch (error) {
    console.error("Error fetching coupon for editing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
const editOffer = async (req, res) => {
  const { offerId } = req.params;
  let {
    title,
    description,
    type,
    value,
    category,
    product,
    startDate,
    endDate,
    isActive,
  } = req.body;

  // Validate inputs
  if (!title || !description || !type || !value || !startDate || !endDate) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!["percentage", "fixed", "bogo"].includes(type)) {
    return res.status(400).json({ error: "Invalid offer type" });
  }

  if (isNaN(value) || value < 0 || value >= 100) {
    return res.status(400).json({ error: "Invalid offer value" });
  }

  // Convert dates from strings to Date objects
  startDate = new Date(startDate);
  endDate = new Date(endDate);

  // Check if dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  // Handle empty category and product fields
  if (!category) {
    category = null;
  }

  if (!product) {
    product = null;
  }

  try {
    // Find the existing offer
    const existingOffer = await Offers.findById(offerId);
    if (!existingOffer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    // Update the offer
    const updatedOffer = await Offers.findByIdAndUpdate(
      offerId,
      {
        $set: {
          title,
          description,
          type,
          value,
          category,
          product,
          startDate,
          endDate,
          isActive: !!isActive,
        },
      },
      { new: true } // This option returns the modified document
    );

    // Handle price updates if the offer is updated or deactivated
    if (
      existingOffer.isActive !== updatedOffer.isActive ||
      existingOffer.type !== updatedOffer.type ||
      existingOffer.value !== updatedOffer.value ||
      existingOffer.category !== updatedOffer.category ||
      existingOffer.product !== updatedOffer.product
    ) {
      // Update prices for the specific product if it's a product-based offer
      if (updatedOffer.product) {
        const productToUpdate = await Products.findById(updatedOffer.product);
        if (productToUpdate) {
          const newPrice = calculateDiscountedPrice(
            productToUpdate.price,
            updatedOffer.type,
            updatedOffer.value
          );
          await Products.findByIdAndUpdate(updatedOffer.product, {
            discountedPrice: updatedOffer.isActive
              ? newPrice
              : productToUpdate.price,
          });
        }
      }

      // Update prices for all products in the category if it's a category-based offer
      if (updatedOffer.category) {
        const productsInCategory = await Products.find({
          category: updatedOffer.category,
        });
        for (const prod of productsInCategory) {
          const newPrice = calculateDiscountedPrice(
            prod.price,
            updatedOffer.type,
            updatedOffer.value
          );
          await Products.findByIdAndUpdate(prod._id, {
            discountedPrice: updatedOffer.isActive ? newPrice : prod.price,
          });
        }
      }
    }

    res.redirect("/admin/offers"); // Redirect to the offers list or another appropriate page
  } catch (error) {
    console.error("Error editing offer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to calculate the discounted price
const calculateDiscountedPrice = (price, type, value) => {
  let discountedPrice = price;
  if (type === "percentage") {
    discountedPrice = price - price * (value / 100);
  } else if (type === "fixed") {
    discountedPrice = price - value;
  }
  return Math.max(discountedPrice, 0); // Ensure the price is not negative
};
//load banners

const loadbanners = async (req, res) => {
  try {
    // Set up pagination variables
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 5; // Number of banners per page (adjust as needed)
    const skip = (page - 1) * limit;

    // Fetch the paginated banners and the total count
    const banners = await Banners.find()
      .populate("offer")
      .skip(skip)
      .limit(limit);

    const totalBanners = await Banners.countDocuments(); // Total number of banners
    const totalPages = Math.ceil(totalBanners / limit); // Calculate total pages

    // Fetch all offers for dropdown display
    const offers = await Offers.find();

    // Render the banners view with pagination details
    res.render("banners", {
      banners,
      offers,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//create banner
const createBanner = async (req, res) => {
  try {
    const { title, link, offer, isActive } = req.body;

    const images = req.file ? `/uploads/${req.file.filename}` : null;

    // Pagination variables
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 5; // Number of banners per page (adjust as needed)
    const skip = (page - 1) * limit;

    // Fetch offers for dropdown and paginated banners
    const offers = await Offers.find();
    const banners = await Banners.find().skip(skip).limit(limit);

    // Calculate total number of pages
    const totalBanners = await Banners.countDocuments(); // Total number of banners
    const totalPages = Math.ceil(totalBanners / limit); // Calculate total pages

    // Validate required fields
    if (!title || !images) {
      const errorMessage = !title ? "Title is required." : "Image is required.";
      return res.render("banners", {
        message: errorMessage,
        offers,
        banners,
        formData: req.body,
        currentPage: page,
        totalPages,
      });
    }

    // Prepare banner data
    const bannerData = {
      title,
      images,
      link,
      isActive: isActive === "on",
    };

    // Optional offer association
    if (offer) {
      try {
        bannerData.offer = new mongoose.Types.ObjectId(offer);
      } catch (err) {
        console.error("Invalid offer ID format:", err);
        return res.render("banners", {
          message: "Invalid offer ID.",
          formData: req.body,
          offers,
          banners,
          currentPage: page,
          totalPages,
        });
      }
    }

    // Save the new banner
    const banner = new Banners(bannerData);

    await banner.save();

    // Redirect to the first page to avoid issues with missing new banner on current page
    res.redirect("/admin/banners?page=1");
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//load update banner
const loadUpdateBanner = async (req, res) => {
  const { bannerId } = req.params;

  try {
    // Fetch the banner by its ID to populate the form fields
    const banner = await Banners.findById(bannerId);

    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }
    const offers = await Offers.find();

    // Pass the banner data to the EJS template for rendering
    res.render("banner-edit", { banner, offers, formData: {}, error: {} });
  } catch (error) {
    console.error("Error loading banner:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//update a banner

const updateBaner = async (req, res) => {
  // Accessing the bannerId from req.params
  const bannerId = req.params.id; // Assuming the route is like /admin/edit-banner/:id

  const { title, imageUrl, link, offer, isActive } = req.body;

  try {
    // Convert the "isActive" checkbox value from the form into a Boolean
    const isActiveBoolean = isActive === "on"; // 'on' is the default value for checked checkboxes

    // Find and update the banner using the bannerId
    const banner = await Banners.findByIdAndUpdate(
      bannerId, // Use the correct variable here
      { title, imageUrl, link, offer, isActive: isActiveBoolean },
      { new: true } // Return the updated banner
    );

    // If no banner is found, return a 404 error
    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }

    // Send the updated banner as the response
    res.redirect("/admin/banners");
  } catch (error) {
    console.error("Error updating banner:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//delete a banner

const deleteBanner = async (req, res) => {
  const { id } = req.params;

  try {
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ error: "Banner not found" });
    }
    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
const loadBrands = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page, default to 1
    const limit = 10; // Brands per page
    const skip = (page - 1) * limit; // Number of documents to skip

    // Fetch limited brands based on pagination parameters
    const brandData = await Brands.find().skip(skip).limit(limit);

    // Count total documents for pagination
    const totalBrands = await Brands.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit); // Calculate total pages

    res.render("brand", {
      brands: brandData,
      currentPage: page,
      totalPages,
    }); // Adjust view path as needed
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const createBrand = async (req, res) => {
  const { brandname, description, logo, isActive } = req.body;

  const cleanedLogo = (logo || "").trim();
  if (!cleanedLogo) {
    console.error("Brand name or logo URL is missing");
    return res.status(400).json({ error: "Brand name and logo are required" });
  }

  try {
    // Check if the brand already exists
    const existingBrand = await Brands.findOne({ brandname: brandname });

    if (existingBrand) {
      console.error("Brand with this name already exists");
      return res
        .status(400)
        .json({ error: "Brand with this name already exists" });
    }

    // Create and save the brand
    const brand = new Brands({
      brandname,
      description: description || "",
      logo: cleanedLogo,
      isActive: isActive === "on", // Convert 'on' to true
    });

    await brand.save();
    res.redirect("/admin/brands");
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const loadEditbrand = async (req, res) => {
  const { brandId } = req.params;

  try {
    const brands = await Brands.findById(brandId);

    if (!brands) {
      return res.status(404).json({ error: "brand not found" });
    }

    res.render("brand-edit", { brands }); // Render the edit-coupon view with the coupon data
  } catch (error) {
    console.error("Error fetching coupon for editing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update an existing brand
const updateBrand = async (req, res) => {
  const { brandId } = req.body;
  const { brandname, description, logo } = req.body;

  // Check if the checkbox was checked or not
  const isActive = req.body.isActive === "on"; // 'on' if checked, otherwise undefined

  try {
    const updatedBrand = await Brands.findByIdAndUpdate(
      brandId,
      { brandname, description, logo, isActive },
      { new: true } // Return the updated document
    );

    if (!updatedBrand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.redirect("/admin/brands");
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a brand
const deleteBrand = async (req, res) => {
  const { brandId } = req.params;

  try {
    const deletedBrand = await Brands.findByIdAndDelete(brandId);

    if (!deletedBrand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.redirect("/admin/brands");
  } catch (error) {
    console.error("Error deleting brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const generateExcelReport = async (req, res) => {
  try {
    // Fetch data (same as above)
    const totalRevenue = await Orders.aggregate([
      { $match: { orderStatus: "Order placed" } },
      { $group: { _id: null, total: { $sum: "$totalprice" } } },
    ]);

    const totalOrders = await Orders.countDocuments({
      orderStatus: { $ne: "orderPlaced" }, // Adjust as needed
    });

    const cancelledOrders = await Orders.countDocuments({
      orderStatus: "cancelled",
    });

    const refundedOrders = await Orders.countDocuments({
      orderStatus: "refunded",
    });

    // const monthlyEarnings = await Orders.aggregate([
    //   { $match: { orderStatus: 'Order placed', dateOrdered: { $gte: startOfMonth, $lte: endOfMonth } } },
    //   { $group: { _id: null, total: { $sum: '$totalprice' } } }
    // ]);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    worksheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 20 },
    ];

    worksheet.addRow({
      metric: "Total Revenue",
      value: `$${(totalRevenue[0]?.total || 0).toFixed(2)}`,
    });
    worksheet.addRow({ metric: "Total Orders", value: totalOrders });
    worksheet.addRow({ metric: "Cancelled Orders", value: cancelledOrders });
    worksheet.addRow({ metric: "Refunded Orders", value: refundedOrders });
    // worksheet.addRow({ metric: 'Monthly Earnings', value: `$${(monthlyEarnings[0]?.total || 0).toFixed(2)}` });

    // Save file
    const filePath = path.join(__dirname, "report.xlsx");
    await workbook.xlsx.writeFile(filePath);

    // Send file to client
    res.download(filePath);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const loadSales = async (req, res) => {
  res.render("sales");
};
const loadSalesReport = async (req, res) => {
  res.render("salesReport");
};
const salesReport = async (req, res) => {
  try {
    const {
      includeTopProducts,
      includeTopCategories,
      startDate,
      endDate,
      orderStatus,
      customerEmail,
      sortBy = "dateOrdered",
      order = "desc",
      page = 1,
      limit = 10,
      period,
    } = req.query;

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.render("salesReport", {
        message: "Start date cannot be greater than end date.",
        orders: [],
        bestProducts: [],
        bestCategories: [],
      });
    }

    // Handle date filtering
    let dateFilter = {};
    const currentDate = new Date();
    if (period) {
      if (period === "weekly") {
        dateFilter = {
          $gte: new Date(currentDate.setDate(currentDate.getDate() - 7)),
          $lte: new Date(),
        };
      } else if (period === "monthly") {
        dateFilter = {
          $gte: new Date(currentDate.setMonth(currentDate.getMonth() - 1)),
          $lte: new Date(),
        };
      }
    } else if (startDate || endDate) {
      dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
    }

    let filter = {};
    if (Object.keys(dateFilter).length) filter.dateOrdered = dateFilter;
    if (orderStatus) filter.orderStatus = orderStatus;
    if (customerEmail) {
      const user = await User.findOne({ email: customerEmail });
      if (user) filter.user = user._id;
    }

    const orders = await Orders.find(filter)
      .populate({
        path: "cartItems",
        populate: {
          path: "items.product",
          model: "Products",
          select: "name price",
        },
      })
      .sort({ [sortBy]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.render("salesReport", {
      orders,
      period,
      startDate,
      endDate,
      orderStatus,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((await Orders.countDocuments(filter)) / limit),
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

const approveReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order by ID
    const order = await Orders.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check if return is requested
    if (
      !order.returnRequest.isRequested ||
      order.returnRequest.status !== "requested"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "No valid return request found" });
    }

    // Mark the return request as approved
    order.returnRequest.status = "approved";
    order.orderStatus = "returned";
    await order.save();

    // Refund the total price to the user's wallet
    const user = await User.findById(order.user);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const refundAmount = order.totalprice;
    user.wallet += refundAmount;

    // Add transaction to walletTransactions
    user.walletTransactions.push({
      type: "Credit",
      date: new Date(),
      amount: refundAmount,
      description: `Refund for order ${order._id}`,
    });

    await user.save();
    await order.save();

    res
      .status(200)
      .json({
        success: true,
        message: "Return request approved and refund processed",
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  loadAdminRegister,
  adminRegister,
  loadLogin,
  adminLogin,
  adminHome,
  adminLogout,
  userList,
  blockUser,
  unblockUser,
  loadproducts,
  createCategory,
  listCategory,
  editCategoryLoad,
  editCategory,
  deleteCategory,
  undoDeleteCategory,
  loadProductForm,
  addProduct,
  deleteImage,
  loadEditProduct,
  editProduct,
  deleteProduct,
  undoDeleteProduct,
  loadOrder,
  orderDetails,
  createCoupon,
  loadCoupon,
  loadEditCoupon,
  editCoupon,
  changeOrderStatus,
  approveReturnRequest,
  updateOrder,
  loadOffer,
  createOffer,
  loadEditoffer,
  editOffer,
  createBanner,
  loadUpdateBanner,
  updateBaner,
  deleteBanner,
  updateBaner,
  loadbanners,
  loadBrands,
  loadEditbrand,
  createBrand,
  updateBrand,
  deleteBrand,
  generateExcelReport,
  loadSales,
  loadSalesReport,
  salesReport,
};
