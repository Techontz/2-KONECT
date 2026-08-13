"use client";
import { useState } from "react";

interface Props {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

export default function InputCardField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  readOnly = false,
}: Props) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex flex-col mb-3 border border-gray-100">
      <label className="text-sm font-semibold text-gray-800 mb-1">
        {label}
      </label>
      <div className="flex items-center">
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          className="flex-1 outline-none text-gray-800 text-[15px] font-medium placeholder:text-gray-400 bg-transparent"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-gray-400 ml-2"
          >
            {show ? "🙈" : "👁️"}
          </button>
        )}
      </div>
    </div>
  );
}
