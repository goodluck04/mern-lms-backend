import express from "express";
import { registrationUser } from "../cotrollers/user.controller";
const router = express.Router();

router.post("/registration",registrationUser);

export default router;