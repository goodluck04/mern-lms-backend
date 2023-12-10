import "dotenv/config"
import express, { NextFunction, Request, Response } from "express"
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route"
import orderRouter from "./routes/order.route";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";
  

// body parser
app.use(express.json({ limit: "50mb" }));
  
// cookie parser
app.use(cookieParser());

const allowedOrigins: string = process.env.URL_API
console.log(process.env.URL_API);

// cors
app.use(
    cors({ 
        origin: allowedOrigins,
        credentials: true,

    }))


// routes
app.use("/api/v1", userRouter, courseRouter, orderRouter, notificationRouter, analyticsRouter, layoutRouter);

// testing api
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({
        success: true,
        message: "API is working",
    });
});


// unknown routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
    const err = new Error(`Route ${req.originalUrl} not found`) as any;
    err.statusCode = 404;
    next(err)
});

app.use(ErrorMiddleware);