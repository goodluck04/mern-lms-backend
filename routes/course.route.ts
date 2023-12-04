import express from "express";
import { editCourse, uploadCourse } from "../cotrollers/course.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
const router = express.Router();

router.post("/create-course", isAuthenticated, authorizeRoles("admin"), uploadCourse);
router.put("/edit-course/:id", isAuthenticated, authorizeRoles("admin"), editCourse);

export default router;