import express from "express";
import { addAnswer, addQuestion, addReplyToReview, addReview, deleteCourse, editCourse, generateVideoUrl, getAllCourseSorted, getAllCourses, getCourseByUser, getSingleCourse, uploadCourse } from "../controllers/course.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";
const router = express.Router();

router.post("/create-course", updateAccessToken,isAuthenticated, authorizeRoles("admin"), uploadCourse);
router.put("/edit-course/:id", isAuthenticated, authorizeRoles("admin"), editCourse);
router.get("/get-course/:id", getSingleCourse);
router.get("/get-courses", getAllCourses);
router.get("/get-course-content/:id", isAuthenticated, getCourseByUser);
router.put("/add-question", isAuthenticated, addQuestion);
router.put("/add-answer", isAuthenticated, addAnswer);
router.put("/add-review/:id", isAuthenticated, addReview);
router.put("/add-reply", isAuthenticated, authorizeRoles("admin"), addReplyToReview);
router.get("/get-all-courses", isAuthenticated, authorizeRoles("admin"), getAllCourseSorted);
router.delete("/delete-course/:id", isAuthenticated, authorizeRoles("admin"), deleteCourse);

// generateotp
router.post("/getVdoCipherOTP", generateVideoUrl);

export default router;  