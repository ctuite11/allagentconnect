import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy route - redirect to /onboarding
const VerifyAgent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/onboarding', { replace: true });
  }, [navigate]);

  return null;
};

export default VerifyAgent;
