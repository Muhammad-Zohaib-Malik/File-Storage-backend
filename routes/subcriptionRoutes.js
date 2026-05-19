import express from "express";
import {
  createSubscription,
  getCurrentSubscription,
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.post("/", createSubscription);
router.get("/", getCurrentSubscription);

export default router;
