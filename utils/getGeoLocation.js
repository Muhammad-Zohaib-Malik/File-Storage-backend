// export const getGeoLocation = async () => {
//   try {
//     const response = await fetch(`https://ipinfo.io/json?token=${process.env.IPINFO_API_KEY}`);
//     if (!response.ok) throw new Error("Geolocation API failed");
//     const data = await response.json();
//     console.log("Geolocation data:", data);
//     return {
//       city: data.city,
//       country: data.country,
//       ip:data.ip
//     };
//   } catch (error) {
//     console.error("Geolocation error:", error);
//     return { city: "Unknown", country: "Unknown" };
//   }
// };