// Helper for AI endpoint calls — sends files as base64 JSON to avoid proxy multipart issues
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadForAnalysis(
  endpoint: string,
  formData: FormData
): Promise<any> {
  // Convert FormData to JSON with base64-encoded files
  const payload: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      payload[key] = await fileToBase64(value);
      payload[`${key}_name`] = value.name;
      payload[`${key}_type`] = value.type || "application/octet-stream";
    } else {
      payload[key] = value as string;
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json.error || json.detail || text;
    } catch {}
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json();
}
