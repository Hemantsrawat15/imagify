import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import razorpay from "razorpay";
import transactionModel from "../models/transactionModel.js";
import crypto from "crypto";

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

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const paymentRazorpay = async(req,res)=>{
    try{
        const {planId} = req.body;
        const userId = req.user.id;

        if(!planId){
            return res.status(400).json({success: false, message: "Plan ID is required"});
        }

        const userData = await userModel.findById(userId);
        if(!userData){
            return res.status(400).json({success: false, message: "User not found"});
        }

        let credits, amount;
        switch(planId){
            case "Basic":
                credits = 100;
                amount = 835;
                break;

            case "Advanced":
                credits = 500;
                amount = 4175;
                break;
            
            case "Business":
                credits = 1000;
                amount = 8453;
                break;

            default:
                return res.status(400).json({success: false, message: "Invalid Plan ID"});
        }

        // Create transaction first
        const transactionData = {
            userId,
            plan: planId,
            amount,
            credits,
            date: Date.now()
        }

        const newTransaction = await transactionModel.create(transactionData);
        console.log("Transaction created:", newTransaction);

        // Create Razorpay order
        const options = {
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: newTransaction._id.toString(),
            notes: {
                planId,
                credits,
                userId: userId.toString()
            }
        }

        console.log("Creating Razorpay order with options:", options);
        
        try {
            const order = await razorpayInstance.orders.create(options);
            console.log("Razorpay order created successfully:", order);
            res.status(200).json({success: true, order});
        } catch (razorpayError) {
            console.error("Razorpay order creation failed:", razorpayError);
            // Delete the transaction if order creation fails
            await transactionModel.findByIdAndDelete(newTransaction._id);
            res.status(500).json({success: false, message: "Failed to create payment order", error: razorpayError.message});
        }
    }
    catch(error){
        console.error("Error in paymentRazorpay:", error);
        res.status(500).json({success: false, message: "Internal server error", error: error.message});
    }
}

const verifyRazor = async(req,res)=>{
    try{
        const response = req.body;
        console.log("Payment response:", response);

        const razorpay_signature = response.razorpay_signature;
        const razorpay_order_id = response.razorpay_order_id;
        const razorpay_payment_id = response.razorpay_payment_id;

        if(!razorpay_signature || !razorpay_order_id || !razorpay_payment_id){
            return res.status(400).json({success: false, message: "Invalid payment response"});
        }

        // Get the order details from Razorpay
        const order = await razorpayInstance.orders.fetch(razorpay_order_id);
        console.log("Order details:", order);

        if(!order || order.status !== 'paid'){
            return res.status(400).json({success: false, message: "Payment not completed"});
        }

        // Find the transaction using the receipt ID
        const transaction = await transactionModel.findOne({_id: order.receipt});
        if(!transaction){
            return res.status(400).json({success: false, message: "Transaction not found"});
        }

        // Verify the signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if(generated_signature !== razorpay_signature){
            return res.status(400).json({success: false, message: "Invalid signature"});
        }

        // Update transaction status
        transaction.payment = true;
        await transaction.save();

        // Update user credits
        const user = await userModel.findById(transaction.userId);
        if(!user){
            return res.status(400).json({success: false, message: "User not found"});
        }

        user.creditBalance += transaction.credits;
        await user.save();

        res.status(200).json({success: true, message: "Payment verified successfully"});
    }
    catch(error){
        console.error("Error in verifyRazor:", error);
        res.status(500).json({success: false, message: "Payment verification failed", error: error.message});
    }
}

export {registerUser,loginUser,userCredits,paymentRazorpay,verifyRazor};