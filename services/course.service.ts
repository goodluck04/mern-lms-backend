import { NextFunction, Response } from "express";
import CourseModel from "../models/course.model";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";

// create a course
export const createCourse = CatchAsyncError(async(data: any, res: Response, next: NextFunction) => {
    const course = await CourseModel.create(data);
     
    res.status(201).json({
        success: true,
        course,
    })
})

// get all course 
export const getAllCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({ createdAt: -1 });

    res.status(201).json({
        success: true,
        courses,
    });
};


