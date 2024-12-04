const Order = require("../model/orderModel");
const Cart = require("../model/cartModel");
const uuid = require("uuid");
const paypal = require("../config/paypal-config");
const Address = require("../model/addressModel");
const Coupon = require("../model/couponModel");
const util = require("util");
const Products = require("../model/productModel");
const Offers = require("../model/offerModal");
const User = require("../model/userModel");

const { calculateDiscount } = require("../controller/userCtrl");

// Create order
const createOrder = async (req, res) => {
  try {
    const cartId = req.params.cartId;
    const userId = req.user.id;
    const { totalprice, paymentOption, selectedAddress, walletUsedAmount } =
      req.body;

    if (!cartId || !totalprice || !paymentOption || !selectedAddress) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const user = await User.findById(userId);
    const address = await Address.findById(selectedAddress);
    const cart = await Cart.findById(cartId).populate("items.product");

    if (!address) return res.status(404).json({ error: "Address not found." });
    if (!cart) return res.status(404).json({ error: "Cart not found" });
    if (cart.total === 0)
      return res
        .status(400)
        .json({ error: "Cart total is zero. Cannot proceed with the order." });

    let finalTotal = parseFloat(totalprice);
    let walletUsedAmountNum = parseFloat(walletUsedAmount) || 0;

    // Ensure the walletUsedAmount doesn't exceed user wallet balance or order total
    walletUsedAmountNum = Math.min(
      walletUsedAmountNum,
      user.walletBalance,
      finalTotal
    );
    finalTotal -= walletUsedAmountNum;

    // Deduct wallet amount and update transaction history if applicable
    if (walletUsedAmountNum > 0) {
      user.walletBalance -= walletUsedAmountNum;
      user.walletTransactions.push({
        amount: walletUsedAmountNum,
        date: new Date(),
        type: "Debit",
        description: `Used wallet balance for order ${cartId}`,
      });
      await user.save();
    }

    const orderId = uuid.v4();
    const order = new Order({
      orderId,
      cartItems: cartId,
      shippingAddress: selectedAddress,
      user: userId,
      status: "pending",
      dateOrdered: Date.now(),
      totalprice: finalTotal,
      paymentOption: finalTotal === 0 ? "cashOnDelivery" : paymentOption[0],
      walletUsedAmount: walletUsedAmountNum,
    });

    const savedOrder = await order.save();

    if (finalTotal === 0 || paymentOption[0] === "cashOnDelivery") {
      // For Cash on Delivery or zero final total, set status as "Order Placed" directly
      savedOrder.status = "Order Placed";
      await savedOrder.save();
      await Cart.findByIdAndUpdate(
        cartId,
        { $set: { orderPlaced: true } },
        { new: true }
      );

      // Update product quantities in stock
      const cartItems = cart.items;
      for (const item of cartItems) {
        const product = await Products.findById(item.product);
        if (product) {
          const sizeDetail = product.sizes.find(
            (size) => size.size === item.size
          );
          if (sizeDetail) {
            const newQuantity = sizeDetail.quantity - item.quantity;

            // Ensure quantity does not go below zero
            if (newQuantity < 0) {
              return res.status(400).json({
                error: `Not enough stock for ${product.name} in size ${item.size}.`,
              });
            }

            sizeDetail.quantity = newQuantity;
            await product.save();
          }
        }
        item.isActive = false;
      }

      await cart.save();

      res.render("payment-success", {
        savedOrder,
        walletUsedAmount: walletUsedAmountNum,
      });
    } else {
      // If payment required, create PayPal payment
      const transactions = [
        {
          amount: {
            total: finalTotal,
            currency: "USD",
          },
          description: "Order from PRADO",
        },
      ];

      const paymentData = {
        intent: "sale",
        payer: { payment_method: "paypal" },
        redirect_urls: {
          return_url: "http://timewatches.online/payment/success",
          cancel_url: `http://timewatches.online/payment/cancel/${cartId}`,
        },
        transactions,
      };

      paypal.payment.create(paymentData, (error, payment) => {
        if (error) {
          console.error("PayPal Error:", error);
          return res
            .status(500)
            .json({ error: "Error creating PayPal payment." });
        }

        const approvalUrl = payment.links.find(
          (link) => link.rel === "approval_url"
        );
        if (approvalUrl) {
          res.redirect(approvalUrl.href);
        } else {
          res
            .status(500)
            .json({ error: "Approval URL not found in PayPal response." });
        }
      });
    }
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const paymentSuccess = async (req, res) => {
  try {
    const { paymentId, PayerID } = req.query;

    if (paymentId && PayerID) {
      const savedOrder = await Order.findOne({ status: "pending" });

      if (!savedOrder) {
        return res.send("Order not found.");
      }

      const executePayment = {
        payer_id: PayerID,
      };

      paypal.payment.execute(
        paymentId,
        executePayment,
        async (error, payment) => {
          if (error) {
            console.error("Error executing PayPal payment:", error);
            return res.send("Error executing PayPal payment.");
          }

          savedOrder.status = "Payment Received";
          await savedOrder.save();

          const cart = await Cart.findById(savedOrder.cartItems);
          if (cart) {
            cart.items.forEach((item) => {
              item.isActive = false;
            });

            await cart.save();
          }

          // Update product quantities
          const cartItems = cart.items;
          for (const item of cartItems) {
            const product = await Products.findById(item.product);
            if (product) {
              const sizeDetail = product.sizes.find(
                (size) => size.size === item.size
              );
              if (sizeDetail) {
                if (sizeDetail.quantity < item.quantity) {
                  return res.status(400).json({
                    error: `Not enough stock for ${product.name} in size ${item.size}.`,
                  });
                }
              }
            }
          }

          cart.orderPlaced = true;
          await cart.save();

          res.render("payment-success", { savedOrder });
        }
      );
    } else {
      res.send("Invalid PayPal return URL");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const paymentCancel = async (req, res) => {
  const { cartId } = req.params;

  try {
    const cart = await Cart.findById(cartId);

    res.render("payment-cancel", { cartId });
  } catch (error) {
    console.error("Error during payment retry:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  createOrder,
  paymentSuccess,
  paymentCancel,
};
