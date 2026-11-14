export { cn } from "cn";

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
