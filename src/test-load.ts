process.env.ADOTUI_CONFIG = "/tmp/nonexistent-config.json";
import { loadInitialData } from "./app/dataController";

console.log("Calling loadInitialData...");
try {
  const result = await loadInitialData(true, (msg) => console.log("Progress:", msg));
  console.log("Load result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Error during loadInitialData:", err);
}
process.exit(0);
