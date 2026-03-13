import "dotenv/config";
import { updateUserProfileAndRoles } from "./lib/data";

async function main() {
  try {
    const res = await updateUserProfileAndRoles("49079a19-4b6a-4568-b7ad-b3db64312cd4", {
      roles: ["admin"],
      address: "Musterstrasse 5",
      iban: "CH93 0000 0000 0000 0000 0"
    });
    console.log("Success", res);
  } catch (err) {
    console.error("Error", err);
  }
}

main();
