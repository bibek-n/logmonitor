"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button className="logout-btn" onClick={() => signOut({ callbackUrl: "/login" })}>
      Log out
    </button>
  );
}
