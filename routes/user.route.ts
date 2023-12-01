import express from "express";
import { activateUser, loginUser, registrationUser } from "../cotrollers/user.controller";
const router = express.Router();

router.post("/registration", registrationUser);
router.post("/activate-user", activateUser);
router.post("/login", loginUser);

export default router;