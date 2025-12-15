import { Navigate } from "react-router-dom";

// Redirect to Portal - Dashboard foi substituído pelo Portal
const Dashboard = () => {
  return <Navigate to="/" replace />;
};

export default Dashboard;
