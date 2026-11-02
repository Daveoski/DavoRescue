// The agency directory is owned by the backend (it seeds the database and
// drives dispatch). The frontend keeps a committed copy for statically
// rendered directory pages. Run `npm run sync:directory` after editing it.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../backend/app/domains/agencies/directory.json");
const target = resolve(here, "../src/domains/agencies/directory.json");

if (existsSync(source)) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log("agency directory synced from backend");
} else {
  console.log("backend directory not found; using committed copy");
}
