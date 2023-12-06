import { NextFunction, Response, Request } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { generateLast12MonthsData } from "../utils/analytics.generator";
import UserModel from "../models/user.model";
import CourseModel from "../models/course.model";
import OrderModel from "../models/order.model";

// get users analytics --admin
export const getUserAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // it will generatelast 12 month data
        const users = await generateLast12MonthsData(UserModel);
        // send response
        res.status(200).json({
            success: true,
            users,
        })
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});

// get courses analytics --admin
export const getCoursesAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // it will generatelast 12 month data
        const courses = await generateLast12MonthsData(CourseModel);
        // send response
        res.status(200).json({
            success: true,
            courses,
        })
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});
// get orders analytics --admin
export const getOrdersAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // it will generatelast 12 month data
        const orders = await generateLast12MonthsData(OrderModel);
        // send response
        res.status(200).json({
            success: true,
            orders,
        })
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});