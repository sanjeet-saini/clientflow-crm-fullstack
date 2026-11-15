// =====================================================================
// validate.js — server-side validation. Frontend bhi check karta hai, par server
// kabhi client par bharosa nahi karta (koi bhi seedha API call kar sakta hai).
// Return: { record } sahi ho to, warna { error: "message" }
// =====================================================================
import { STAGES } from "../src/data.js";

const text = (v) => (typeof v === "string" ? v.trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d\s()-]{7,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validate(kind, input, customerExists) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { error: "Request body must be a JSON object." };

  if (kind === "customers") {
    const record = {
      name: text(input.name),
      email: text(input.email),
      phone: text(input.phone),
      company: text(input.company),
      status: input.status ?? "Active",
    };
    if (!record.name || record.name.length > 120)
      return { error: "Name is required (max 120 characters)." };
    if (!EMAIL.test(record.email))
      return { error: "Enter a valid email address." };
    if (record.phone && !PHONE.test(record.phone))
      return { error: "Enter a valid phone number." };
    if (record.company.length > 120)
      return { error: "Company is too long (max 120 characters)." };
    if (!["Active", "Inactive"].includes(record.status))
      return { error: "Status must be Active or Inactive." };
    return { record };
  }

  if (kind === "leads") {
    const record = {
      title: text(input.title),
      customerId: text(input.customerId),
      stage: input.stage ?? "New",
      value: Number(input.value),
    };
    if (!record.title || record.title.length > 120)
      return { error: "Title is required (max 120 characters)." };
    if (!customerExists(record.customerId))
      return { error: "Lead must belong to an existing customer." };
    if (!STAGES.includes(record.stage))
      return { error: `Stage must be one of: ${STAGES.join(", ")}.` };
    if (
      input.value === "" ||
      input.value == null ||
      !Number.isFinite(record.value) ||
      record.value < 0
    )
      return { error: "Deal value must be a non-negative number." };
    return { record };
  }

  if (kind === "tasks") {
    const record = {
      title: text(input.title),
      customerId: text(input.customerId),
      priority: input.priority ?? "Medium",
      dueDate: text(input.dueDate),
      completed: input.completed ?? false,
    };
    if (!record.title || record.title.length > 120)
      return { error: "Title is required (max 120 characters)." };
    if (record.customerId && !customerExists(record.customerId))
      return { error: "Linked customer does not exist." };
    if (!["Low", "Medium", "High"].includes(record.priority))
      return { error: "Priority must be Low, Medium or High." };
    if (!DATE.test(record.dueDate) || Number.isNaN(Date.parse(record.dueDate)))
      return { error: "Due date must be a valid YYYY-MM-DD date." };
    if (typeof record.completed !== "boolean")
      return { error: "Completed must be true or false." };
    return { record };
  }

  return { error: "Unknown resource." };
}
