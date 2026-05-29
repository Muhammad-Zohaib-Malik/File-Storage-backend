import { ObjectId } from "mongodb";
import { ApiError } from "../utils/ApiError.js";

export default function (req, res, next, id) {
  if (!ObjectId.isValid(id)) {
    return next(new ApiError(400, `Invalid ID: ${id}`));
  }
  next();
}
