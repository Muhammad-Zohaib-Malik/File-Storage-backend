import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import { setupTotp, verify2fa, reset2fa } from "../controllers/totpController.js";

const router = express.Router();

router.post("/totp/send", validateIdMiddleware, setupTotp);
router.post("/totp/verify", validateIdMiddleware, verify2fa);
router.post("/totp/reset", validateIdMiddleware, reset2fa);

export default router;
