import { LoginActivity } from "../models/loginModel.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getLatestLogin = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const latest = await LoginActivity.find({ userId });
    res.status(200).json(new ApiResponse(200, { latest }));
  } catch (error) {
    next(error);
  }
};
