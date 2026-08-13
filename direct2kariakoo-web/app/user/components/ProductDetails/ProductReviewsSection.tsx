"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Star, Send, CheckCircle, AlertCircle } from "lucide-react";

// --------------------------------------------------------
// Types
// --------------------------------------------------------
interface Review {
  user: string;
  rating: number;
  comment: string;
  date?: string;
}

interface ProductReviewsSectionProps {
  productId: number;
  token?: string; // optional if using cookies/localStorage
}

// --------------------------------------------------------
// Component
// --------------------------------------------------------
export default function ProductReviewsSection({
  productId,
  token,
}: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

  // --------------------------------------------------------
  // Fetch reviews from backend
  // --------------------------------------------------------
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`
        );
        const data = res.data;
        const reviewsList = Array.isArray(data.reviews) ? data.reviews : [];

        setReviews(reviewsList);
        setAverage(data.average_rating || 0);
        setReviewCount(data.review_count || reviewsList.length);
      } catch (err) {
        console.error("❌ Failed to load reviews:", err);
        setError("Failed to load reviews.");
      } finally {
        setLoading(false);
      }
    };

    if (productId) fetchReviews();
  }, [productId]);

  // --------------------------------------------------------
  // Submit a new review
  // --------------------------------------------------------
  const handleSubmitReview = async () => {
    if (!comment.trim() || rating < 1) {
      setMessage({ type: "info", text: "Please add both rating & comment." });
      return;
    }

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}/review`,
        { rating, comment },
        {
          headers: {
            Authorization: `Bearer ${token || localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage({ type: "success", text: "✅ Review submitted successfully!" });
      setComment("");
      setRating(5);
      setShowForm(false);

      // Refresh reviews
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`
      );
      const data = res.data;
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setAverage(data.average_rating || 0);
      setReviewCount(data.review_count || 0);
    } catch (err: any) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        "Failed to submit review. Please try again.";

      if (status === 409) {
        setMessage({
          type: "info",
          text: "⚠️ You’ve already reviewed this product.",
        });
      } else if (status === 401) {
        setMessage({
          type: "error",
          text: "Please login first to submit a review.",
        });
      } else {
        setMessage({ type: "error", text: msg });
      }
    }
  };

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------
  const renderStars = (count: number, filledColor = "text-yellow-400") => (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={15}
          className={
            i < count
              ? `${filledColor} fill-yellow-400 drop-shadow-sm`
              : "text-gray-300"
          }
        />
      ))}
    </div>
  );

  const renderMessage = () => {
    if (!message) return null;
    const base =
      message.type === "success"
        ? "bg-green-50 text-green-700 border-green-300"
        : message.type === "info"
        ? "bg-blue-50 text-blue-700 border-blue-300"
        : "bg-red-50 text-red-700 border-red-300";

    const Icon =
      message.type === "success"
        ? CheckCircle
        : message.type === "info"
        ? AlertCircle
        : AlertCircle;

    return (
      <div
        className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 mt-3 ${base}`}
      >
        <Icon size={16} />
        <span>{message.text}</span>
      </div>
    );
  };

  if (loading)
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 text-center text-gray-500">
        Loading reviews...
      </div>
    );

  if (error)
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 text-center text-red-500">
        {error}
      </div>
    );

  // --------------------------------------------------------
  // UI
  // --------------------------------------------------------
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-50">
      {/* Header */}
      <h3 className="font-semibold text-gray-900 mb-3 text-lg">
        Ratings & Reviews ({reviewCount})
      </h3>

      {/* Average */}
      <div className="flex items-center mb-5">
        <div className="text-4xl font-extrabold text-teal-600 mr-4">
          {average.toFixed(1)}
        </div>
        <div>
          {renderStars(Math.round(average))}
          <p className="text-sm text-gray-500 mt-0.5">{reviewCount} reviews</p>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <p className="text-gray-500 text-sm">No reviews yet.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="bg-gray-50/60 rounded-lg p-3 transition hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <div className="bg-yellow-100 text-yellow-700 font-semibold w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                  {r.user ? r.user[0] : "U"}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {r.user || "User"}
                  </p>
                  {renderStars(r.rating)}
                </div>
              </div>
              <p className="text-gray-700 text-sm mt-2 leading-snug">
                {r.comment}
              </p>
              {r.date && (
                <p className="text-xs text-gray-400 mt-1">{r.date}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notification */}
      {renderMessage()}

      {/* Write Review Button */}
      <div className="mt-5 flex justify-start">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition"
        >
          {showForm ? "Cancel" : "Write a Review"}
        </button>
      </div>

      {/* Review Form */}
      {showForm && (
        <div className="mt-5 bg-gray-50/80 rounded-xl p-4 shadow-inner">
          <p className="text-sm font-semibold text-gray-800 mb-2 text-center">
            Your Rating
          </p>
          <div className="flex justify-center mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={28}
                onClick={() => setRating(i + 1)}
                className={`cursor-pointer drop-shadow-sm ${
                  i < rating
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write your review..."
            className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={3}
          ></textarea>

          <button
            onClick={handleSubmitReview}
            className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold shadow-sm transition"
          >
            <Send size={15} /> Submit Review
          </button>
        </div>
      )}
    </div>
  );
}
