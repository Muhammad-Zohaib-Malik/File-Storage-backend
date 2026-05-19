import Stripe from "stripe";
import Subscription from "../models/subscriptionModel.js";
import User from "../models/userModel.js";

const stripe = new Stripe(process.env.STRIPE_API_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const TB = 1024 * 1024 * 1024 * 1024;

export const PRICE_TO_STORAGE_BYTES = {
  // MONTHLY
  price_1SdlVw3cVYZiLez66kQLuZR4: 2 * TB,
  price_1SdlYs3cVYZiLez6gCY2kxdw: 5 * TB,
  price_1SdlZw3cVYZiLez6gO6iXkKd: 10 * TB,

  // YEARLY
  price_1SdlWe3cVYZiLez6sR5G7rfy: 2 * TB,
  price_1SdlYO3cVYZiLez6MJkKRXrM: 5 * TB,
  price_1SdlZM3cVYZiLez6gO6iXkKd: 10 * TB,
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log("⚠️ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle only checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const subscription = await Subscription.findOne({
        checkoutSessionId: session.id,
      });

      if (!subscription) {
        console.log(
          "Subscription not found for checkoutSessionId:",
          session.id
        );
        return res.status(404).send("Subscription not found");
      }

      // Retrieve the Stripe subscription to get price info
      const stripeSubscription = await stripe.subscriptions.retrieve(
        session.subscription
      );

      const price = stripeSubscription.items.data[0].price;
      const storageBytes = PRICE_TO_STORAGE_BYTES[price.id];

      if (!storageBytes) {
        console.log(`Unknown priceId: ${price.id}`);
        return res.status(400).send(`Unknown priceId: ${price.id}`);
      }

      // Update subscription
      subscription.stripeSubscriptionId = session.subscription;
      subscription.stripeCustomerId = session.customer;
      subscription.status =
        session.payment_status === "paid" ? "active" : "unpaid";
      subscription.priceId = price.id;
      subscription.billingInterval = price.recurring.interval;
      subscription.storageBytes = storageBytes;
      subscription.storageLabel = `${storageBytes / TB} TB`;
      await subscription.save();

      // Update user storage
      const user = await User.findById(subscription.userId);
      if (!user) {
        console.log(`User not found for subscription ${subscription._id}`);
      } else {
        user.maxStorageInBytes = storageBytes;
        await user.save();
      }

      console.log(`Subscription ${subscription._id} updated successfully`);
    } catch (err) {
      console.log("Error processing subscription:", err);
      return res.status(500).send("Server error");
    }
  }

  res.end("Ok");
};
