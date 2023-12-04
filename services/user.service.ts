import { Response } from "express";
// import userModel from "../models/use.model"
import { redis } from "../utils/redis";


// get user by id
export const getUserById = async (id: string, res: Response) => {
    // find user from mongodb
    // const user = await userModel.findById(id);
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

