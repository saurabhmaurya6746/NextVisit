// Realistic sample data for NextVisit

export const businessTypes = ["Restaurant", "Salon", "Spa", "Café", "Beauty Clinic", "Bakery"] as const;

export const clients = [
  { id: "c1", business: "Aroma Bistro", owner: "Priya Sharma", type: "Restaurant", email: "priya@aromabistro.com", phone: "+91 98765 43210", plan: "Professional", status: "active", expiry: "2026-08-14", revenue: 249, customers: 1284, city: "Mumbai" },
  { id: "c2", business: "Bloom & Blush Salon", owner: "Aisha Khan", type: "Salon", email: "aisha@bloomblush.co", phone: "+91 90123 45678", plan: "Enterprise", status: "active", expiry: "2026-11-02", revenue: 499, customers: 2140, city: "Bengaluru" },
  { id: "c3", business: "Serenity Spa Retreat", owner: "Nikhil Rao", type: "Spa", email: "nikhil@serenityspa.in", plan: "Starter", status: "trial", expiry: "2026-07-28", revenue: 0, customers: 87, phone: "+91 99887 66554", city: "Goa" },
  { id: "c4", business: "The Daily Grind Café", owner: "Marco De Luca", type: "Café", email: "marco@dailygrind.cafe", phone: "+39 320 456 7890", plan: "Professional", status: "active", expiry: "2027-01-19", revenue: 249, customers: 942, city: "Milan" },
  { id: "c5", business: "Glow Beauty Clinic", owner: "Sophia Chen", type: "Beauty Clinic", email: "sophia@glowclinic.sg", phone: "+65 8123 4567", plan: "Enterprise", status: "active", expiry: "2026-12-05", revenue: 499, customers: 1876, city: "Singapore" },
  { id: "c6", business: "Sunrise Bakery", owner: "Leah Goldberg", type: "Bakery", email: "leah@sunrisebakery.com", phone: "+1 415 555 0134", plan: "Free", status: "expired", expiry: "2026-05-12", revenue: 0, customers: 312, city: "San Francisco" },
  { id: "c7", business: "Curl & Co.", owner: "Fatima Al Zahra", type: "Salon", email: "fatima@curlandco.ae", phone: "+971 50 123 4567", plan: "Professional", status: "active", expiry: "2026-09-30", revenue: 249, customers: 1520, city: "Dubai" },
  { id: "c8", business: "Zen Wellness Spa", owner: "Kenji Watanabe", type: "Spa", email: "kenji@zenwellness.jp", phone: "+81 90 1234 5678", plan: "Starter", status: "active", expiry: "2026-08-22", revenue: 99, customers: 465, city: "Kyoto" },
  { id: "c9", business: "Little Italy Trattoria", owner: "Giulia Rossi", type: "Restaurant", email: "giulia@littleitaly.com", phone: "+1 212 555 0198", plan: "Professional", status: "active", expiry: "2026-10-11", revenue: 249, customers: 1108, city: "New York" },
  { id: "c10", business: "Petal & Pour", owner: "Emma Thompson", type: "Café", email: "emma@petalpour.uk", phone: "+44 20 7946 0123", plan: "Starter", status: "trial", expiry: "2026-07-24", revenue: 0, customers: 54, city: "London" },
  { id: "c11", business: "Halo Hair Studio", owner: "Amara Okafor", type: "Salon", email: "amara@halohair.co", phone: "+234 803 456 7890", plan: "Free", status: "active", expiry: "2027-01-01", revenue: 0, customers: 210, city: "Lagos" },
  { id: "c12", business: "Sage & Stone Spa", owner: "Olivia Martin", type: "Spa", email: "olivia@sagestone.com", phone: "+1 512 555 0176", plan: "Enterprise", status: "active", expiry: "2026-12-30", revenue: 499, customers: 2412, city: "Austin" },
];

export const revenueSeries = [
  { month: "Jan", revenue: 18200, clients: 42 },
  { month: "Feb", revenue: 22400, clients: 51 },
  { month: "Mar", revenue: 27100, clients: 63 },
  { month: "Apr", revenue: 31800, clients: 74 },
  { month: "May", revenue: 36200, clients: 88 },
  { month: "Jun", revenue: 41500, clients: 101 },
  { month: "Jul", revenue: 48900, clients: 118 },
];

export const customerGrowthSeries = [
  { month: "Jan", customers: 4200 },
  { month: "Feb", customers: 5100 },
  { month: "Mar", customers: 6400 },
  { month: "Apr", customers: 7900 },
  { month: "May", customers: 9600 },
  { month: "Jun", customers: 11500 },
  { month: "Jul", customers: 13820 },
];

