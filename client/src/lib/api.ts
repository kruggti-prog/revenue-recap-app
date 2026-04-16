// Helper for multipart form uploads to AI endpoints
// Must use the same API_BASE as queryClient so requests route correctly when deployed
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export async function uploadForAnalysis(
  endpoint: string,
  formData: FormData
): Promise<any> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    body: formData,
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
