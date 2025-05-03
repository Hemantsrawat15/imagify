import jwt from "jsonwebtoken";

const userAuth = async(req,res,next)=>{
    const {token} = req.headers;
    if(!token){
        return res.status(401).json({success: false, message: "Unauthorized"});
    }
    try{
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if(tokenDecode.id){
            req.user = { id: tokenDecode.id };
        }
        else{
            return res.status(401).json({success: false, message: "Unauthorized"});
        }
        next();
    }
    catch(error){
        console.log(error);
        res.status(500).json({success: false, message: error.message});
    }
}

export default userAuth;