export const campaignAnalytics = [
  { name: "WhatsApp", sent: 12400, opened: 10820, converted: 3140 },
  { name: "Email", sent: 8600, opened: 4130, converted: 812 },
  { name: "SMS", sent: 5200, opened: 4680, converted: 940 },
];

export const couponUsage = [
  { name: "Redeemed", value: 68 },
  { name: "Active", value: 24 },
  { name: "Expired", value: 8 },
];

// Business owner scoped data
export const customers = [
  { id: "u1", name: "Sarah Johnson", phone: "+1 415 555 0142", email: "sarah.j@gmail.com", birthday: "2026-07-16", anniversary: "2020-11-04", points: 840, visits: 24, lastVisit: "2026-07-08", spent: 1284, favorites: ["Tiramisu", "Cappuccino"], status: "VIP", initials: "SJ" },
  { id: "u2", name: "Rahul Verma", phone: "+91 98200 12345", email: "rahul.v@outlook.com", birthday: "2026-07-16", anniversary: "2018-02-14", points: 320, visits: 11, lastVisit: "2026-06-22", spent: 468, favorites: ["Butter Chicken"], status: "Regular", initials: "RV" },
  { id: "u3", name: "Emily Zhang", phone: "+65 8234 5678", email: "emily.z@mail.com", birthday: "2026-07-17", anniversary: "2022-07-17", points: 1240, visits: 38, lastVisit: "2026-07-14", spent: 2140, favorites: ["Signature Facial"], status: "VIP", initials: "EZ" },
  { id: "u4", name: "Mohammed Al Farsi", phone: "+971 50 987 6543", email: "m.alfarsi@mail.ae", birthday: "2026-07-18", anniversary: "2019-07-18", points: 512, visits: 17, lastVisit: "2026-05-30", spent: 892, favorites: ["Deep Tissue Massage"], status: "Regular", initials: "MA" },
  { id: "u5", name: "Isabella Rossi", phone: "+39 340 987 6543", email: "isa.rossi@mail.it", birthday: "2026-07-21", anniversary: "2021-07-21", points: 96, visits: 4, lastVisit: "2026-04-11", spent: 148, favorites: ["Espresso"], status: "New", initials: "IR" },
  { id: "u6", name: "David Kim", phone: "+82 10 8765 4321", email: "davidk@mail.kr", birthday: "1988-03-22", anniversary: "2015-08-09", points: 60, visits: 2, lastVisit: "2026-01-14", spent: 84, favorites: [], status: "At Risk", initials: "DK" },
  { id: "u7", name: "Grace Nkomo", phone: "+27 82 456 7890", email: "grace.n@mail.co.za", birthday: "1990-11-02", anniversary: "2017-03-15", points: 210, visits: 8, lastVisit: "2026-05-02", spent: 340, favorites: ["Manicure"], status: "Regular", initials: "GN" },
  { id: "u8", name: "Luca Marino", phone: "+39 320 555 0198", email: "luca.m@mail.it", birthday: "1985-12-08", anniversary: "2019-07-21", points: 1580, visits: 46, lastVisit: "2026-07-11", spent: 2890, favorites: ["Tasting Menu"], status: "VIP", initials: "LM" },
  { id: "u9", name: "Priya Iyer", phone: "+91 99000 12345", email: "priya.i@mail.in", birthday: "1993-06-19", anniversary: "2020-01-25", points: 420, visits: 14, lastVisit: "2026-06-18", spent: 612, favorites: ["Hair Spa"], status: "Regular", initials: "PI" },
  { id: "u10", name: "James O'Brien", phone: "+353 87 123 4567", email: "james.ob@mail.ie", birthday: "1978-04-11", anniversary: "2010-09-04", points: 24, visits: 1, lastVisit: "2025-12-02", spent: 42, favorites: [], status: "At Risk", initials: "JO" },
  { id: "u11", name: "Ananya Patel", phone: "+91 98765 43210", email: "ananya.p@mail.in", birthday: "1996-08-30", anniversary: "2022-11-14", points: 380, visits: 13, lastVisit: "2026-07-01", spent: 540, favorites: ["Bridal Package"], status: "Regular", initials: "AP" },
  { id: "u12", name: "Noah Anderson", phone: "+1 646 555 0119", email: "noah.a@mail.us", birthday: "1991-01-17", anniversary: "2018-07-19", points: 720, visits: 22, lastVisit: "2026-07-10", spent: 1180, favorites: ["Steak Frites"], status: "VIP", initials: "NA" },
];

export const businessSales = [
  { day: "Mon", sales: 1420 },
  { day: "Tue", sales: 1180 },
  { day: "Wed", sales: 1680 },
  { day: "Thu", sales: 1520 },
  { day: "Fri", sales: 2340 },
  { day: "Sat", sales: 3120 },
  { day: "Sun", sales: 2780 },
];

