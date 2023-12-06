import { Response } from "express";
// import UserModel from "../models/use.model"
import { redis } from "../utils/redis";
import UserModel from "../models/user.model";


// get user by id
export const getUserById = async (id: string, res: Response) => {
    // find user from mongodb
    // const user = await UserModel.findById(id);
    // but we are using redis for caching so we can search user theri
    const userJson = await redis.get(id);

    if (userJson) {
        const user = JSON.parse(userJson);
        res.status(201).json({
            success: true,
            user,
        })
    }


    // res.status(201).json({
    //     success: true,
    //     user,
    // })
}

// get all user 
export const getAllUsersService = async (res: Response) => {
    const users = await UserModel.find().sort({ createdAt: -1 });

    res.status(201).json({
        success: true,
        users,
    });
};

