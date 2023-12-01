import { Request } from "express";
import { IUser } from "../models/use.model";

declare global {
    namespace Express{
        interface Request{
            user?:IUser
        }
    }
}