export const bookingsSeries = [
  { day: "Mon", bookings: 24 },
  { day: "Tue", bookings: 18 },
  { day: "Wed", bookings: 28 },
  { day: "Thu", bookings: 32 },
  { day: "Fri", bookings: 48 },
  { day: "Sat", bookings: 62 },
  { day: "Sun", bookings: 54 },
];

export const repeatCustomerSeries = [
  { month: "Feb", rate: 32 },
  { month: "Mar", rate: 38 },
  { month: "Apr", rate: 41 },
  { month: "May", rate: 47 },
  { month: "Jun", rate: 52 },
  { month: "Jul", rate: 58 },
];

export const bookings = [
  { id: "b1", customer: "Sarah Johnson", service: "Signature Facial", staff: "Ana", time: "10:00 AM", date: "2026-07-16", status: "confirmed" },
  { id: "b2", customer: "Rahul Verma", service: "Table for 4", staff: "Marco", time: "8:30 PM", date: "2026-07-16", status: "confirmed" },
  { id: "b3", customer: "Emily Zhang", service: "Hair Color", staff: "Kira", time: "2:00 PM", date: "2026-07-17", status: "pending" },
  { id: "b4", customer: "Mohammed Al Farsi", service: "Deep Tissue Massage", staff: "Ravi", time: "5:00 PM", date: "2026-07-17", status: "confirmed" },
  { id: "b5", customer: "Luca Marino", service: "Tasting Menu (2)", staff: "Giulia", time: "7:00 PM", date: "2026-07-18", status: "confirmed" },
  { id: "b6", customer: "Ananya Patel", service: "Bridal Trial", staff: "Kira", time: "11:00 AM", date: "2026-07-19", status: "pending" },
];

export const orders = [
  { id: "#GS-10241", customer: "Sarah Johnson", items: 3, total: 84, status: "completed", time: "2026-07-15 19:24" },
  { id: "#GS-10242", customer: "Luca Marino", items: 5, total: 218, status: "completed", time: "2026-07-15 20:11" },
  { id: "#GS-10243", customer: "Emily Zhang", items: 2, total: 340, status: "processing", time: "2026-07-16 09:02" },
  { id: "#GS-10244", customer: "Rahul Verma", items: 4, total: 62, status: "completed", time: "2026-07-16 12:45" },
  { id: "#GS-10245", customer: "Noah Anderson", items: 6, total: 172, status: "refunded", time: "2026-07-14 21:08" },
  { id: "#GS-10246", customer: "Priya Iyer", items: 1, total: 48, status: "completed", time: "2026-07-16 14:12" },
];

export const coupons = [
  { code: "BDAY20", type: "Birthday", discount: "20% off", used: 142, limit: 500, expiry: "2026-12-31", status: "active" },
  { code: "ANNI25", type: "Anniversary", discount: "25% off", used: 68, limit: 300, expiry: "2026-12-31", status: "active" },
  { code: "COMEBACK15", type: "Recovery", discount: "15% off", used: 84, limit: 400, expiry: "2026-09-30", status: "active" },
  { code: "FREEDESSERT", type: "Gift", discount: "Free dessert", used: 210, limit: 250, expiry: "2026-08-15", status: "active" },
  { code: "BOGO2026", type: "BOGO", discount: "Buy 1 Get 1", used: 96, limit: 200, expiry: "2026-07-31", status: "active" },
  { code: "SUMMER10", type: "Seasonal", discount: "10% off", used: 320, limit: 320, expiry: "2026-06-30", status: "expired" },
];

export const campaigns = [
  { id: "cp1", name: "July Birthday Wishes", channel: "WhatsApp", audience: "Birthdays this week", sent: 42, delivered: 41, opened: 38, converted: 12, status: "sent", date: "2026-07-15" },
  { id: "cp2", name: "VIP Anniversary Perks", channel: "WhatsApp", audience: "VIP tier", sent: 128, delivered: 126, opened: 118, converted: 47, status: "sent", date: "2026-07-12" },
  { id: "cp3", name: "Come Back — 60 Day", channel: "WhatsApp", audience: "Inactive 60d", sent: 96, delivered: 94, opened: 72, converted: 21, status: "sent", date: "2026-07-10" },
  { id: "cp4", name: "Diwali Special", channel: "Email", audience: "All customers", sent: 0, delivered: 0, opened: 0, converted: 0, status: "scheduled", date: "2026-11-01" },
  { id: "cp5", name: "Weekend Brunch", channel: "SMS", audience: "Local segment", sent: 0, delivered: 0, opened: 0, converted: 0, status: "draft", date: "" },
];

