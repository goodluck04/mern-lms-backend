import { Response, Request, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import cloudinary from "cloudinary";
import LayoutModel from "../models/layout.model";
// create layout 
export const createLayout = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // getting body 
        const { type } = req.body;
        // for Banner
        // check if type already exist 
        const isTypeExist = await LayoutModel.findOne({ type })
        if (isTypeExist) {
            return next(new ErrorHandler(`${type} already exist`, 400))
        }
        if (type === "Banner") {
            const { image, title, subTitle } = req.body;
            const myCloud = await cloudinary.v2.uploader.upload(image, { folder: "layout" });
            const banner = {
                image: {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                },
                title,
                subTitle,
            }
            await LayoutModel.create(banner);
        }
        // FAQ
        if (type === "FAQ") {
            const { faq } = req.body;
            // we cannot send array directly in mongodb
            // it will retur object which is acceptable
            const faqItems = await Promise.all(
                faq.map(async (item: any) => {
                    return {
                        question: item.question,
                        answer: item.answer,
                    };
                })
            )
            await LayoutModel.create({ type: "FAQ", faq: faqItems });
        }
        // Categories
        if (type === "Categories") {
            const { categories } = req.body;
            const categoriesItems = await Promise.all(
                categories.map(async (item: any) => {
                    return {
                        title: item.title,
                    };
                })
            );
            await LayoutModel.create({ type: "Categories", categories: categoriesItems });
        }

        // send response
        res.status(200).json({
            success: true,
            message: "Layout created successfully",
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});


// create layout 
export const editLayout = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // getting body 
        const { type } = req.body;

        // for Banner
        if (type === "Banner") {
            // find data in mongo db
            const bannerData: any = await LayoutModel.findOne({ type: "Banner" });
            const { image, title, subTitle } = req.body;
            // first delete the previous image
            if (bannerData) {
                await cloudinary.v2.uploader.destroy(bannerData.image.public_id);
            }
            // upload
            const myCloud = await cloudinary.v2.uploader.upload(image, { folder: "layout" });
            const banner = {
                image: {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                },
                title,
                subTitle,
            }
            await LayoutModel.findByIdAndUpdate(bannerData?._id, { banner });
        }
        // FAQ
        if (type === "FAQ") {
            const { faq } = req.body;
            // search for faq in db
            const faqItem = await LayoutModel.findOne({ type: "FAQ" })
            // we cannot send array directly in mongodb
            // it will retur object which is acceptable
            const faqItems = await Promise.all(
                faq.map(async (item: any) => {
                    return {
                        question: item.question,
                        answer: item.answer,
                    };
                })
            )
            await LayoutModel.findByIdAndUpdate(faqItem?._id, { type: "FAQ", faq: faqItems });
        }
        // Categories
        if (type === "Categories") {
            const { categories } = req.body;
            // find the categories in db
            const categoriesData = await LayoutModel.findOne({ type: "Categories" })
            const categoriesItems = await Promise.all(
                categories.map(async (item: any) => {
                    return {
                        title: item.title,
                    };
                })
            );
            await LayoutModel.findByIdAndUpdate(categoriesData?._id, { type: "Categories", categories: categoriesItems });
        }

        // send response
        res.status(200).json({
            success: true,
            message: "Layout updated successfully",
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// get layout by type
export const getLayoutByType = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.body;
        const layout = await LayoutModel.findOne({ type });
        res.status(201).json({
            success: true,
            layout,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})