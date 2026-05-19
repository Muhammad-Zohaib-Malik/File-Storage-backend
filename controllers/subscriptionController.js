import Stripe from "stripe";
import Subscription from "../models/subscriptionModel.js";

const stripe = new Stripe(process.env.STRIPE_API_KEY);
const BASE_URL = process.env.BASE_URL;

export const createSubscription = async (req, res, next) => {
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      success_url: `${BASE_URL}?payment_success=true`,
      line_items: [
        {
          price: req.body.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      metadata: {
        userId: req.user._id,
      },
    });

    const subscription = new Subscription({
      userId: req.user._id,
      checkoutSessionId: checkoutSession.id,
      status: "pending",
    });

    await subscription.save();

    res.json(checkoutSession.url);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

export const getCurrentSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    res.json(subscription);
  } catch (err) {
    console.log(err);
    next(err);
  }
};
