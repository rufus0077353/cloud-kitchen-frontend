import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Simulated user fetch from localStorage or token-based auth
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      navigate("/login");
    } else {
      setUser(storedUser);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div style={styles.container}>
      <h2>Welcome to Cloud Kitchen Dashboard</h2>
      {user && <p>Hello, <strong>{user.name}</strong> 👋</p>}

      <div style={styles.actions}>
        <button onClick={handleLogout} style={styles.button}>Logout</button>
        {/* Add more buttons or navigation links here */}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "2rem",
    textAlign: "center",
  },
  actions: {
    marginTop: "1rem",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    cursor: "pointer",
  },
};

export default Dashboard;