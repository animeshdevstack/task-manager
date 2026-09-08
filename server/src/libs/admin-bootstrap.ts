import bcrypt from "bcrypt";
import configuration from "../config/configuration";
import { User } from "../model/user.model";

/**
 * Seeds the first admin from env when none exists.
 * Does not sync password from env if an admin already exists.
 */
const bootstrapAdmin = async (): Promise<void> => {
  const email = configuration.ADMIN_EMAIL.trim().toLowerCase();
  const password = configuration.ADMIN_PASSWORD;

  if (!email || !password) {
    console.info(
      "[admin-bootstrap] Skipped: ADMIN_EMAIL / ADMIN_PASSWORD not set",
    );
    return;
  }

  const existingAdmin = await User.findOne({ role: "admin" }).select("_id").lean();
  if (existingAdmin) {
    console.info("[admin-bootstrap] Skipped: admin user already exists");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    Fname: configuration.ADMIN_FNAME.trim() || "Admin",
    Lname: configuration.ADMIN_LNAME.trim() || "User",
    email,
    password: passwordHash,
    role: "admin",
    emailVerified: true,
    isActive: true,
  });

  console.info(`[admin-bootstrap] Seeded admin user: ${email}`);
};

export default bootstrapAdmin;
