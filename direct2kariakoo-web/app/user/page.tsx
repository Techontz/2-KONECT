"use client";

import { useState } from "react";
import HomePage from "./home/page";
import OrdersPage from "./orders/page";
import MessagesPage from "./messages/page";
import ProfilePage from "./profile/page";
import CategoryScreen from "./categories/page"; // ✅ Add your category screen
import BottomNavBar from "./components/BottomNavBar";

export default function UserMainPage() {
  const [activeTab, setActiveTab] = useState("home");

  // ✅ Dynamically render the correct screen
  const renderPage = () => {
    switch (activeTab) {
      case "category":
        return <CategoryScreen />;
      case "orders":
        return <OrdersPage />;
      case "messages":
        return <MessagesPage />;
      case "profile":
        return <ProfilePage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Main Page Content */}
      <div className="pb-20">{renderPage()}</div>

      {/* Fixed Bottom Navigation */}
      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
