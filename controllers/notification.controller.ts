import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import NotificationModel from "../models/notification.model";
import ErrorHandler from "../utils/ErrorHandler";
import { Request, Response, NextFunction } from "express";

// get all notification --only for admins
export const getNotification = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // sorting by createdAt in reverse order
        const notifications = await NotificationModel.find().sort({ createdAt: -1 });
        // send response
        res.status(201).json({
            success: true,
            notifications,
        })
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});

// update notification status --only admin
export const updateNotification = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);
        // if there is notification
        if (!notification) {
            return next(new ErrorHandler("Notification not found", 404));
        } else {
            notification.status ? (notification.status = "read") : notification?.status;
        }
        // save changes in db
        await notification.save();
        // now update the notication list in frontend
        const notifications = await NotificationModel.find().sort({
            createdAt: -1,
        });

        // send response
        res.status(201).json({
            success: true,
            notifications,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});
