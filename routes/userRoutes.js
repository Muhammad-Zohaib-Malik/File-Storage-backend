import express from "express";
import {
  checkAuth,
  checkForAdminOwner,
  checkForRole,
} from "../middlewares/authMiddleware.js";

import {
  changeRole,
  deleteUsingRoleByHardDelete,
  deleteUsingRoleBySoftDelete,
  getAllUsers,
  getCurrentUser,
  githubLoginCallback,
  login,
  loginWithGithub,
  loginWithGoogle,
  logout,
  logoutFromAllDevices,
  logoutUsingRole,
  recoverUserById,
  register,
  sendOTP,
  updatePassword,
  updateUsername,
  verifyOTP,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/", checkAuth, getCurrentUser);
router.post("/logout", logout);
router.post("/logout-all", checkAuth, logoutFromAllDevices);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/google", loginWithGoogle);
router.get("/all", checkAuth, checkForRole, getAllUsers);
router.get("/github", loginWithGithub)
router.get("/github/callback", githubLoginCallback)

//logout by admin and Manager
router.post("/:userId/logout", checkAuth, checkForRole, logoutUsingRole);
//delete by admin and Owner and softDelete
router.delete(
  "/:userId",
  checkAuth,
  checkForAdminOwner,
  deleteUsingRoleBySoftDelete,
);

//delete by admin and Owner for hardDelete
router.delete(
  "/:userId/hard",
  checkAuth,
  checkForAdminOwner,
  deleteUsingRoleByHardDelete,
);
//update by admin hardDelete
router.patch(
  "/:userId/recover",
  checkAuth,
  checkForAdminOwner,
  recoverUserById,
);

//change Role
router.patch("/:userId/change-role", checkAuth, checkForRole, changeRole);

//update password
router.patch("/password", checkAuth, updatePassword);

//update username
router.patch("/name", checkAuth, updateUsername);

export default router;
