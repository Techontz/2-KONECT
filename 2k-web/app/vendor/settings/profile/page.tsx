"use client";

import { useT } from "@/lib/i18n";
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
/* Shapes this screen reads. Deliberately only the fields it uses — the        */
/* endpoints return more, and describing the rest here would be guessing.      */
/* -------------------------------------------------------------------------- */

interface VendorProfile {
  id?: number;
  business_name?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  business_address?: string | null;
  is_approved?: boolean | number | null;
}

interface ProfileUser {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface PaymentType {
  id: number;
  name: string;
}

interface PaymentMethodOption {
  id: number;
  name: string;
}

/** What this screen holds about the signed-in seller, cached and refreshed. */
interface ProfileSnapshot {
  user?: ProfileUser | null;
  vendor?: VendorProfile | null;
  paymentOptions?: PaymentOption[];
}

/** A payout destination the seller has saved. */
interface PaymentOption {
  id: number;
  account?: string | null;
  payment_type?: PaymentType | null;
  payment_method?: PaymentMethodOption | null;
}

/* -------------------------------------------------------------------------- */
/* 🌟 Vendor Profile — Cached + Shimmer + Smooth UX                            */
/* -------------------------------------------------------------------------- */
export default function VendorProfilePage() {
  const t = useT();
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  // Payment section
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentOption | null>(null);

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

  function populateData(data: ProfileSnapshot) {
    setUser(data.user ?? null);
    setVendor(data.vendor ?? null);
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
    if (!confirm(t("seller.removePaymentMethod"))) return;
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
  function openPaymentModal(option?: PaymentOption) {
    if (option) {
      setEditingPayment(option);
      // The form holds ids as strings — a <select> value always is one — while
      // the API returns them as the integers they are in the database.
      const typeId = option.payment_type ? String(option.payment_type.id) : "";

      setPaymentForm({
        type_id: typeId,
        method_id: option.payment_method ? String(option.payment_method.id) : "",
        account: option.account || "",
      });

      if (typeId) void fetchPaymentMethods(typeId);
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
              alt={t("seller.vendorLogo")}
              width={110}
              height={110}
              className="rounded-full object-cover border-4 border-white shadow-md"
            />
            <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full cursor-pointer shadow-sm hover:bg-gray-100 transition">
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[color:var(--color-brand)]" />
              ) : (
                <Camera className="w-4 h-4 text-[color:var(--color-brand)]" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {vendor?.business_name || "-"}
          </h2>
          <p className="text-gray-500 text-sm">{t("seller.vendorAccount")}</p>
        </div>

        {/* Vendor Info */}
        <ProfileCard
          icon={<Store className="w-5 h-5 text-[color:var(--color-brand)]" />}
          title={t("seller.businessName")}
          subtitle={vendor?.business_name || "-"}
        />
        <ProfileCard
          icon={<Mail className="w-5 h-5 text-[color:var(--color-brand)]" />}
          title={t("seller.email")}
          subtitle={user?.email || vendor?.email || "-"}
        />
        <EditableRow
          icon={<Phone className="w-5 h-5 text-[color:var(--color-brand)]" />}
          label={t("seller.phone")}
          value={phone}
          editing={editingPhone}
          setEditing={setEditingPhone}
          onSave={(v: string) => handleUpdate("phone", v)}
        />
        <ProfileCard
          icon={<MapPin className="w-5 h-5 text-[color:var(--color-brand)]" />}
          title={t("seller.businessAddress")}
          subtitle={location || "-"}
          action={
            <button
              type="button"
              aria-label={t("seller.editBusinessAddress")}
              onClick={() => alert("Map picker coming soon")}
              className="text-[color:var(--color-brand)] hover:text-[color:var(--color-brand-strong)]"
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
          }
        />

        {/* Payment Options */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[color:var(--color-brand)]" />
              <h4 className="text-sm font-medium text-gray-800">Payment Options</h4>
            </div>
            <button
              onClick={() => openPaymentModal()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-strong)] text-sm font-semibold text-white transition"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {paymentOptions.length > 0 ? (
            paymentOptions.map((opt) => (
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
                    type="button"
                    aria-label={`Edit ${opt.payment_method?.name || "payment"} details`}
                    onClick={() => openPaymentModal(opt)}
                    className="text-[color:var(--color-brand)] hover:text-[color:var(--color-brand-strong)]"
                  >
                    <Edit2 size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${opt.payment_method?.name || "payment"} details`}
                    onClick={() => handleDeletePayment(opt.id)}
                    className="text-[#c62828] hover:text-[#8e1f1f]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
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
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[color:var(--color-brand-400)]"
              >
                <option value="">Select Type</option>
                {paymentTypes.map((t) => (
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
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[color:var(--color-brand-400)] disabled:opacity-50"
              >
                <option value="">Select Method</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder={t("seller.accountOrPhone")}
                value={paymentForm.account}
                onChange={(e) => setPaymentForm((p) => ({ ...p, account: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[color:var(--color-brand-400)]"
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
                className="px-5 py-2 bg-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-strong)] text-white font-semibold rounded-xl transition disabled:opacity-60"
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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
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

function EditableRow({
  icon,
  label,
  value,
  editing,
  setEditing,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  setEditing(editing: boolean): void;
  onSave(value: string): void;
}) {
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
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-44 bg-gray-50 focus:ring-2 focus:ring-[color:var(--color-brand-400)]"
              />
              <button
                type="button"
                aria-label={`Save ${label}`}
                onClick={() => {
                  onSave(val);
                  setEditing(false);
                }}
                className="p-1 rounded-md bg-[color:var(--color-brand)] text-white font-semibold"
              >
                <Check size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="font-medium text-gray-900 mt-1">{value || "-"}</p>
          )}
        </div>
      </div>
      {!editing && (
        <button
          type="button"
          aria-label={`Edit ${label}`}
          onClick={() => setEditing(true)}
          className="text-[color:var(--color-brand)] hover:text-[color:var(--color-brand-strong)] transition"
        >
          <Edit2 size={16} aria-hidden="true" />
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
