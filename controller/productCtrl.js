const Products = require("../model/productModel");
const Category = require("../model/categoryModel");
const { options } = require("../routes/userRoute");
const Brands = require("../model/brandModel");
const { default: mongoose } = require("mongoose");
const Banners = require("../model/bannerModal");
const Offers = require("../model/offerModal");
const Cart = require("../model/cartModel");
const Wishlist = require("../model/wishlistModel");

const shopProducts = async (req, res) => {
  const user = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const sortBy = req.query.sort || "featured";
  const category = req.query.category || "";
  const priceMin = parseFloat(req.query.priceMin) || 0;
  const priceMax = parseFloat(req.query.priceMax) || Infinity;
  const searchTerm = req.query.q || "";
  const brandId = req.query.brandId || "";
  const gender = req.query.gender || "";

  try {
    let wishlistQuantity = 0;
    let cartQuantity = 0;

    if (user) {
      const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId: user._id });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    // Sorting criteria
    let sortCriteria = {};
    switch (sortBy) {
      case "price-asc":
        sortCriteria = { finalPrice: 1 };
        break;
      case "price-desc":
        sortCriteria = { finalPrice: -1 };
        break;
      case "a-z":
        sortCriteria = { name: 1 };
        break;
      case "z-a":
        sortCriteria = { name: -1 };
        break;
      case "featured":
      default:
        sortCriteria = { featured: -1 };
        break;
    }

    // Match criteria
    let matchCriteria = {
      isDeleted: false,
      price: { $gte: priceMin, $lte: priceMax },
    };

    if (category) matchCriteria["category.name"] = category;
    if (brandId) matchCriteria["brand.brandname"] = brandId;
    if (gender) matchCriteria["gender"] = gender;

    if (searchTerm && searchTerm.length >= 2) {
      matchCriteria.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { "category.name": { $regex: searchTerm, $options: "i" } },
        { "brand.brandname": { $regex: searchTerm, $options: "i" } },
        { gender: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Main product query
    const productData = await Products.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brand",
        },
      },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "product",
          as: "offer",
        },
      },
      { $unwind: "$category" },
      { $unwind: "$brand" },
      { $unwind: { path: "$offer", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          finalPrice: {
            $cond: {
              if: { $gt: ["$discountedPrice", 0] },
              then: "$discountedPrice",
              else: "$price",
            },
          },
        },
      },
      { $match: matchCriteria },
      { $sort: sortCriteria },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    // Count total products
    const countResult = await Products.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brand",
        },
      },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "product",
          as: "offer",
        },
      },
      { $unwind: "$category" },
      { $unwind: "$brand" },
      { $unwind: { path: "$offer", preserveNullAndEmptyArrays: true } },
      { $match: matchCriteria },
      { $count: "total" },
    ]);

    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Fetch offered products
    const offeredProducts = await Products.aggregate([
      {
        $match: {
          isDeleted: false,
          discountedPrice: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: "$category" },
      { $unwind: "$brand" },
      { $limit: 8 }, // Limit for display
    ]);

    // Render the page
    res.render("product-detail", {
      products: productData,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      user,
      sortBy,
      category,
      categories: await Category.find({ isDeleted: false }),
      priceMin,
      priceMax,
      searchTerm,
      brandId,
      brands: await Brands.find({}),
      gender,
      cartQuantity,
      wishlistQuantity,
      offeredProducts, // Pass offered products
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

// load product detail

const loadProductDetail = async (req, res) => {
  try {
    const user = req.user;
    let wishlistQuantity = 0;
    let cartQuantity = 0;
    if (user) {
      const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId: user._id });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    const id = req.query.id;
    const productData = await Products.findById(id)
      .populate("brand")
      .populate("offer"); // Populate the offer field
    if (!productData) {
      return res.status(404).send("Product not found");
    }

    // Calculate discounted price if there's an active offer
    if (productData.offer && productData.offer.isActive) {
      const { type, value } = productData.offer;
      if (type === "percentage") {
        productData.discountedPrice =
          productData.price - productData.price * (value / 100);
      } else if (type === "fixed") {
        productData.discountedPrice = productData.price - value;
      }
    }

    const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    res.render("product-detail1", {
      product: productData,
      fullUrl,
      user,
      cartQuantity,
      wishlistQuantity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

const loadHome = async (req, res) => {
  try {
    const user = req.user;
    // Fetch all active brands from the database
    let wishlistQuantity = 0;
    let cartQuantity = 0;
    const searchTerm = req.query.q || ""; // Initialize searchTerm
    if (user) {
      const cart = await Cart.findOne({ userId: user._id, orderPlaced: false });
      cartQuantity = cart ? cart.items.length : 0;

      const wishlist = await Wishlist.findOne({ userId: user._id });
      wishlistQuantity = wishlist ? wishlist.products.length : 0;
    }

    const categories = await Category.find({ isDeleted: false });

    const offers = await Offers.find().populate("product").populate("category");

    offers.forEach((offer) => {});

    const brands = await Brands.find({ isActive: true });
    const products = await Products.find()
      .sort({ dateAdded: -1 }) // Sort by 'dateAdded' field in descending order
      .limit(10)
      .populate("brand")
      .populate("category");

    const banners = await Banners.find({ isActive: true }).populate({
      path: "offer",
      populate: {
        path: "category", // Ensure that the category field of the offer is populated
      },
    });

    // Render the landing page and pass the brands to the template
    res.render("landing", {
      user,
      brands,
      products,
      banners,
      categories,
      offers,
      cartQuantity,
      wishlistQuantity,
      searchTerm,
    });
  } catch (error) {
    console.error("Error loading brands:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const searchLanding = async (req, res) => {
  const { query } = req.query; // Get the search query from the URL

  if (!query) {
    return res.redirect("/"); // If no query, redirect to the homepage
  }

  try {
    // Constructing the filter for searching across products, brands, and categories
    const regex = new RegExp(query, "i"); // Case-insensitive regex for search

    // Search products
    const products = await Products.find({
      $or: [{ name: { $regex: regex } }, { description: { $regex: regex } }],
    })
      .limit(10)
      .populate("brand")
      .populate("category");

    // Search brands
    const brands = await Brands.find({
      name: { $regex: regex },
    });

    // Search categories
    const categories = await Category.find({
      name: { $regex: regex },
    });

    // Search offers
    const offers = await Offers.find({
      $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }],
    })
      .populate("product")
      .populate("category");

    // Return the search results to the landing page view
    res.render("landing", {
      query, // Pass the query to the template to show the search term
      products,
      brands,
      categories,
      offers,
      cartQuantity: req.user ? await getCartQuantity(req.user._id) : 0,
    });
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to get the cart quantity
const getCartQuantity = async (userId) => {
  const cart = await Cart.findOne({ userId, orderPlaced: false });
  return cart ? cart.items.length : 0;
};

const calculateDiscount = (offer, price) => {
  if (offer.type === "percentage") {
    return (price * offer.value) / 100;
  } else if (offer.type === "fixed") {
    return offer.value;
  } else if (offer.type === "bogo") {
    return price; // Assuming BOGO is 100% off for simplicity
  }
  return 0;
};

module.exports = {
  shopProducts,
  loadProductDetail,
  loadHome,
};
