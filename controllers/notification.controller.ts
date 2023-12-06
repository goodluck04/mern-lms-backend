import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import NotificationModel from "../models/notification.model";
import ErrorHandler from "../utils/ErrorHandler";
import { Request, Response, NextFunction } from "express";
import cron from 'node-cron';

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

// delete notification --only admin
// node-cron will automically delete notification after 30 days and createAt more than 30days
cron.schedule("0 0 0 * * *", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await NotificationModel.deleteMany({ status: "read", createdAt: { $lt: thirtyDaysAgo } });
    console.log("Delete read notifications");
})

