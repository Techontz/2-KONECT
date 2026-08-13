"use client";

import {
  Home,
  Grid,
  Package,
  MessageSquare,
  User,
} from "lucide-react"; // ✅ clean professional icons

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNavBar({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "category", label: "Category", icon: Grid },
    { key: "orders", label: "Orders", icon: Package },
    { key: "messages", label: "Messages", icon: MessageSquare },
    { key: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 shadow-md z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center text-[13px] font-medium transition-all ${
              isActive ? "text-teal-600" : "text-gray-500"
            }`}
          >
            <Icon
              size={22}
              className={`transition-transform duration-200 ${
                isActive ? "scale-110" : "scale-100"
              }`}
            />
            <span className="mt-1">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
