import { Router } from "express";
import { Signup, Signin, RefreshToken, ForgotPassword, ResetPassword, VerifyEmail, VerifyEmailRedirect } from "../controller/auth.controller";

const authRouter = Router();

authRouter.post("/signup", Signup);
authRouter.post("/signin", Signin);

authRouter.post("/refresh-token", RefreshToken);
authRouter.post("/forgot-password", ForgotPassword);
authRouter.post("/reset-password", ResetPassword);
authRouter.get("/verify-email", VerifyEmailRedirect);
authRouter.post("/verify-email", VerifyEmail);


export default authRouter;