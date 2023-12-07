import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";

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
        const course = await CourseModel.findByIdAndUpdate(courseId, {
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
            const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");



            // now cache it for that course for first time it will automatically expire in 7 days=604800
            await redis.set(courseId, JSON.stringify(course), "EX", 604800);

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
            const courses = await CourseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");

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
        const course = await CourseModel.findById(courseId);
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
        const course = await CourseModel.findById(courseId);
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
        // send notification to admin that question is added
        await NotificationModel.create({
            user: req.user?._id,
            title: "New Question Received",
            message: `You have a new question in ${courseContent?.title}`,
        });
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
        const course = await CourseModel.findById(courseId);
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
            await NotificationModel.create({
                user: req.user?._id,
                title: "New Question Reply Received",
                message: `You have a new question reply in ${courseContent.title}`
            })
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

// add review in course
interface IAddReview {
    review: string;
    rating: number;
    userId: string;
}
export const addReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // only purchaed user can review the course
        // get the couse list of user
        const userCourseList = req.user?.courses;
        // get the course id from params
        const courseId = req.params.id;
        // some method return boolean
        const courseExists = userCourseList?.some((course: any) => course._id.toString() === courseId.toString());
        // check if that perticular course exist in user course list or not based on course id
        if (!courseExists) {
            return next(new ErrorHandler("Your arenot eligible to access this course", 404));
        }
        // find the course in db
        const course = await CourseModel.findById(courseId);

        // get review data from body
        const { review, rating } = req.body as IAddReview;
        // create review data
        const reviewData: any = {
            user: req.user,
            rating,
            comment: review,
        }
        // now save the review in mongodb
        course?.reviews.push(reviewData);

        // creating rev average for all reviews obviously
        let avg = 0;
        course?.reviews.forEach((rev: any) => {
            avg += rev.rating;
        });
        // only if there is course
        if (course) {
            course.ratings = avg / course.reviews.length;
        };
        // now save the ratings
        await course?.save();
        // create notification
        const notification = {
            title: "New Review Received",
            message: `${req.user?.name} has given a review in ${course?.name}`,
        }

        // TO DO TASK 
        // create notification

        res.status(200).json({
            success: true,
            course,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// add reply to a review only by the admin
interface IAddReviewData {
    comment: string;
    courseId: string;
    reviewId: string;
};

export const addReplyToReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // get the body
        const { comment, courseId, reviewId } = req.body as IAddReviewData;
        // search for course in db
        const course = await CourseModel.findById(courseId);
        // if not found
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        };
        // serach for review in that course
        const review = course?.reviews?.find((rev: any) => rev._id.toString() === reviewId);
        // if review id not found
        if (!review) {
            return next(new ErrorHandler("Review not found", 404));
        }
        // if course and review found then create review reply
        const replyData: any = {
            user: req.user,
            comment,
        };
        // if there is no commentReplies array then make one
        if (!review.commentReplies) {
            review.commentReplies = [];
        }
        // push the reply in review 
        review.commentReplies?.push(replyData);
        // save the reply data in db
        await course?.save();
        // send response
        res.status(200).json({
            success: true,
            course,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})

// get all course by latest order -- only for admin
export const getAllCourseSorted = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllCoursesService(res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})

// delete user --only for admin
export const deleteCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;        
        const course = await CourseModel.findById(id);
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }
        // else delete course
        await course.deleteOne({ id });
        // clear from redis as well
        await redis.del(id);
        // send response
        res.status(200).json({
            success: true,
            message: "Course deleted succeessfuly",
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})

