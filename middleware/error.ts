import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
export const ErrorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal server error"

    // wrong mongodb id error
    if (err.name === "CastError") {
        const message = `Resources not found, Invalid: ${err.path}`
    }

    // Dulpicate key error
    if (err.code === 11000) {
        const message = `Dublicate ${Object.keys(err.keyValue)} entered`;
        err = new ErrorHandler(message, 400);
    }

    // wrong JWT error
    if (err.name === "JsonWebTokenError") {
        const message = `Json web Token is invalid, try again`;
        err = new ErrorHandler(message, 400);
    }

    // JWT expire error
    if (err.name === "TokenExpiredError") {
        const message = `Json web Token is Expired, try again`;
        err = new ErrorHandler(message, 400)
    }

    // send error response for above errors
    res.status(err.statusCode).json({
        success: false,
        message: err.message
    })
}