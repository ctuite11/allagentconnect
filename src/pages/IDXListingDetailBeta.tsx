import { Navigate, useParams } from "react-router-dom";

export default function IDXListingDetailBeta() {
  const { mlsNumber } = useParams<{ mlsNumber: string }>();

  if (!mlsNumber) {
    return <Navigate to="/idx" replace />;
  }

  return <Navigate to={`/idx/property/${mlsNumber}`} replace />;
}
