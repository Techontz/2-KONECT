"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Loader2,
  Camera,
  Edit2,
  Check,
  MapPin,
  Store,
  Mail,
  Phone,
  CreditCard,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/* 🌟 Vendor Profile — Cached + Shimmer + Smooth UX                            */
/* -------------------------------------------------------------------------- */
export default function VendorProfilePage() {
  const [vendor, setVendor] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  // Payment section
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  const [paymentForm, setPaymentForm] = useState({
    type_id: "",
    method_id: "",
    account: "",
  });

  const CACHE_KEY = "vendor_profile_cache";
  const CACHE_EXPIRY_MS = 5 * 60 * 1000;

  /* -------------------------------------------------------------------------- */
  /* 🧠 Init                                                                    */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const now = Date.now();
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(`${CACHE_KEY}_time`);

    if (cached && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY_MS) {
      const data = JSON.parse(cached);
      populateData(data);
      setLoading(false);
    }

    fetchProfile();
    fetchPaymentTypes();

    const interval = setInterval(fetchProfile, 60000);
    return () => clearInterval(interval);
  }, []);

  function populateData(data: any) {
    setUser(data.user);
    setVendor(data.vendor);
    setPhone(data.vendor?.phone || "");
    setLocation(data.vendor?.business_address || "");
    setPaymentOptions(data.paymentOptions || []);
  }

  /* -------------------------------------------------------------------------- */
  /* 🔁 Fetch Profile                                                           */
  /* -------------------------------------------------------------------------- */
  async function fetchProfile() {
    try {
      setRefreshing(true);
      const res = await api.get("/me");
      const data = res.data.user || res.data;

      const payRes = await api.get("/vendor/payment-options");
      const merged = {
        user: data,
        vendor: data.vendor || {},
        paymentOptions: payRes.data || [],
      };

      populateData(merged);
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      localStorage.setItem(`${CACHE_KEY}_time`, Date.now().toString());
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 💳 Payment Fetchers                                                       */
  /* -------------------------------------------------------------------------- */
  async function fetchPaymentTypes() {
    try {
      const res = await api.get("/vendor/payment-types");
      setPaymentTypes(res.data);
    } catch (err) {
      console.error("Failed to fetch payment types", err);
    }
  }

  async function fetchPaymentMethods(typeId: string) {
    try {
      const res = await api.get(`/vendor/payment-methods?type_id=${typeId}`);
      setPaymentMethods(res.data);
    } catch (err) {
      console.error("Failed to fetch methods", err);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 📸 Upload Logo                                                             */
  /* -------------------------------------------------------------------------- */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      setIsUploading(true);
      await api.post("/vendor/update-profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchProfile();
    } catch {
      alert("Failed to upload picture");
    } finally {
      setIsUploading(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* ✏️ Update Field                                                            */
  /* -------------------------------------------------------------------------- */
  async function handleUpdate(field: string, value: string) {
    if (!value) return alert("Value cannot be empty");

    const formData = new FormData();
    formData.append(field, value);
    try {
      await api.post("/vendor/update-profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchProfile();
    } catch {
      alert("Update failed");
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 💾 Add / Edit Payment                                                      */
  /* -------------------------------------------------------------------------- */
  async function handleSavePayment() {
    const { type_id, method_id, account } = paymentForm;
    if (!type_id || !method_id || !account)
      return alert("Please fill all fields");

    const formData = new FormData();
    formData.append("payment_type_id", type_id);
    formData.append("payment_method_id", method_id);
    formData.append("account", account);

    try {
      setSavingPayment(true);
      if (editingPayment) {
        await api.post(
          `/vendor/update-payment-option/${editingPayment.id}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } else {
        await api.post("/vendor/add-payment-option", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      await fetchProfile();
      setShowPaymentModal(false);
      setPaymentForm({ type_id: "", method_id: "", account: "" });
      setEditingPayment(null);
    } catch {
      alert("Failed to save payment option");
    } finally {
      setSavingPayment(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 🗑️ Delete Payment                                                          */
  /* -------------------------------------------------------------------------- */
  async function handleDeletePayment(id: number) {
    if (!confirm("Remove this payment method?")) return;
    try {
      await api.post(`/vendor/delete-payment-option/${id}`);
      fetchProfile();
    } catch {
      alert("Failed to delete payment option");
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 🪟 Open Payment Modal                                                      */
  /* -------------------------------------------------------------------------- */
  function openPaymentModal(option?: any) {
    if (option) {
      setEditingPayment(option);
      setPaymentForm({
        type_id: option.payment_type?.id || "",
        method_id: option.payment_method?.id || "",
        account: option.account || "",
      });
      fetchPaymentMethods(option.payment_type?.id);
    } else {
      setEditingPayment(null);
      setPaymentForm({ type_id: "", method_id: "", account: "" });
    }
    setShowPaymentModal(true);
  }

  /* -------------------------------------------------------------------------- */
  /* ✨ Shimmer Loader                                                          */
  /* -------------------------------------------------------------------------- */
  const ProfileShimmer = () => (
    <div className="max-w-2xl mx-auto p-5 animate-pulse">
      <div className="flex flex-col items-center mb-8">
        <div className="w-28 h-28 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-24 bg-gray-100 rounded" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white p-4 mb-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="h-3 w-1/2 bg-gray-100 rounded mb-2" />
          <div className="h-4 w-1/3 bg-gray-200 rounded" />
        </div>
      ))}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mt-4">
        <div className="h-4 w-1/3 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-3 w-2/3 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 🌀 Render States                                                           */
  /* -------------------------------------------------------------------------- */
  if (loading) return <ProfileShimmer />;

  const logoUrl = vendor?.logo
    ? `${process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, "")}/${vendor.logo}`
    : "/placeholder.png";

  /* -------------------------------------------------------------------------- */
  /* 💫 Main Render                                                            */
  /* -------------------------------------------------------------------------- */
  return (
    <main className="min-h-screen bg-[#FAFAFA] pb-24 font-poppins animate-fadeIn">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-30">
        <h1 className="text-lg font-semibold text-gray-800 text-center">
          My Profile
        </h1>
        {refreshing && (
          <p className="text-center text-xs text-gray-400 animate-pulse">
            Refreshing profile...
          </p>
        )}
      </header>

      {/* Body */}
      <div className="max-w-2xl mx-auto p-5">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8 relative">
          <div className="relative">
            <Image
              src={logoUrl}
              alt="Vendor Logo"
              width={110}
              height={110}
              className="rounded-full object-cover border-4 border-white shadow-md"
            />
            <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full cursor-pointer shadow-sm hover:bg-gray-100 transition">
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
              ) : (
                <Camera className="w-4 h-4 text-yellow-600" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {vendor?.business_name || "-"}
          </h2>
          <p className="text-gray-500 text-sm">Vendor Account</p>
        </div>

        {/* Vendor Info */}
        <ProfileCard
          icon={<Store className="w-5 h-5 text-yellow-600" />}
          title="Business Name"
          subtitle={vendor?.business_name || "-"}
        />
        <ProfileCard
          icon={<Mail className="w-5 h-5 text-yellow-600" />}
          title="Email"
          subtitle={user?.email || vendor?.email || "-"}
        />
        <EditableRow
          icon={<Phone className="w-5 h-5 text-yellow-600" />}
          label="Phone"
          value={phone}
          editing={editingPhone}
          setEditing={setEditingPhone}
          onSave={(v: string) => handleUpdate("phone", v)}
        />
        <ProfileCard
          icon={<MapPin className="w-5 h-5 text-yellow-600" />}
          title="Business Address"
          subtitle={location || "-"}
          action={
            <button
              onClick={() => alert("Map picker coming soon")}
              className="text-yellow-600 hover:text-yellow-700"
            >
              <Edit2 size={16} />
            </button>
          }
        />

        {/* Payment Options */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-yellow-600" />
              <h4 className="text-sm font-medium text-gray-800">Payment Options</h4>
            </div>
            <button
              onClick={() => openPaymentModal()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-sm font-semibold text-black transition"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {paymentOptions.length > 0 ? (
            paymentOptions.map((opt: any) => (
              <div
                key={opt.id}
                className="flex justify-between items-center bg-gray-50 hover:bg-gray-100 p-3 rounded-xl transition mb-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {opt.payment_type?.name || "-"} – {opt.payment_method?.name || "-"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{opt.account}</p>
                </div>
                <div className="flex gap-3 items-center">
                  <button
                    onClick={() => openPaymentModal(opt)}
                    className="text-yellow-600 hover:text-yellow-700"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeletePayment(opt.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic mt-1">
              No payment options added yet.
            </p>
          )}
        </div>
      </div>

      {/* Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white w-[90%] max-w-md rounded-3xl shadow-2xl p-6 relative animate-fadeIn">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-5">
              {editingPayment ? "Edit Payment Option" : "Add Payment Option"}
            </h3>

            <div className="space-y-4">
              <select
                value={paymentForm.type_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setPaymentForm((p) => ({ ...p, type_id: id, method_id: "" }));
                  fetchPaymentMethods(id);
                }}
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Select Type</option>
                {paymentTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={paymentForm.method_id}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, method_id: e.target.value }))
                }
                disabled={!paymentForm.type_id}
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
              >
                <option value="">Select Method</option>
                {paymentMethods.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Enter account / phone number"
                value={paymentForm.account}
                onChange={(e) => setPaymentForm((p) => ({ ...p, account: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                disabled={savingPayment}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-xl transition disabled:opacity-60"
              >
                {savingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin inline-block" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* 🧩 Subcomponents                                                            */
/* -------------------------------------------------------------------------- */
function ProfileCard({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle: string;
  action?: any;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-start justify-between">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <h4 className="text-sm text-gray-600">{title}</h4>
          <p className="font-medium text-gray-900 mt-1">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EditableRow({ icon, label, value, editing, setEditing, onSave }: any) {
  const [val, setVal] = useState(value);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-start justify-between">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <h4 className="text-sm text-gray-600">{label}</h4>
          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-44 bg-gray-50 focus:ring-2 focus:ring-yellow-400"
              />
              <button
                onClick={() => {
                  onSave(val);
                  setEditing(false);
                }}
                className="p-1 rounded-md bg-yellow-500 text-black font-semibold"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <p className="font-medium text-gray-900 mt-1">{value || "-"}</p>
          )}
        </div>
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-yellow-600 hover:text-yellow-700 transition"
        >
          <Edit2 size={16} />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎬 Fade Animation                                                           */
/* -------------------------------------------------------------------------- */
if (typeof window !== "undefined" && !document.getElementById("fadein-style")) {
  const style = document.createElement("style");
  style.id = "fadein-style";
  style.innerHTML = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fadeIn { animation: fadeIn .3s ease-in-out; }
  `;
  document.head.appendChild(style);
}
