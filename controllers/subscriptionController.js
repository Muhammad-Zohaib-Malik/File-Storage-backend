import Stripe from "stripe";
import Subscription from "../models/subscriptionModel.js";
import User from "../models/userModel.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

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

    res.json(new ApiResponse(200, checkoutSession.url));
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

    res.json(new ApiResponse(200, subscription));
  } catch (err) {
    console.log(err);
    next(err);
  }
};

export const pauseSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new ApiError(404, "No active subscription found");
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      pause_collection: { behavior: "void" },
    });

    subscription.isPaused = true;
    await subscription.save();

    const user = await User.findById(req.user._id);
    if (user) {
      user.maxStorageInBytes = 500 * 1024 * 1024; // Free tier
      await user.save();
    }

    res.json(new ApiResponse(200, subscription));
  } catch (err) {
    console.log(err);
    next(err);
  }
};

export const resumeSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new ApiError(404, "No active subscription found");
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      pause_collection: "",
    });

    subscription.isPaused = false;
    await subscription.save();

    const user = await User.findById(req.user._id);
    if (user && subscription.storageBytes) {
      user.maxStorageInBytes = subscription.storageBytes;
      await user.save();
    }

    res.json(new ApiResponse(200, subscription));
  } catch (err) {
    console.log(err);
    next(err);
  }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: "active",
    }).sort({ createdAt: -1 });

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new ApiError(404, "No active subscription found");
    }

    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    subscription.status = "canceled";
    await subscription.save();

    const user = await User.findById(req.user._id);
    if (user) {
      user.maxStorageInBytes = 500 * 1024 * 1024; // 500 MB
      await user.save();
    }

    res.json(new ApiResponse(200, subscription));
  } catch (err) {
    console.log(err);
    next(err);
  }
};

export const getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(new ApiResponse(200, subscriptions));
  } catch (err) {
    console.log(err);
    next(err);
  }
};
