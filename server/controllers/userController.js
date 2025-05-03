import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const registerUser = async(req,res)=>{
    try{
        const {name,email,password} = req.body;
        if(!name || !email || !password){
            return res.status(400).json({success: false, message: "Missing Details"});
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = jwt.sign({id: user._id},process.env.JWT_SECRET);

        res.status(201).json({success: true,token, user:{name: user.name}});

    }
    catch(error){
        console.log(error);
        res.status(500).json({success: false, message: error.message});
    }
}

const loginUser = async(req,res)=>{
    try{
        const{email,password} = req.body;
        if(!email || !password){
            return res.status(400).json({success: false, message: "Missing Details"});
        }
        const user = await userModel.findOne({email});
        if(!user){
            return res.status(404).json({success: false, message: "User not found"});
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(isMatch){
            const token = jwt.sign({id: user._id},process.env.JWT_SECRET);
            return res.status(200).json({
                success: true,
                token,
                user: {
                    name: user.name,
                    creditBalance: user.creditBalance
                }
            });
        }
        else{
            return res.status(401).json({success: false, message: "Invalid Password"});
        }
    }
    catch(error){
        console.log(error);
        res.status(500).json({success: false, message: error.message});
    }
}

const userCredits = async(req,res)=>{
    try{
        console.log("User ID from auth middleware:", req.user.id);
        const user = await userModel.findById(req.user.id);
        console.log("Found user:", user);
        if (!user) {
            return res.status(404).json({success: false, message: "User not found"});
        }
        console.log("User credit balance:", user.creditBalance);
        res.status(200).json({success: true, credits: user.creditBalance, user:{name: user.name}});
    }
    catch(error){
        console.log("Error in userCredits:", error);
        res.status(500).json({success: false, message: error.message});
    }
}


export {registerUser,loginUser,userCredits};