import React, { useState } from "react";
import { Outlet } from "react-router-dom";

const GOLD = "#FECC00";
const INK = "#111827";
const BORDER = "#E5E7EB";

const navItems = [
    { label: "Dashboard", path: "/tpo/dashboard", mark: "D" },
    { label: "Students", path: "/tpo/students", mark: "S" },
    { label: "Companies", path: "/tpo/companies", mark: "C" },
    { label: "Placement Drives", path: "/tpo/drives", mark: "R" },
    { label: "Applications", path: "/tpo/applications", mark: "A" },
    { label: "Placements", path: "/tpo/placements", mark: "P" },
    { label: "Notifications", path: "/tpo/notifications", mark: "N" },
    { label: "Settings", path: "/tpo/settings", mark: "⚙" },
];

export default function TpoLayout({
    children,
    activePath = "/tpo/dashboard",
    onLogout,
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    const closeMenu = () => setMenuOpen(false);

    const handleLogout = () => {
        closeMenu();
        if (typeof onLogout === "function") onLogout();
    };

    const isActive = (path) => activePath === path;

    const navLinkStyle = (path) => ({
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: 4,
        color: isActive(path) ? INK : "#D1D5DB",
        background: isActive(path) ? GOLD : "transparent",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: isActive(path) ? 700 : 500,
        borderLeft: isActive(path) ? `3px solid ${GOLD}` : "3px solid transparent",
    });

    const renderNavigation = (mobile = false) => (
        <nav aria-label={mobile ? "Mobile TPO navigation" : "TPO navigation"} style={{ display: "grid", gap: 4, padding: 12 }}>
            {navItems.map((item) => (
                <a
                    key={item.path}
                    href={item.path}
                    onClick={closeMenu}
                    aria-current={isActive(item.path) ? "page" : undefined}
                    style={navLinkStyle(item.path)}
                >
                    <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 3, background: isActive(item.path) ? "rgba(17,24,39,.08)" : "rgba(255,255,255,.08)", fontSize: 10, fontWeight: 800 }}>{item.mark}</span>
                    <span>{item.label}</span>
                </a>
            ))}
        </nav>
    );

    const brand = (
        <div style={{ padding: "21px 20px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>
                DKTE <span style={{ color: GOLD }}>PLACEMENTS</span>
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 5 }}>Training & Placement Console</div>
        </div>
    );

    const officeNote = (
        <div style={{ margin: "12px 12px 8px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, padding: 13 }}>
            <p style={{ color: GOLD, fontSize: 12, fontWeight: 700, margin: 0 }}>Placement Office</p>
            <p style={{ color: "#D1D5DB", fontSize: 11, lineHeight: 1.6, margin: "7px 0 0" }}>Coordinate student records, recruiters, and campus recruitment.</p>
        </div>
    );

    const logoutButton = (
        <button type="button" onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", color: "#D1D5DB", border: 0, borderRadius: 4, padding: "11px 12px", textAlign: "left", fontSize: 13, cursor: "pointer" }}>
            <span aria-hidden="true" style={{ width: 22, textAlign: "center" }}>↪</span> Logout
        </button>
    );

    return (
        <div style={{ minHeight: "100vh", background: "#F8FAFC", color: INK, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <style>{`
        .tpo-desktop-sidebar { display:flex; }
        .tpo-mobile-header { display:none; }
        .tpo-layout-main { min-width:0; flex:1; }
        .tpo-logout:hover { background:rgba(255,255,255,.08)!important; color:#fff!important; }
        @media(max-width:767px) {
          .tpo-desktop-sidebar { display:none!important; }
          .tpo-mobile-header { display:flex!important; }
        }
      `}</style>

            <div style={{ minHeight: "100vh", display: "flex" }}>
                <aside className="tpo-desktop-sidebar" style={{ position: "sticky", top: 0, height: "100vh", width: 252, flex: "0 0 252px", flexDirection: "column", background: INK, color: "#fff", boxSizing: "border-box" }}>
                    {brand}
                    <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>{renderNavigation()}</div>
                    <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
                        {officeNote}
                        <div className="tpo-logout">{logoutButton}</div>
                    </div>
                </aside>

                <div className="tpo-layout-main">
                    <header className="tpo-mobile-header" style={{ position: "sticky", top: 0, zIndex: 30, minHeight: 64, boxSizing: "border-box", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", background: INK, color: "#fff", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>DKTE <span style={{ color: GOLD }}>PLACEMENTS</span></div>
                            <div style={{ color: "#9CA3AF", fontSize: 10, marginTop: 3 }}>Training & Placement Console</div>
                        </div>
                        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} style={{ width: 42, height: 42, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4, fontSize: 23, cursor: "pointer" }}>
                            {menuOpen ? "×" : "☰"}
                        </button>
                    </header>

                    {menuOpen && (
                        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
                            <button type="button" aria-label="Close navigation overlay" onClick={closeMenu} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "rgba(0,0,0,.52)", border: 0 }} />
                            <aside style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(310px, 88vw)", display: "flex", flexDirection: "column", background: INK, color: "#fff", overflowY: "auto", boxShadow: "-12px 0 30px rgba(0,0,0,.15)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    {brand}
                                    <button type="button" onClick={closeMenu} aria-label="Close menu" style={{ marginRight: 12, background: "transparent", color: "#fff", border: 0, fontSize: 25, cursor: "pointer" }}>×</button>
                                </div>
                                {renderNavigation(true)}
                                {officeNote}
                                <div style={{ marginTop: "auto", padding: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
                                    <div className="tpo-logout">{logoutButton}</div>
                                </div>
                            </aside>
                        </div>
                    )}

                    <main>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}
