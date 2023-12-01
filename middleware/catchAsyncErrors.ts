import { NextFunction, Request, Response } from "express";
// handle async await
export const CatchAsyncError = (theFunc: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(theFunc(res, req, next)).then(next);
}