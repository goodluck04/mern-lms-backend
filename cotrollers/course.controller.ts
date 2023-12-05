import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.service";
import courseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";

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
    } catch (error: any) {
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
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// we cant put everything on redis but 
// getting single course without purchase will be for than puchased one so we can put htis on redis

// get single course -- without purchasing
export const getSingleCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = req.params.id;
        // if check that the course exist in redis db or not
        const isCacheExist = await redis.get(courseId);
        // if course exist in redis do not cache it again
        if (isCacheExist) {
            const course = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                course,
            })
        } else {
            // cache do not exist in redis db

            // first search mongodb
            const course = await courseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");

            // now chache it for that course for first time
            await redis.set(courseId, JSON.stringify(course));

            res.status(200).json({
                success: true,
                course,
            })
        }



    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});

// get all courses -- without purchasing
export const getAllCourses = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        // check if all courses exist or not in redis
        const isCacheExist = await redis.get("allCourses");
        if (isCacheExist) {
            // if course exist hten send the course
            const courses = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                courses,
            })
        } else {
            // if all course dont exist in redis
            const courses = await courseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");

            // then cache in db
            await redis.set("allCourse", JSON.stringify(courses));
            // send the all course from mongo for the first time
            res.status(200).json({
                success: true,
                courses,
            })
        }

    } catch (error: any) {
        next(new ErrorHandler(error.message, 500))
    }
});

// get course  content -- only for valid use
export const getCourseByUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // check if user bought this course or not
        const userCourseList = req.user?.courses;
        // get d of the course
        const courseId = req.params.id
        // search the course in userCourseList
        const courseExists = userCourseList?.find((course: any) => course._id.toString() === courseId);
        // if the user have not purchased that courses
        if (!courseExists) {
            return next(new ErrorHandler("You are not eligible to access this course", 404))
        };
        // if user have purchased that course then show him the course
        const course = await courseModel.findById(courseId);
        // now return the content of that course that user
        const content = course?.courseData;
        // now return the content for in response
        res.status(200).json({
            success: true,
            content,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
})

// add questions in course
interface IAddQuestionData {
    question: string;
    courseId: string;
    contentId: string;
}

export const addQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // get body
        const { question, courseId, contentId }: IAddQuestionData = req.body;
        // find the course in db
        const course = await courseModel.findById(courseId);
        // search for course content is valid or or not 
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id", 400));
        }
        // findthe content id in course
        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));
        if (!courseContent) {
            return next(new ErrorHandler("Invalid content id", 400));
        }
        // create a new question object
        const newQuestion: any = {
            user: req.user,
            question,
            questionReplies: [],
        };
        // add new Question object to our content
        courseContent.questions.push(newQuestion);
        // save the updated courses
        await course?.save();
        // send the response
        res.status(200).json({
            success: true,
            course,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// add answer in course question
interface IAddAnswerData {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
};

export const addAnswer = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // get the body
        const { answer, courseId, contentId, questionId }: IAddAnswerData = req.body;
        // search for course
        const course = await courseModel.findById(courseId);
        // check whether content id is valid
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id", 400));
        }
        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));
        // looking content 
        if (!courseContent) {
            return next(new ErrorHandler("Invalid content id", 400));
        }
        // finding question id
        const question = courseContent?.questions?.find((item: any) => item._id.equals(questionId));
        // if question dont exist
        if (!question) {
            return next(new ErrorHandler("invalid question id", 400));
        }
        // create answer object
        const newAnswer: any = {
            user: req.user,
            answer,
        }
        // add this answer to our course content
        question.questionReplies.push(newAnswer);
        // save the update replies answer
        await course?.save();
        // if the user create question we get notification
        if (req.user?._id === question.user?._id) {
            // for same user create notification
            // create notification ???
        } else {
            // only send mail if sender reply and receiver is defferent
            // if sender and receiver address is same then it will not send 
            // send email to the user that they got reply for their answer
            const data = {
                name: question,
                title: courseContent.title,
            }
            const html = await ejs.renderFile(path.join(__dirname, "../mails/question-reply.ejs"), data);
            try {
                await sendMail({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data,
                });
            } catch (error) {
                return next(new ErrorHandler(error.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            course,
        })
    } catch (error: any) {
        next(new ErrorHandler(error.message, 500));
    }
})


