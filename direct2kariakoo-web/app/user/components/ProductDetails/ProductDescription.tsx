"use client";
import { useState } from "react";

export default function ProductDescription({
  description,
}: {
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!description) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-2 text-lg">Description</h3>
      <p
        className={`text-gray-700 text-sm leading-relaxed ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {description}
      </p>
      <button
        className="text-teal-600 font-semibold text-sm mt-1"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? "Less info" : "More info"}
      </button>
    </div>
  );
}
