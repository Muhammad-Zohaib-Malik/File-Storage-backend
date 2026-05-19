import { model, Schema } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: [
        3,
        "name field should a string with at least three characters",
      ],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "please enter a valid email",
      ],
    },
    password: {
      type: String,
      minLength: 8,
    },
    picture: {
      type: String,
      default:
        "https://imgs.search.brave.com/3evpfgurwSBCOyfmtSzvH9y1C1ARWyuAe2RbJGcxL-c/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzLzRiL2Yz/LzJhLzRiZjMyYWU1/ZjA2NzM1YjFkODMx/NzRlOWM5MGEzODVi/LmpwZw",
    },
    role: {
      type: String,
      enum: ["Owner", "Admin", "Manager", "User"],
      default: "User",
    },
    createdWith: {
      type: String,
      enum: ["email", "google", "github"],
    },
    rootDirId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
    },
    IsDeleted: {
      type: Boolean,
      default: false,
    },
    maxStorageInBytes: {
      type: Number,
      required: true,
      default: 500*1024*1024,
    },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = model("User", userSchema);

export default User;
