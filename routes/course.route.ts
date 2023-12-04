import express from "express";
import { uploadCourse } from "../cotrollers/course.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
const router = express.Router();

router.post("/create-course", isAuthenticated, authorizeRoles("admin"), uploadCourse);

export default router;