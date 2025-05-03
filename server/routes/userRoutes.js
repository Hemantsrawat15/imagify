import {registerUser,loginUser,userCredits,paymentRazorpay,verifyRazor} from "../controllers/userController.js";
import {Router} from "express";
import userAuth from "../middlewares/auth.js";

const userRouter = Router();

//http://localhost:4000/api/user/register
userRouter.post("/register",registerUser);

//http://localhost:4000/api/user/login
userRouter.post("/login",loginUser);

//http://localhost:4000/api/user/credits
userRouter.get("/credits",userAuth,userCredits);

//http://localhost:4000/api/user/pay-razor
userRouter.post("/pay-razor",userAuth,paymentRazorpay);

//http://localhost:4000/api/user/verify-razor
userRouter.post("/verify-razor",userAuth,verifyRazor);

export default userRouter;
