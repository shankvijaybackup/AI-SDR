import g711 from "g711";
console.log("g711 export:", g711);
try {
  const { ulawToPCM, ulawFromPCM } = g711;
  console.log("ulawToPCM:", typeof ulawToPCM);
  console.log("ulawFromPCM:", typeof ulawFromPCM);
} catch (e) {
  console.error(e);
}
