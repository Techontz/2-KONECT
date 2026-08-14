"use client";

import { useState } from "react";

export default function VendorNotificationsPage() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-24">
      <header className="bg-white shadow-sm px-5 py-4 text-center font-semibold text-gray-800 text-lg">
        🔔 Notifications
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Manage Notifications
        </h2>

        <Toggle
          label="Push Notifications"
          checked={pushEnabled}
          onChange={setPushEnabled}
        />
        <Toggle
          label="Email Alerts"
          checked={emailEnabled}
          onChange={setEmailEnabled}
        />

        <div className="mt-8 text-sm text-gray-500">
          You’ll receive important updates about your store activities.
        </div>
      </div>
    </main>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-3 flex items-center justify-between">
      <span className="text-gray-800 font-medium">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition ${
          checked ? "bg-teal-600" : "bg-gray-300"
        } relative`}
      >
        <span
          className={`absolute top-0.5 left-[2px] h-5 w-5 bg-white rounded-full shadow transition ${
            checked ? "translate-x-6" : ""
          }`}
        ></span>
      </button>
    </div>
  );
}
