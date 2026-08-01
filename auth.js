/* ================================================================
   AUTH.JS — simple client-side auth (localStorage only)

   ⚠️ IMPORTANT: This app has no backend/server. "Accounts" are just
   entries saved in the browser's localStorage on this device. This
   is fine for a demo/prototype, but it is NOT secure real auth:
   anyone with access to this browser's dev tools can read the data,
   and accounts don't sync across devices/browsers. For a production
   app, replace this with a real backend + hashed passwords server-side.
   ================================================================ */

const LS_USERS_KEY = "s2v_users";
const LS_SESSION_KEY = "s2v_session";

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
}

function normalizeNumber(number) {
  return number.replace(/[\s-]/g, "");
}

/**
 * signupUser(number, username, password)
 * Returns { ok: true } or { ok: false, error: "..." }
 */
function signupUser(number, username, password) {
  number = normalizeNumber(number);
  username = username.trim();

  if (!/^\+?\d{7,15}$/.test(number)) {
    return { ok: false, error: "Enter a valid phone number (7–15 digits)." };
  }
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const users = getUsers();
  if (users.some((u) => u.number === number)) {
    return { ok: false, error: "An account with this number already exists. Please log in." };
  }

  users.push({
    number,
    username,
    password: password,
  });
  saveUsers(users);
  return { ok: true };
}

/**
 * isValidPhoneNumber(number)
 * Same rule used at signup: optional "+", 7–15 digits.
 */
function isValidPhoneNumber(number) {
  return /^\+?\d{7,15}$/.test(normalizeNumber(number));
}

function deleteUser(number) {
  number = normalizeNumber(number);
  const users = getUsers().filter((u) => u.number !== number);
  saveUsers(users);
}

/**
 * loginUser(number, password)
 * Returns { ok: true, user: {...} } or { ok: false, error: "..." }
 */
function loginUser(number, password) {
  number = normalizeNumber(number);
  const users = getUsers();
  const match = users.find(
    (u) => u.number === number && u.password === password
  );

  if (!match) {
    return { ok: false, error: "Number or password is incorrect." };
  }

  localStorage.setItem(
    LS_SESSION_KEY,
    JSON.stringify({ number: match.number, username: match.username })
  );
  return { ok: true, user: match };
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function logoutUser() {
  localStorage.removeItem(LS_SESSION_KEY);
  window.location.href = "login.html";
}

/**
 * requireAuth()
 * Call at the top of any protected page. Redirects to login.html
 * if nobody is signed in.
 */
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
  }
  return user;
}
