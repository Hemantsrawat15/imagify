import userModel from "../models/userModel.js";
import axios from "axios";

export const generateImage = async(req,res)=>{
    try{
        console.log("Received request to generate image");
        const {prompt} = req.body;
        console.log("Prompt:", prompt);
        console.log("User ID:", req.user.id);
        
        const user = await userModel.findById(req.user.id);
        console.log("Found user:", user);
        
        if(!user || !prompt){
            return res.status(400).json({success: false, message: "User or prompt not found"});
        }
        if(user.creditBalance === 0 || user.creditBalance <0){
            return res.status(400).json({success: false, message: "Insufficient credits", creditBalance : user.creditBalance});
        }

        if (!process.env.CLIPDROP_API) {
            console.error("CLIPDROP_API environment variable is not set");
            return res.status(500).json({success: false, message: "API configuration error"});
        }

        console.log("Sending request to Clipdrop API");
        try {
            const {data} = await axios.post("https://clipdrop-api.co/text-to-image/v1", 
                { prompt },
                {
                    headers: {
                        'x-api-key': process.env.CLIPDROP_API,
                        'Content-Type': 'application/json'
                    },
                    responseType: "arraybuffer",
                }
            );
            console.log("Received response from Clipdrop API");

            const base64Image = Buffer.from(data,'binary').toString('base64');
            const resultImage = `data:image/png;base64,${base64Image}`;
            
            console.log("Updating user credits");
            await userModel.findByIdAndUpdate(user._id, {creditBalance: user.creditBalance - 1});
            
            console.log("Sending response to client");
            res.status(200).json({
                success: true, 
                message: "Image generated successfully", 
                creditBalance: user.creditBalance - 1, 
                resultImage
            });
        } catch (apiError) {
            console.error("Clipdrop API error:", apiError.response?.data || apiError.message);
            return res.status(500).json({
                success: false, 
                message: "Error generating image with AI service",
                details: apiError.response?.data || apiError.message
            });
        }
    }
    catch(error){
        console.log("Error in generateImage:", error);
        res.status(500).json({success: false, message: error.message});
    }
}
