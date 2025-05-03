import { createContext, useEffect } from "react";
import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
export const AppContext = createContext();

const AppContextProvider = (props) => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [credit, setCredit] = useState(0);

  const navigate = useNavigate();

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const loadCreditsData = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/credits`, {
        headers: {
          token,
        },
      });
      if (data.success) {
        setCredit(data.credits);
        setUser(data.user);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadCreditsData();
    } else {
      setCredit(0);
      setUser(null);
    }
  }, [token]);

  const generateImage = async (prompt) => {
    try {
      console.log("Sending request to generate image with prompt:", prompt);
      const { data } = await axios.post(
        `${backendUrl}/api/image/generate-image`,
        { prompt },
        { headers: { token } }
      );
      console.log("Received response:", data);
      
      if (data.success) {
        loadCreditsData();
        return data.resultImage;
      } else {
        toast.error(data.message);
        loadCreditsData();
        if (data.creditBalance === 0) {
          navigate("/buy");
        }
        return null;
      }
    } catch (error) {
      console.error("Error generating image:", error);
      console.error("Error response:", error.response?.data);
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };
    
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCredit(0);
  };

  const value = {
    user,
    setUser,
    showLogin,
    setShowLogin,
    backendUrl,
    token,
    setToken,
    credit,
    setCredit,
    loadCreditsData,
    logout,
    generateImage,
  };

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
};

export default AppContextProvider;
