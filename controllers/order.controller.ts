
import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/order.model";
import UserModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { newOrder } from "../services/order.service";

// create order

export const createOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // get orderinfo from body
        const { courseId, payment_info } = req.body as IOrder;
        // storing user
        const user = await UserModel.findById(req.user?._id);
        // check whether course is already purchased or not
        const courseExistInUser = user?.courses.some((course: any) => course._id.toString() === courseId);
        // if  purchased already
        if (courseExistInUser) {
            return next(new ErrorHandler("You have already purchased this course", 400));
        }
        // find coursein db
        const course = await CourseModel.findById(courseId);
        // if course not found in db
        if (!course) {
            return next(new ErrorHandler("Course not found", 500));
        }
        // if not purchased then let him purchasedor create order
        const data: any = {
            courseId: course._id,
            userId: user?._id,
        }



        const mailData = {
            order: {
                _id: course._id.toString().slice(0, 6), //0-6 item
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            }
        }

        // targeting send email
        const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confirmation.ejs"), { order: mailData });
        try {
            if (user) {
                await sendMail({
                    email: user.email,
                    subject: "Order Confirmation",
                    template: "order-confirmation.ejs",
                    data: mailData
                });
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
        // update user courses list for purchased course added
        user?.courses.push(course?._id);
        // save the user update data
        await user?.save();
        // send notification to admin that order is create or some one purchased course
        await NotificationModel.create({
            user: user?._id,
            title: "New Order",
            message: `You have a new order from ${course?.name}`,
        });
        // update course purchase statuse increment by 1
        // update course purchase status, increment by 1
        // if (course.purchased !== undefined) {
        //     course.purchased += 1;
        // } else {
        //     course.purchased = 1;
        // }
        // or
        // if course.purchased is null or undefined. If it is, it defaults to 0 before incrementing the value by 1. 
        course.purchased = (course.purchased ?? 0) + 1;
        // update the course satus
        await course.save();
        // create new order as well response
        newOrder(data, res, next);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})

// 