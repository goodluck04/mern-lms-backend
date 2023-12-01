import { NextFunction, Request, Response } from "express";

export const CatchAsyncError = (theFunc: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    theFunc(req, res, next).catch(next);
  };
