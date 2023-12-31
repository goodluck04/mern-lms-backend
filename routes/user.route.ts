import express from "express";
import { activateUser, deleteUser, getAllUsers, getUserInfo, loginUser, logoutUser, registrationUser, socialAuth, updateAccessToken, updatePassword, updateProfilePicture, updateUserInfo, updateUserRole } from "../controllers/user.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
const router = express.Router();

router.post("/registration", registrationUser);
router.post("/activate-user", activateUser);
router.post("/login", loginUser);
router.get("/logout", isAuthenticated, logoutUser);
router.get("/refresh", updateAccessToken, updateAccessToken);
router.get("/me", isAuthenticated, isAuthenticated,getUserInfo);
router.post("/socialAuth", socialAuth);
router.put("/update-user-info", isAuthenticated, updateUserInfo);
router.put("/update-user-password", isAuthenticated, updatePassword);
router.put("/update-user-avatar", isAuthenticated, updateProfilePicture);
router.get("/get-all-users", isAuthenticated, authorizeRoles("admin"), getAllUsers);
router.put("/update-user", isAuthenticated, authorizeRoles("admin"), updateUserRole);
router.delete("/delete-user/:id", isAuthenticated, authorizeRoles("admin"), deleteUser);

// router.get("/logout", isAuthenticated, authorizeRoles("admin"), logoutUser);

export default router;  