export const reviews = [
  { customer: "Sarah Johnson", rating: 5, comment: "Absolutely wonderful experience — the staff went above and beyond!", channel: "Google", date: "2026-07-14" },
  { customer: "Luca Marino", rating: 5, comment: "Best tasting menu in the city. Coming back next week.", channel: "Google", date: "2026-07-11" },
  { customer: "Emily Zhang", rating: 4, comment: "Lovely space and great service, but the wait was a bit long.", channel: "Google", date: "2026-07-09" },
  { customer: "James O'Brien", rating: 3, comment: "Food was okay. Service could be faster.", channel: "Internal", date: "2026-07-05" },
];

export const teamMembers = [
  { name: "Ana Silva", role: "Manager", email: "ana@growthos.demo", status: "active", initials: "AS" },
  { name: "Marco Rossi", role: "Front of House", email: "marco@growthos.demo", status: "active", initials: "MR" },
  { name: "Kira Chen", role: "Senior Stylist", email: "kira@growthos.demo", status: "active", initials: "KC" },
  { name: "Ravi Sharma", role: "Therapist", email: "ravi@growthos.demo", status: "on leave", initials: "RS" },
  { name: "Giulia Bianchi", role: "Head Chef", email: "giulia@growthos.demo", status: "active", initials: "GB" },
];

export const festivals = [
  { name: "Diwali", date: "2026-11-01", template: "Light up celebrations with 20% off desserts" },
  { name: "Christmas", date: "2026-12-25", template: "Warm wishes and a festive gift on us" },
  { name: "New Year", date: "2027-01-01", template: "Ring in 2027 with a signature experience" },
  { name: "Valentine's Day", date: "2027-02-14", template: "Table for two, on the house dessert" },
];

export const aiSuggestions = [
  { title: "Reactivate 42 sleeping VIPs", detail: "Send a 20% off tasting menu offer this Friday — projected ROI 4.2×." },
  { title: "Best time to send: Thu 6:12 PM", detail: "Open rates peak on Thursday evenings for your audience." },
  { title: "Bundle Bridal + Facial", detail: "Customers who booked bridal are 3.1× likely to add a signature facial." },
  { title: "Forecast: +18% revenue in Aug", detail: "Momentum from birthday and loyalty campaigns compounding." },
];

export const plans = [
  { name: "Free", price: 0, cta: "Current", features: ["Up to 100 customers", "Basic dashboard", "Email support"] },
  { name: "Starter", price: 29, cta: "Upgrade", features: ["Up to 1,000 customers", "WhatsApp campaigns", "Birthday automation", "Coupons"] },
  { name: "Professional", price: 79, cta: "Upgrade", popular: true, features: ["Unlimited customers", "All automations", "Loyalty & tiers", "Google Reviews", "Priority support"] },
  { name: "Enterprise", price: 199, cta: "Talk to sales", features: ["Everything in Pro", "Multi-branch", "Custom integrations", "Dedicated CSM", "SLA"] },
];

export const invoices = [
  { id: "INV-2026-0142", client: "Bloom & Blush Salon", amount: 499, date: "2026-07-02", status: "paid" },
  { id: "INV-2026-0141", client: "Aroma Bistro", amount: 249, date: "2026-07-01", status: "paid" },
  { id: "INV-2026-0140", client: "Glow Beauty Clinic", amount: 499, date: "2026-06-29", status: "paid" },
  { id: "INV-2026-0139", client: "Sage & Stone Spa", amount: 499, date: "2026-06-28", status: "paid" },
  { id: "INV-2026-0138", client: "Curl & Co.", amount: 249, date: "2026-06-25", status: "paid" },
  { id: "INV-2026-0137", client: "Little Italy Trattoria", amount: 249, date: "2026-06-22", status: "overdue" },
];

// Today's visits (auto-eligible for Review Booster).
// Anchored to DEMO_TODAY (2026-07-17).
export const todaysVisits = [
  { id: "v1", customerId: "u1", date: "2026-07-17", bill: 84 },
  { id: "v2", customerId: "u3", date: "2026-07-17", bill: 340 },
  { id: "v3", customerId: "u8", date: "2026-07-17", bill: 218 },
  { id: "v4", customerId: "u12", date: "2026-07-17", bill: 172 },
  { id: "v5", customerId: "u11", date: "2026-07-16", bill: 96 },
  { id: "v6", customerId: "u2", date: "2026-07-16", bill: 62 },
  { id: "v7", customerId: "u9", date: "2026-07-15", bill: 48 },
  { id: "v8", customerId: "u4", date: "2026-07-14", bill: 128 },
];