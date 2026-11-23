const postJson = async (path, body) => {
  let response;
  try {
    response = await fetch(`${window.API_BASE || ""}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404) throw new Error("The running API does not include password recovery yet. Restart or redeploy the updated server; if the frontend and API are separate, check API_BASE.");
    throw new Error(data && data.error || `The server returned an error (${response.status}). Try again or contact the site administrator.`);
  }
  if (!data || !data.message) throw new Error("The server returned an unexpected response. Check API_BASE and try again.");
  return data;
};

const setStatus = (element, message, kind) => {
  element.textContent = message;
  element.classList.toggle("error", kind === "error");
  element.classList.toggle("success", kind === "success");
  element.setAttribute("role", kind === "error" ? "alert" : "status");
};

const forgotForm = document.querySelector("#forgot-form");
if (forgotForm) {
  const status = document.querySelector("#forgot-status");
  const button = forgotForm.querySelector('button[type="submit"]');
  forgotForm.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.querySelector("#reset-email").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus(status, "Enter a valid email address.", "error");
      return;
    }
    button.disabled = true;
    button.textContent = "Sending...";
    try {
      const result = await postJson("/api/password-reset", { email });
      setStatus(status, result.message, "success");
    } catch (error) {
      setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Send reset link";
    }
  });
}

const resetForm = document.querySelector("#reset-form");
if (resetForm) {
  const status = document.querySelector("#reset-status");
  const retryLink = document.querySelector("#request-another");
  const success = document.querySelector("#reset-success");
  const button = resetForm.querySelector('button[type="submit"]');
  let token = location.hash.slice(1);
  if (token) history.replaceState(null, "", location.pathname);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    resetForm.hidden = true;
    retryLink.hidden = false;
    setStatus(status, "This reset link is missing or invalid. Request a new one.", "error");
  }

  resetForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.querySelector("#new-password").value;
    const confirm = document.querySelector("#confirm-password").value;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password) && /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password)
    ];
    if (password.length > 128) {
      setStatus(status, "Use 128 characters or fewer.", "error");
      return;
    }
    if (checks.filter(Boolean).length < 3) {
      setStatus(status, "Use at least 8 characters and add more character types.", "error");
      return;
    }
    if (password !== confirm) {
      setStatus(status, "The passwords do not match. Check both fields.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Updating...";
    try {
      await postJson("/api/password-reset/confirm", { token, password });
      resetForm.hidden = true;
      retryLink.hidden = true;
      status.hidden = true;
      success.hidden = false;
      token = "";
    } catch (error) {
      setStatus(status, error.message, "error");
      if (error.message.includes("reset link")) retryLink.hidden = false;
    } finally {
      if (!success.hidden) return;
      button.disabled = false;
      button.textContent = "Update password";
    }
  });
}
