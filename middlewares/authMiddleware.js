import redisClient from "../config/redis.js";

export async function checkAuth(req, res, next) {
  const { sid } = req.signedCookies;
  if (!sid) {
    res.clearCookie("sid");
    return res.status(401).json({ error: "Not logged In !" });
  }

  const session = await redisClient.json.get(`session:${sid}`);
  if (!session) {
    res.clearCookie("sid");
    return res.status(401).json({ error: "Not logged In !" });
  }

  req.user = {
    _id: session.userId,
    rootDirId: session.rootDirId,
    role: session.role,
  };
  next();
}

export async function checkForRole(req, res, next) {
  if (req.user.role !== "User") return next();
  res.status(403).json({ error: "You cannot access users" });
}

export async function checkForAdminOwner(req, res, next) {
  if (req.user.role === "Admin" || req.user.role === "Owner") return next();
  res.status(403).json({ error: "You cannot access users" });
}
