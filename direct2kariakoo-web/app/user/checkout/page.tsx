"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, CreditCard, Smartphone } from "lucide-react";
import Header from "@/app/user/components/Header";
import { motion, AnimatePresence } from "framer-motion";

export default function CheckoutPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"mobile" | "card" | "manual">("mobile");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [vendorGroups, setVendorGroups] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  const [userAddress, setUserAddress] = useState<any>(null);
  const [addressLoading, setAddressLoading] = useState(true);

  const [networks] = useState(["M-Pesa", "Airtel Money", "Tigo Pesa", "HaloPesa"]);
  const [selectedNetwork, setSelectedNetwork] = useState("M-Pesa");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  /* -------------------------------------------------------------------------- */
  /* 🖥️ Responsive detection                                                    */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const updateLayout = () => setIsDesktop(window.innerWidth >= 1024);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 📍 Fetch User Address                                                      */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const fetchAddress = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/user/login");
          return;
        }

        const meRes = await axios.get(`${apiBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let addressData = meRes.data.address;

        if (typeof addressData === "string") {
            try {
                addressData = JSON.parse(addressData);
            } catch (e) {
                addressData = null;
            }
        }

        setUserAddress(addressData);

      } catch (err) {
        console.error("❌ Failed to fetch address:", err);
      } finally {
        setAddressLoading(false);
      }
    };

    fetchAddress();
  }, [apiBaseUrl, router]);

  /* -------------------------------------------------------------------------- */
  /* ❗ BLOCK Checkout if No Address (after fetching)                           */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!addressLoading && !userAddress) {
      alert("Please add your delivery address first.");
      router.push("/user/address");
    }
  }, [addressLoading, userAddress, router]);

  /* -------------------------------------------------------------------------- */
  /* 🛒 Fetch Cart                                                              */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/user/login");

    const fetchCart = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/cart`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const items = res.data.items || [];
        setCartItems(items);
        const totalAmount = items.reduce(
          (sum: number, it: any) => sum + it.product.new_price * it.quantity,
          0
        );
        setTotal(totalAmount);
      } catch (err) {
        console.error("❌ Failed to load cart:", err);
      }
    };

    fetchCart();
  }, [apiBaseUrl, router]);

  /* -------------------------------------------------------------------------- */
  /* 💳 Fetch vendor groups for Manual Payment                                  */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (tab !== "manual" || !cartItems.length) return;

    const fetchVendors = async () => {
      try {
        setIsLoadingVendors(true);

        const itemsPayload = cartItems.map((item) => ({
          product_id: item.product_id || item.product?.id,
          quantity: item.quantity,
        }));

        const res = await axios.post(
          `${apiBaseUrl}/checkout/vendors`,
          { items: itemsPayload },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = res.data.vendors || [];
        setVendorGroups(data);
      } catch (err: any) {
        console.error("❌ Failed to fetch vendor groups:", err.response?.data || err.message);
        setVendorGroups([]);
      } finally {
        setIsLoadingVendors(false);
      }
    };

    fetchVendors();
  }, [tab, cartItems, apiBaseUrl]);

  /* -------------------------------------------------------------------------- */
  /* 💳 Card Formatting Helpers                                                 */
  /* -------------------------------------------------------------------------- */
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").substring(0, 16);
    const groups = value.match(/.{1,4}/g);
    setCardNumber(groups ? groups.join(" ") : value);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length >= 3) value = `${value.substring(0, 2)}/${value.substring(2, 4)}`;
    setExpiry(value);
  };

  /* -------------------------------------------------------------------------- */
  /* 💰 Payment Logic                                                           */
  /* -------------------------------------------------------------------------- */
  const handlePayment = async (isManualConfirm = false) => {
    if (!userAddress) {
      alert("Please add your address before checkout.");
      router.push("/user/address");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return router.push("/user/login");

    try {
      setLoading(true);
      const itemsPayload = cartItems.map((item) => ({
        product_id: item.product_id || item.product?.id,
        quantity: item.quantity,
      }));

      if (!itemsPayload.length) return alert("Cart is empty.");

      if (tab === "mobile") {
        if (!phone.trim()) return alert("Enter your mobile number");

        await axios.post(
          `${apiBaseUrl}/checkout`,
          { phone, provider: selectedNetwork, items: itemsPayload },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert("Payment initiated!");
        clearCartAndGo();
      }

      if (tab === "card") {
        if (!cardNumber || !expiry || !cvv || !name)
          return alert("Please fill all card details");

        await axios.post(
          `${apiBaseUrl}/checkout/card`,
          {
            card_number: cardNumber.replace(/\s/g, ""),
            expiry,
            cvv,
            name,
            save_card: saveCard,
            items: itemsPayload,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert("Card payment successful!");
        clearCartAndGo();
      }

      if (tab === "manual" && isManualConfirm) {
        await axios.post(
          `${apiBaseUrl}/checkout/confirm-manual`,
          { total, reference: "ManualConfirm", items: itemsPayload },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert("Manual payment confirmed!");
        clearCartAndGo();
      }
    } catch (err: any) {
      console.error("❌ Payment Error:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 🧹 Clear cart and redirect                                                 */
  /* -------------------------------------------------------------------------- */
  const clearCartAndGo = async () => {
    const token = localStorage.getItem("token");
    try {
      await axios.post(`${apiBaseUrl}/cart/clear`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    localStorage.removeItem("cart_items");
    localStorage.removeItem("checkout_total");
    sessionStorage.removeItem("vendors_cache");
    window.dispatchEvent(new Event("cart-updated"));
    router.push("/user/orders");
  };

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/user/cart");
  };

  /* -------------------------------------------------------------------------- */
  /* ✨ RENDER UI                                                               */
  /* -------------------------------------------------------------------------- */
  if (addressLoading) {
    return (
      <div className="p-10 text-center text-gray-600">
        Loading your address...
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {isDesktop && <Header onCategorySelect={() => {}} onSubcategorySelect={() => {}} />}

      {!isDesktop && (
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3 shadow-sm">
          <button
            onClick={handleBack}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition"
          >
            <ArrowLeft size={22} className="text-yellow-500" />
          </button>
          <h1 className="text-[15px] font-semibold text-gray-800">Checkout</h1>
          <div className="w-8" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8">
        {/* LEFT */}
        <div className="flex-1 space-y-8">

          {/* Address */}
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Delivery Address</h3>

              {/* FIXED BUTTON */}
              <button
                onClick={() => router.push("/user/address")}
                className="text-yellow-600 text-sm font-medium hover:underline"
              >
                {userAddress ? "Edit" : "+ Add Address"}
              </button>
            </div>

            <p className="text-sm text-gray-600">
            {userAddress?.address ?? "No address saved."}
            </p>
          </section>

          {/* Payment Methods */}
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Methods</h3>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              {[
                { key: "mobile", label: "Mobile Money", icon: <Smartphone size={16} /> },
                { key: "card", label: "Card", icon: <CreditCard size={16} /> },
                { key: "manual", label: "Manual Payment", icon: <CheckCircle size={16} /> },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className={`flex-1 border rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition ${
                    tab === t.key
                      ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* --- MANUAL PAYMENT --- */}
            {tab === "manual" && (
              <div className="space-y-6 text-gray-700">
                <AnimatePresence>
                  {isLoadingVendors ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="animate-pulse bg-gray-100 border border-gray-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="h-4 w-1/3 bg-gray-200 rounded" />
                          <div className="h-3 w-2/3 bg-gray-200 rounded" />
                          <div className="h-3 w-1/2 bg-gray-200 rounded" />
                          <div className="h-3 w-1/4 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    vendorGroups.map((group) => (
                      <motion.div
                        key={group.vendor.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-gray-900 text-[15px]">
                            {group.vendor.name}
                          </h4>
                          <span className="text-xs text-gray-500">Vendor ID: {group.vendor.id}</span>
                        </div>

                        <ul className="text-sm text-gray-700 space-y-1 mb-3 border-b border-gray-100 pb-2">
                          {group.items.map((it: any) => (
                            <li key={it.id} className="flex justify-between">
                              <span>
                                {it.name} × {it.quantity}
                              </span>
                              <span className="text-yellow-600 font-medium">
                                TZS {(it.price * it.quantity).toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="text-sm font-semibold text-gray-800 flex justify-between items-center mb-2">
                          <span>Total</span>
                          <span className="text-yellow-600 font-bold text-base">
                            TZS {group.total.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 mb-1">Payment Options</div>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {group.vendor.payment_options.length ? (
                            group.vendor.payment_options.map((opt: any) => (
                              <li key={opt.id} className="flex justify-between">
                                <span>{opt.method}</span>
                                <span className="font-medium">{opt.account}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-400 text-xs">No payment methods added</li>
                          )}
                        </ul>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>

                {!isLoadingVendors && vendorGroups.length > 0 && (
                  <button
                    onClick={() => handlePayment(true)}
                    disabled={loading}
                    className={`w-full mt-2 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                      loading
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-yellow-400 hover:bg-yellow-300 text-black"
                    }`}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                    {loading ? "Processing..." : "I Have Paid – Place Order"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT */}
        <aside className="lg:w-[30%]">
          <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Summary</h3>
            <div className="flex justify-between text-sm mb-2">
              <span>Subtotal</span>
              <span className="font-medium">TZS {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span>Delivery fee</span>
              <span className="font-medium text-green-600">-</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-gray-200 pt-3 mt-2">
              <span>Total</span>
              <span className="text-yellow-600 font-bold">TZS {total.toLocaleString()}</span>
            </div>

            {tab !== "manual" && (
              <button
                onClick={() => handlePayment()}
                disabled={loading}
                className={`w-full mt-6 py-3 rounded-lg font-semibold transition ${
                  loading
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-yellow-400 hover:bg-yellow-300 text-black"
                }`}
              >
                {loading ? "Processing..." : "Place Order"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
