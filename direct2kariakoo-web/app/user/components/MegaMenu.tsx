// "use client";
// import { useEffect, useState } from "react";
// import Image from "next/image";
// import axios from "axios";

// export default function MegaMenu({ category, onClose }: any) {
//   const [subcategories, setSubcategories] = useState<any[]>([]);
//   const [brands] = useState([
//     { name: "L'Oreal", logo: "/brands/loreal.png" },
//     { name: "NYX", logo: "/brands/nyx.png" },
//     { name: "Versace", logo: "/brands/versace.png" },
//     { name: "Philips", logo: "/brands/philips.png" },
//     { name: "Olaplex", logo: "/brands/olaplex.png" },
//   ]);

//   useEffect(() => {
//     const fetchSubs = async () => {
//       try {
//         const res = await axios.get(
//           `${process.env.NEXT_PUBLIC_API_URL}/categories/${category.id}/subcategories`
//         );
//         setSubcategories(res.data || []);
//       } catch {
//         setSubcategories([]);
//       }
//     };
//     fetchSubs();
//   }, [category]);

//   return (
//     <div
//       onMouseLeave={onClose}
//       className="absolute left-0 w-full bg-white border-t border-gray-200 shadow-xl px-10 py-6 flex"
//     >
//       {/* 🔹 Subcategory columns */}
//       <div className="flex-1 grid grid-cols-5 gap-6">
//         {subcategories.length > 0 ? (
//           subcategories.map((sub: any) => (
//             <div key={sub.id}>
//               <h4 className="text-[13px] font-semibold text-gray-900 mb-2">
//                 {sub.name}
//               </h4>
//               <ul className="space-y-1 text-sm text-gray-700">
//                 {sub.items?.length ? (
//                   sub.items.map((item: any, i: number) => (
//                     <li
//                       key={i}
//                       className="hover:text-[#FFD100] cursor-pointer transition"
//                     >
//                       {item}
//                     </li>
//                   ))
//                 ) : (
//                   <li className="text-gray-500 text-xs">No items</li>
//                 )}
//               </ul>
//             </div>
//           ))
//         ) : (
//           <p className="text-sm text-gray-500">No subcategories available.</p>
//         )}
//       </div>

//       {/* 🔹 Right-side Promo */}
//       <div className="w-[250px] flex flex-col justify-between">
//         <div>
//           <Image
//             src="/promo/beauty.png"
//             alt="Promo"
//             width={250}
//             height={200}
//             className="rounded-md shadow-sm"
//           />
//           <p className="text-[13px] mt-2 font-semibold text-gray-800 text-center">
//             THE BEAUTY EDIT
//           </p>
//         </div>

//         {/* 🔹 Top Brands */}
//         <div className="mt-5">
//           <h4 className="text-xs font-semibold text-gray-800 mb-2 uppercase">
//             Top Brands
//           </h4>
//           <div className="flex gap-3 overflow-x-auto">
//             {brands.map((b, i) => (
//               <div
//                 key={i}
//                 className="flex flex-col items-center border rounded-md px-2 py-1 bg-white shadow-sm"
//               >
//                 <Image
//                   src={b.logo}
//                   alt={b.name}
//                   width={50}
//                   height={30}
//                   className="object-contain"
//                 />
//                 <p className="text-[11px] text-gray-600 truncate">{b.name}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
