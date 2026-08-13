"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

function ChatContent() {
  const router = useRouter();
  const params = useSearchParams();

  const vendorId = params.get("vendorId");
  const vendorName = params.get("vendorName");
  const vendorLogo = params.get("vendorLogo");

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const api = process.env.NEXT_PUBLIC_API_URL;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ✅ Auto scroll
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ✅ Fetch chat
  useEffect(() => {
    if (!vendorId) return;
    const token = localStorage.getItem("token");
    if (!token) return alert("Please log in first.");

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${api}/messages/${vendorId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data || []);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error("❌ Error loading chat:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [vendorId]);

  // ✅ Send a message
  const sendMessage = async () => {
    if (!text.trim()) return;
    const token = localStorage.getItem("token");

    try {
      const res = await axios.post(
        `${api}/messages`,
        {
          receiver_id: Number(vendorId),
          message: text.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data?.message) {
        // ✅ Optimistic update
        setMessages((prev) => [...prev, res.data.message]);
        setText("");
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: any) {
      console.error("❌ Failed to send:", err.response?.data || err.message);
      alert("Failed to send message.");
    }
  };

  // ✅ UI loading states
  if (!vendorId)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-gray-500">No vendor selected.</p>
      </div>
    );

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );

  // ✅ Chat UI
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm flex items-center px-4 py-3">
        <button
          onClick={() => router.back()}
          className="mr-3 flex items-center justify-center rounded-full p-1.5 hover:bg-gray-100 transition-all"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <Image
              src={vendorLogo || "/images/placeholder.png"}
              alt={vendorName || "Vendor"}
              fill
              sizes="40px"
              className="rounded-full object-cover border border-gray-200"
            />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-sm sm:text-base">
              {vendorName || "Vendor"}
            </h2>
            <p className="text-xs text-green-500">Online</p>
          </div>
        </div>
      </div>

      {/* CHAT BODY */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">
            No messages yet. Start chatting 👋
          </div>
        ) : (
          messages.map((m) => {
            const currentUserId = Number(localStorage.getItem("userId"));
            const isMe = m.sender_id === currentUserId;
            const msgText = m.message || m.text || "";

            return (
              <div
                key={m.id}
                className={`flex w-full ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                    isMe
                      ? "bg-teal-500 text-white rounded-br-none"
                      : "bg-white text-gray-800 rounded-bl-none border border-gray-200"
                  }`}
                >
                  <p className="break-words">{msgText}</p>
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      isMe ? "text-teal-100" : "text-gray-400"
                    }`}
                  >
                    {new Date(m.created_at || m.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button
          onClick={sendMessage}
          className="bg-teal-500 hover:bg-teal-600 text-white px-5 py-2 rounded-full text-sm font-medium transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* ---------------------- Suspense Wrapper ---------------------- */
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
