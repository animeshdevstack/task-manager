import { User } from "../model/user.model";
import bcrypt from "bcrypt";
import { createToken, verifyToken } from "../helper/jwt.helper";
import ForgetPasswordEmail from "../email/forget-password.email";
import VerifyEmail from "../email/verify.email";

const SignupService = async(data: any): Promise<any> => {
  try {
    const checkUser: any = await User.findOne({ email: data.email });
    if (checkUser) {
      throw new Error("User already exists");
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    // const user: any = await User.create({ ...data, passwordHash });
    const user: any = new User({ ...data, password: passwordHash });
    await user.save();
    const raw = createToken({
      email: user.email.toLowerCase(),
    }, '1h');
    await VerifyEmail(user.email, raw);
    console.info(`Email verification email sent to ${user.email}`);
    const accessToken = createToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }, '1h');
    const refreshToken = createToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }, '90d');
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
}

const SigninService = async(data: any): Promise<any> => {
  try {
    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw new Error("User not found");
    }
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid password");
      }
    const accessToken = createToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }, "1h");
    const refreshToken = createToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }, "90d");
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
}

const RefreshTokenService = async(refreshToken: string): Promise<any> => {
  try {
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      throw new Error("Invalid refresh token");
    }
    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      throw new Error("User not found");
    }
    const accessToken = createToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    }, "1h");
    return {
      accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
}

const ForgotPasswordService = async(data: any): Promise<any> => {
  try {
    const isUserExists: any = await User.findOne({ email: data.email });
    if (!isUserExists) {
      throw new Error("User not found");
    }
    const raw = createToken({
      email: isUserExists.email.toLowerCase(),
    }, '15m');
    await ForgetPasswordEmail(isUserExists.email, raw);
    console.info(`Password reset email sent to ${isUserExists.email}`);
    return raw;
  }
  catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error", { cause: error });
  }
}

const ResetPasswordService = async(data: any): Promise<any> => {
  try {
    const decoded = verifyToken(data.token);
    if (!decoded) {
      throw new Error("Invalid token");
    }
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      throw new Error("User not found");
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    user.password = passwordHash;
    await user.save();
    return {
      success: true,
      message: "Password reset successfully",
      data: user,
    };
  }
    catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error", { cause: error });
  }
}

const VerifyEmailService = async(data: any): Promise<any> => {
  try {
    const decoded = verifyToken(data.token);
    if (!decoded) {
      throw new Error("Invalid token");
    }
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      throw new Error("User not found");
    }
    user.emailVerified = true;
    await user.save();
    return {
      success: true,
      message: "Email verified successfully",
      data: user,
    };
  }
  catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error", { cause: error });
  }
}

export { 
    SignupService, 
    SigninService, 
    RefreshTokenService, 
    ForgotPasswordService,
    ResetPasswordService,
    VerifyEmailService,
};