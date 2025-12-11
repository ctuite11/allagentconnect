import { Navigate, useParams } from "react-router-dom";

export default function AgentDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/property/${id}`} replace />;
}
