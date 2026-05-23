import jwt, { type SignOptions } from "jsonwebtoken";
import configuration from "../config/configuration";

export interface AuthTokenPayload {
  id?: string;
  email?: string;
  role?: string;
}

const createToken = (
  payload: AuthTokenPayload,
  expiresIn: SignOptions["expiresIn"] = "1h",
): string => {
  return jwt.sign(payload, configuration.JWT_SECRET, { expiresIn });
};

const verifyToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, configuration.JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as AuthTokenPayload;
};

export { createToken, verifyToken };