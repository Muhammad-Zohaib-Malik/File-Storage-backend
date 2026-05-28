import express from "express";
import {
  createSubscription,
  getCurrentSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  getAllSubscriptions,
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.post("/", createSubscription);
router.get("/", getCurrentSubscription);
router.get("/all", getAllSubscriptions);
router.post("/pause", pauseSubscription);
router.post("/resume", resumeSubscription);
router.post("/cancel", cancelSubscription);

export default router;
