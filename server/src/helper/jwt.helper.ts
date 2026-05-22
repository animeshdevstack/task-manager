import jwt from "jsonwebtoken";
import configuration from "../config/configuration";

const createToken = (payload: any): string => {
  return jwt.sign(payload, configuration.JWT_SECRET, { expiresIn: "1h" });
}

const signAccessToken = (payload: any): string => {
  return jwt.sign(payload, configuration.JWT_SECRET, { expiresIn: "1h" });
}

const signRefreshToken = (payload: any): string => {
  return jwt.sign(payload, configuration.JWT_SECRET, { expiresIn: "7d" });
}

const verifyToken = (token: string): any => {
  return jwt.verify(token, configuration.JWT_SECRET);
}

export { createToken, signAccessToken, signRefreshToken, verifyToken };