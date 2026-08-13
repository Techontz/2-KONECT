"use client";

import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import axios from "axios";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface Conversation {
  id: number;
  name: string;
  avatar: string;
  phoneNumber?: string;
  lastMessage: string;
  time: string;
  unread: number;
}

const CACHE_KEY = "d2k_conversations_cache";
const CACHE_TIME_KEY = "d2k_conversations_cache_time";
const CACHE_EXPIRY = 1000 * 60 * 10; // 10 minutes

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Fetch user conversations (with cache)
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Not logged in.");
          setLoading(false);
          return;
        }

        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();

        // ⚡ Show cached instantly
        if (cached && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY) {
          setConversations(JSON.parse(cached));
          setLoading(false);
        }

        // ✅ Background refresh
        const res = await api.get("/conversations");
        
        const data = Array.isArray(res.data) ? res.data : [];
        setConversations(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, now.toString());

        // ✅ Store unread count globally for header
        const totalUnread = data.reduce((acc, c) => acc + (c.unread || 0), 0);
        localStorage.setItem("d2k_unread_count", totalUnread.toString());
        window.dispatchEvent(new Event("messages-updated"));
      } catch (err: any) {
        console.error("❌ Error fetching conversations:", err);
        if (!conversations.length) setError("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  // ✅ Handle open chat
  const handleOpenChat = (conversation: Conversation) => {
    router.push(
      `/user/chat?vendorId=${conversation.id}&vendorName=${encodeURIComponent(
        conversation.name
      )}&vendorLogo=${encodeURIComponent(conversation.avatar || "")}`
    );
  };

  // ✅ Light loading state
  if (loading && conversations.length === 0)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin"></div>
      </div>
    );

  if (error && conversations.length === 0)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );

  if (conversations.length === 0)
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center bg-gray-50">
        <MessageCircle size={40} className="text-gray-400 mb-2" />
        <p className="text-gray-500 text-sm">No conversations yet.</p>
      </div>
    );

  // ✅ Main UI
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm flex items-center px-4 py-3">
        <button
          onClick={() => router.back()}
          className="mr-3 flex items-center justify-center rounded-full p-1.5 hover:bg-gray-100 transition-all"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h2 className="font-semibold text-gray-800 text-lg">Messages</h2>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => handleOpenChat(c)}
            className={`bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md transition cursor-pointer ${
              c.unread > 0 ? "border-teal-200" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative w-11 h-11">
                <img
                  src={c.avatar || "/images/placeholder.png"}
                  alt={c.name}
                  className="w-11 h-11 rounded-full object-cover border border-gray-200"
                />
                {c.unread > 0 && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-teal-500 border-2 border-white rounded-full"></span>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p
                    className={`truncate ${
                      c.unread > 0
                        ? "font-bold text-gray-900"
                        : "font-semibold text-gray-800"
                    }`}
                  >
                    {c.name}
                  </p>
                  <span
                    className={`text-xs ${
                      c.unread > 0
                        ? "text-teal-600 font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {new Date(c.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p
                  className={`text-sm line-clamp-1 ${
                    c.unread > 0
                      ? "text-gray-900 font-medium"
                      : "text-gray-600 font-normal"
                  }`}
                >
                  {c.lastMessage || "No messages yet"}
                </p>

                {c.unread > 0 && (
                  <span className="text-[10px] text-white bg-teal-500 rounded-full px-2 py-[1px] mt-1 inline-block">
                    {c.unread} new
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}