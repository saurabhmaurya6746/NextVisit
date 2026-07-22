import { useEffect, useState } from "react";

export type TemplateKey = "birthday" | "anniversary" | "recovery" | "review" | "festival" | "welcome";

export const templateMeta: Record<TemplateKey, { title: string; description: string }> = {
  birthday: { title: "Birthday", description: "Sent automatically on a customer's birthday." },
  anniversary: { title: "Anniversary", description: "Sent on relationship anniversaries." },
  recovery: { title: "Recovery", description: "Win back customers who haven't visited recently." },
  review: { title: "Review Request", description: "Ask a happy customer to leave a Google review." },
  festival: { title: "Festival", description: "Reusable template for festivals and holidays." },
  welcome: { title: "Welcome Customer", description: "Greet new customers after their first visit." },
};

export const defaultTemplates: Record<TemplateKey, string> = {
  birthday:
    "Happy Birthday {{name}} 🎉\nWishing you a wonderful year ahead. Enjoy a FREE Dessert on your next visit.\nCoupon Code: BDAY20\nSee you soon ❤️\n— Aroma Bistro",
  anniversary:
    "Cheers to another year, {{name}} ❤️\nCelebrate with us — coupon ANNI25 unlocks 25% off your favourite.\nCan't wait to have you back.\n— Aroma Bistro",
  recovery:
    "Hi {{name}}, we miss you! 💜\nIt's been a while — here's a warm 15% off (code COMEBACK15) on your next visit.\nWe'd love to have you back.\n— Aroma Bistro",
  review:
    "Hi {{name}},\nThank you for visiting our restaurant. We hope you enjoyed your experience.\nIf you have one minute, please leave us a Google Review.\n⭐⭐⭐⭐⭐\n{{link}}\nThank you ❤️",
  festival:
    "Warm wishes for the festival, {{name}} ✨\nCelebrate with us — a special treat is waiting for you this week.\n— Aroma Bistro",
  welcome:
    "Welcome to Aroma Bistro, {{name}} 👋\nWe're delighted you stopped by. Here's a little something for next time — coupon WELCOME10.\nSee you soon!",
};

const KEY = "growthos:templates";

function read(): Record<TemplateKey, string> {
  if (typeof window === "undefined") return defaultTemplates;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultTemplates;
    return { ...defaultTemplates, ...JSON.parse(raw) };
  } catch {
    return defaultTemplates;
  }
}

function write(m: Record<TemplateKey, string>) {
  localStorage.setItem(KEY, JSON.stringify(m));
  window.dispatchEvent(new Event("growthos:templates-changed"));
}

export function useTemplates() {
  const [m, setM] = useState<Record<TemplateKey, string>>(() => read());
  useEffect(() => {
    const on = () => setM(read());
    window.addEventListener("growthos:templates-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:templates-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return {
    templates: m,
    save: (k: TemplateKey, v: string) => {
      const next = { ...read(), [k]: v };
      write(next);
    },
    reset: (k: TemplateKey) => {
      const next = { ...read(), [k]: defaultTemplates[k] };
      write(next);
    },
  };
}