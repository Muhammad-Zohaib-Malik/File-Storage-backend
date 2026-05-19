import { model, Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priceId: {
      type: String,
    },
    checkoutSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeSubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripeCustomerId: {
      type: String,
      index: true,
    },

    status: {
      type: String,
      default: "pending",
    },
    billingInterval: {
      type: String,
      default: "month",
    },
    storageBytes: {
      type: Number,
    },

    storageLabel: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Subscription = model("Subscription", subscriptionSchema);

export default Subscription;
