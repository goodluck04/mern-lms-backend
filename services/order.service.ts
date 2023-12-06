import { Response, NextFunction } from 'express';
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import OrderModel from "../models/order.model";


export const newOrder = CatchAsyncError(async (data: any, res: Response, next: NextFunction) => {
    // assuming data is in the request body
    const order = await OrderModel.create(data);
    res.status(201).json({
        success: true,
        order
    });
});
