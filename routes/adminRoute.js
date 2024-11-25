const User = require("../model/userModel");
const express = require("express");
const upload = require("../config/multerConfig");
const admin_route = express();

admin_route.set("view engine", "ejs");
admin_route.set("views", "./views/admin");

const adminCtrl = require("../controller/adminCtrl");
const { isAdmin, verifyToken } = require("../middlewares/authMiddle");

admin_route.get("/", adminCtrl.loadLogin);
admin_route.post("/login", adminCtrl.adminLogin);
admin_route.get('/adminregister',adminCtrl.loadAdminRegister);
admin_route.post('/adminregister',adminCtrl.adminRegister)
admin_route.get("/home", verifyToken, adminCtrl.adminHome);
admin_route.get('/logout',adminCtrl.adminLogout)
admin_route.get("/users", adminCtrl.userList);

admin_route.get("/block", verifyToken, adminCtrl.blockUser);
admin_route.get("/unblock", verifyToken, adminCtrl.unblockUser);
// admin_route.get('/category',adminCtrl.loadCategory);
admin_route.post("/create-category", adminCtrl.createCategory);
admin_route.get("/category", adminCtrl.listCategory);
admin_route.get("/edit-category",verifyToken,isAdmin,adminCtrl.editCategoryLoad);
admin_route.post("/edit-category", adminCtrl.editCategory);
admin_route.get("/delete-category", adminCtrl.deleteCategory);
admin_route.get("/undo-delete-category", adminCtrl.undoDeleteCategory);
admin_route.get("/product-list", adminCtrl.loadproducts);
admin_route.get("/product-form", adminCtrl.loadProductForm);
admin_route.post("/add-product", upload, adminCtrl.addProduct);
admin_route.delete('/delete-image',adminCtrl.deleteImage);
admin_route.get("/edit-product", adminCtrl.loadEditProduct);
admin_route.post("/edit-product",upload,adminCtrl.editProduct);
admin_route.get('/delete-product',adminCtrl.deleteProduct);
admin_route.get('/undo-delete-product',adminCtrl.undoDeleteProduct);
admin_route.get('/orders',adminCtrl.loadOrder);
admin_route.get('/order-detail',adminCtrl.orderDetails);
admin_route.get('/create-coupon',adminCtrl.loadCoupon);
admin_route.post('/create-coupon',adminCtrl.createCoupon);
admin_route.get('/edit-coupon/:couponId',adminCtrl.loadEditCoupon);
admin_route.post('/edit-coupon/:couponId',adminCtrl.editCoupon);
admin_route.post('/changeOrderStatus',adminCtrl.changeOrderStatus);
admin_route.post('/orders/:orderId/return-request', adminCtrl.approveReturnRequest);
admin_route.get('/offers',adminCtrl.loadOffer);
admin_route.post('/create-offer',adminCtrl.createOffer)
admin_route.get('/edit-offer/:offerId',adminCtrl.loadEditoffer)
admin_route.post('/edit-offer/:offerId',adminCtrl.editOffer);
admin_route.get('/banners',adminCtrl.loadbanners);
admin_route.post('/create-banner',upload,adminCtrl.createBanner);
admin_route.get('/update-banner/:bannerId',adminCtrl.loadUpdateBanner)
admin_route.post('/update-banner/:id',upload,adminCtrl.updateBaner);

admin_route.get('/brands',adminCtrl.loadBrands);
admin_route.get('/edit-brand/:brandId',adminCtrl.loadEditbrand)
admin_route.post('/edit-brand/:brandId',adminCtrl.updateBrand)
admin_route.post('/create-brand',adminCtrl.createBrand);
admin_route.delete('/delete-brand',adminCtrl.deleteBrand);
admin_route.get('/generate-excel-report', adminCtrl.generateExcelReport);
admin_route.get('/sales',adminCtrl.loadSales);
admin_route.get('/salesReport',adminCtrl.salesReport);


module.exports = admin_route;
