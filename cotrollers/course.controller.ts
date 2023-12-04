import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.service";
import courseModel from "../models/course.model";

// upload course
export const uploadCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;

        const thumbnail = data.thumbnail;
        // if there is thumbnail
        if (thumbnail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });

            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            }
        }
        createCourse(data, res, next);
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
});


// edit course
export const editCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        // getting thumbnail
        const thumbnail = data.thumbnail;

        // if there is thumbnail
        if (thumbnail) {
            // delete the previous thumbnail
            await cloudinary.v2.uploader.destroy(thumbnail.public_id);
            // upload new thumbnail
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });
            // change data of thumbnail
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            }
        }

        const courseId = req.params.id;
        const course = await courseModel.findByIdAndUpdate(courseId, {
            $set: data
        }, { new: true });

        res.status(201).json({
            success: true,
            course,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
});

