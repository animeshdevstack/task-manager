import { Request, Response } from "express";
import configuration from "../config/configuration";
import { ForgotPasswordService, RefreshTokenService, ResetPasswordService, SigninService, SignupService, VerifyEmailService } from "../service/auth.service";

const Signup = async(req: Request, res: Response) => {
  try {
    const signupData = req.body;
    const signupService = await SignupService(signupData);
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: signupService,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
}

const Signin = async(req: Request, res: Response) => {
  try {
    const signinData = req.body;
    const signinService = await SigninService(signinData);
    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: signinService,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
}

const RefreshToken = async(req: Request, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken || typeof refreshToken !== "string") {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }
    const refreshTokenData = await RefreshTokenService(refreshToken);
    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: refreshTokenData,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Invalid or expired refresh token",
    });
  }
}

const ForgotPassword = async(req: Request, res: Response) => {
  try {
    const forgotPasswordData = req.body;
    const forgotPasswordResponse = await ForgotPasswordService(forgotPasswordData);
    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully",
      data: forgotPasswordResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
}

const ResetPassword = async(req: Request, res: Response) => {
  try {
    const resetPasswordData = req.body;
    const resetPasswordResponse = await ResetPasswordService(resetPasswordData);
    res.status(200).json({
      success: true,
      message: "Password reset successfully",
      data: resetPasswordResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
}

const VerifyEmail = async(req: Request, res: Response) => {
  try {
    const verifyEmailData = req.body;
    const verifyEmailResponse = await VerifyEmailService(verifyEmailData);
    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: verifyEmailResponse,
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
}

/** Opens from email link; verifies token then redirects to the SPA */
const VerifyEmailRedirect = async(req: Request, res: Response) => {
  const loginSuccess = `${configuration.FRONTEND_URL}/login?verified=1`;
  const signupError = `${configuration.FRONTEND_URL}/signup?verify=error`;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) {
    res.redirect(302, signupError);
    return;
  }
  try {
    await VerifyEmailService({ token });
    res.redirect(302, loginSuccess);
  } catch {
    res.redirect(302, signupError);
  }
};

export { 
  Signup, 
  Signin, 
  RefreshToken,
  ForgotPassword,
  ResetPassword,
  VerifyEmail,
  VerifyEmailRedirect,
 };
