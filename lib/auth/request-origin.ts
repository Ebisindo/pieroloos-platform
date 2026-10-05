export function hasInvalidRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try {
      return new URL(origin).origin !== new URL(request.url).origin;
    } catch {
      return true;
    }
  }

  const referer = request.headers.get("referer");
  if (referer === null) return true;
  try {
    return new URL(referer).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}
