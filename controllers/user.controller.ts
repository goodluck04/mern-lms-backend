import "dotenv/config";
import { Request, Response, NextFunction, request } from "express";
import UserModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path"
import sendMail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById } from "../services/user.service";
import cloudinary from "cloudinary";


// register user
interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

export const registrationUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;

        const isEmailExist = await UserModel.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler("Email already exists", 400));
        }
        const user: IRegistrationBody = {
            name,
            email,
            password,
        };
        const activationToken = createActivation(user);
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode }
        // send the dynamica data to the ejs
        const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data)

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation-mail.ejs",
                data,
            });
            res.status(201).json({
                success: true,
                message: `Please check your email: ${user.email} to activate your account`,
                activationToken: activationToken.token,
            })
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
        }


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface IActivationToken {
    token: string;
    activationCode: string;
};

export const createActivation = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({ user, activationCode }, process.env.ACTIVATION_SECRET as Secret, {
        expiresIn: "5m"
    });
    return { token, activationCode }
}


// activate user
interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

export const activateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activation_token, activation_code } = req.body as IActivationRequest;
        const newUser: { user: IUser; activationCode: string } = jwt.verify(
            activation_token,
            process.env.ACTIVATION_SECRET as string
        ) as { user: IUser; activationCode: string }

        if (newUser.activationCode !== activation_code) {
            return next(new ErrorHandler("Invalid activation code", 400))
        }

        const { name, email, password } = newUser.user;
        const existUser = await UserModel.findOne({ email });

        if (existUser) {
            return next(new ErrorHandler("Email already exists", 400))
        }

        const user = await UserModel.create({
            name,
            email,
            password,
        })

        res.status(201).json({
            success: true,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400))
    }
}
)

// Login user
interface ILoginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginRequest;

        if (!email || !password) {
            return next(new ErrorHandler("Please enter email and password", 400));
        }

        const user = await UserModel.findOne({ email }).select("+password");

        if (!user) {
            return next(new ErrorHandler("Invalid email or password", 400));
        }

        const isPasswordMatch = await user.comparedPassword(password);

        if (!isPasswordMatch) {
            return next(new ErrorHandler("Invalid email or password", 400));
        }

        sendToken(user, 200, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})

export const logoutUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });

        // delete cashing as well
        const userId = req.user?._id || "";
        redis.del(userId);

        res.status(200).json({
            success: true,
            message: "Logged out successfully",
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// update access token
export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refresh_token as string;
        // verify token 
        const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

        // message if refresh token is not valid
        const message = "Could not refresh token";
        if (!decoded) {
            return next(new ErrorHandler(message, 400));
        }

        // get session from redis and check if valid or not
        const session = await redis.get(decoded.id as string);
        if (!session) {
            return next(new ErrorHandler(message, 400));
        }

        // if session id valid
        // save it in user and create new access token
        const user = JSON.parse(session);

        const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
            expiresIn: "5m",
        });

        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
            expiresIn: "3d",
        });

        // update user as well
        req.user = user;

        res.cookie("access_token", accessToken, accessTokenOptions);
        res.cookie("refresh_token", refreshToken, refreshTokenOptions);

        // send the update cookies and token
        res.status(200).json({
            status: "success",
            accessToken,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// get user info
export const getUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        getUserById(userId, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}

// Oauth login
export const socialAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, avatar } = req.body as ISocialAuthBody;
        // check if user exist or not
        const user = await UserModel.findOne({ email });

        if (!user) {
            // if user not exist in db then creat neUser save in db and send token
            const newUser = await UserModel.create({ email, name, avatar })
            sendToken(newUser, 200, res);
        } else {
            // if user exist in db then only send the token
            sendToken(user, 200, res);
        }


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
})

interface IUpdateUserInfo {
    name?: string;
    email?: string;
}


// updateuser
export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email } = req.body;
        const userId = req.user?._id;
        // check if is valid or not
        const user = await UserModel.findById(userId);

        // if is valid then update
        if (email && user) {
            // update email should be unique in the data base
            const isEmailExist = await UserModel.findOne({ email });
            if (isEmailExist) {
                return next(new ErrorHandler("Email already exist", 400));
            }
            // if user is valid and email for is unique then change the email
            user.email = email;
        }
        if (name && user) {
            user.name = name;
        }
        // save the changes in db
        await user?.save();

        // update the cache in the redis db
        await redis.set(userId, JSON.stringify(user));
        // send the response 
        res.status(201).json({
            success: true,
            user,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
});


// update password
interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

export const updatePassword = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = req.body as IUpdatePassword;

        // get body
        if (!oldPassword || !newPassword) {
            return next(new ErrorHandler("Please enter old and new password", 400));
        }
        // checking if for valid user
        const user = await UserModel.findById(req.user?._id).select("+password");

        // update redis 
        await redis.set(req.user?._id, JSON.stringify(user))
        // if password doesn't exist
        if (user?.password === undefined) {
            return next(new ErrorHandler("Invalid user", 400));
        }

        // compare password
        const isPasswordMatch = await user?.comparedPassword(oldPassword);

        // if old password is not match
        if (!isPasswordMatch) {
            return next(new ErrorHandler("Invalid old password", 400));
        }
        // save new password in user
        user.password = newPassword;
        // now save user password
        await user.save();

        // send response
        res.status(201).json({
            success: true,
            user,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
});

interface IUpdateProfilePicture {
    avatar: string;
}

// update profile picture
export const updateProfilePicture = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const { avatar } = req.body;
        // get the id of user
        const userId = req.user?._id;
        // search if user exist in db or not
        const user = await UserModel.findById(userId);

        if (avatar && user) {
            // if user have one avatr then call this if
            if (user?.avatar?.public_id) {
                // first delete the old image
                await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
                // then upload new avatar images
                const myCloaud = await cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150,
                });
                // change the user avatar
                user.avatar = {
                    public_id: myCloaud.public_id,
                    url: myCloaud.secure_url,
                }
            } else {
                // if dosent have avatar ,then only upload avar
                const myCloaud = await cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150,
                });
                // change the user avatar
                user.avatar = {
                    public_id: myCloaud.public_id,
                    url: myCloaud.secure_url,
                }
            }
        }

        // now save the url in db
        await user?.save();
        // update redis
        await redis.set(userId, JSON.stringify(user));

        // send response
        res.status(200).json({
            success: true,
            user,
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
});

// get all users --only for admin
export const getAllUsers = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllUsersService(res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})