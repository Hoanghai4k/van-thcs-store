import { hasOrdersForEmail } from "./src/features/orders/queries";

async function main() {
  console.log("Testing hasOrdersForEmail...");
  try {
    const result = await hasOrdersForEmail("test@example.com"); // any email
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
