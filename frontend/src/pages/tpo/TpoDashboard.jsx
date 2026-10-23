import React from "react";


const GOLD = "#FECC00";
const INK = "#111827";
const MUTED = "#4B5563";
const BORDER = "#E5E7EB";

const stats = [
  { label: "Total Students", value: "—", note: "Student records" },
  { label: "Companies", value: "—", note: "Recruiting partners" },
  { label: "Placement Drives", value: "—", note: "Upcoming and active" },
  { label: "Students Placed", value: "—", note: "Confirmed outcomes" },
];

const quickActions = [
  { title: "Manage students", description: "Review student records", href: "/tpo/students", symbol: "S" },
  { title: "Manage companies", description: "Maintain recruiter details", href: "/tpo/companies", symbol: "C" },
  { title: "Placement drives", description: "Review recruitment schedules", href: "/tpo/drives", symbol: "D" },
  { title: "View placements", description: "Review placement outcomes", href: "/tpo/placements", symbol: "P" },
];

const styles = {
  page: { minHeight: "100vh", background: "#F8FAFC", color: INK, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  content: { width: "100%", maxWidth: 1440, margin: "0 auto", padding: "28px clamp(16px, 3vw, 36px)", boxSizing: "border-box" },
  eyebrow: { color: MUTED, fontSize: 13, margin: "0 0 6px" },
  title: { fontSize: "clamp(24px, 3vw, 32px)", lineHeight: 1.2, letterSpacing: "-0.03em", fontWeight: 750, margin: 0 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 1.6, margin: "9px 0 0" },
  button: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: GOLD, color: INK, border: `1px solid ${GOLD}`, borderRadius: 4, padding: "10px 14px", fontSize: 14, fontWeight: 700, textDecoration: "none", cursor: "pointer" },
  secondaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: INK, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "10px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" },
  card: { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 4, padding: 18, minWidth: 0 },
  sectionTitle: { fontSize: 16, lineHeight: "24px", fontWeight: 650, margin: 0 },
  muted: { color: MUTED, fontSize: 13, lineHeight: 1.5 },
};

function DashboardLink({ href, children, primary = false }) {
  return (
    <a href={href} style={primary ? styles.button : styles.secondaryButton}>
      {children}
    </a>
  );
}

export default function TpoDashboard() {
  return (
    <div style={styles.page}>
      <style>{`
        .tpo-stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .tpo-main-grid { display:grid; grid-template-columns:minmax(0, 1.8fr) minmax(280px, 1fr); gap:16px; }
        .tpo-actions-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .tpo-action-link { display:flex; align-items:flex-start; gap:12px; color:${INK}; text-decoration:none; border:1px solid ${BORDER}; border-radius:4px; padding:13px; min-width:0; }
        .tpo-action-link:hover { background:#F8FAFC; border-color:#9CA3AF; }
        .tpo-symbol { display:flex; align-items:center; justify-content:center; flex:0 0 32px; height:32px; background:${GOLD}; color:${INK}; border-radius:4px; font-size:12px; font-weight:800; }
        @media (max-width: 1000px) { .tpo-stats-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .tpo-main-grid { grid-template-columns:1fr; } }
        @media (max-width: 520px) { .tpo-stats-grid { grid-template-columns:1fr 1fr; gap:8px; } .tpo-actions-grid { grid-template-columns:1fr; } }
      `}</style>

      <main style={styles.content}>
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 24 }}>
          <div>
            <p style={styles.eyebrow}>DKTE Placement Console · Training & Placement Office</p>
            <h1 style={styles.title}>Overview</h1>
            <p style={styles.subtitle}>Manage recruitment activity, student records, and placement outcomes.</p>
          </div>
          <DashboardLink href="/tpo/drives/new" primary>＋ Post New Drive</DashboardLink>
        </header>

        <section aria-label="Placement overview" style={{ background: INK, color: "#fff", borderRadius: 4, padding: "22px clamp(18px, 3vw, 30px)", marginBottom: 18, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div style={{ maxWidth: 680 }}>
            <span style={{ display: "inline-block", background: GOLD, color: INK, padding: "4px 7px", borderRadius: 3, fontSize: 10, letterSpacing: "0.08em", fontWeight: 800 }}>PLACEMENT OPERATIONS</span>
            <h2 style={{ fontSize: "clamp(20px, 2.5vw, 26px)", letterSpacing: "-0.02em", lineHeight: 1.3, margin: "14px 0 7px" }}>A clear view of campus recruitment.</h2>
            <p style={{ color: "#D1D5DB", fontSize: 13, lineHeight: 1.7, margin: 0 }}>Use the placement console to coordinate students, recruiters, drives, and confirmed outcomes.</p>
          </div>
          <DashboardLink href="/tpo/drives" primary>View Drives →</DashboardLink>
        </section>

        <section aria-label="Key metrics" className="tpo-stats-grid" style={{ marginBottom: 18 }}>
          {stats.map((stat) => (
            <article key={stat.label} style={styles.card}>
              <p style={{ color: MUTED, fontSize: 12, fontWeight: 600, margin: "0 0 13px" }}>{stat.label}</p>
              <p style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 750, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", margin: 0 }}>{stat.value}</p>
              <p style={{ color: "#6B7280", fontSize: 11, margin: "9px 0 0" }}>{stat.note}</p>
            </article>
          ))}
        </section>

        <div className="tpo-main-grid">
          <section style={styles.card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div>
                <h2 style={styles.sectionTitle}>Recruitment drives</h2>
                <p style={{ ...styles.muted, margin: "5px 0 0" }}>Upcoming and ongoing campus recruitment activities.</p>
              </div>
              <DashboardLink href="/tpo/drives">All drives →</DashboardLink>
            </div>
            <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 4, padding: "34px 16px", textAlign: "center" }}>
              <div aria-hidden="true" style={{ margin: "0 auto 12px", width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 4, background: "#F1F5F9", fontWeight: 800 }}>D</div>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 650 }}>No drive data connected yet</p>
              <p style={{ ...styles.muted, maxWidth: 360, margin: "0 auto 16px" }}>Connect this section to the recruitment-drive API when that endpoint is available in the backend.</p>
              <DashboardLink href="/tpo/drives" primary>Open drives</DashboardLink>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Quick actions</h2>
            <p style={{ ...styles.muted, margin: "5px 0 16px" }}>Jump to common placement tasks.</p>
            <div className="tpo-actions-grid">
              {quickActions.map((action) => (
                <a key={action.href} href={action.href} className="tpo-action-link">
                  <span className="tpo-symbol" aria-hidden="true">{action.symbol}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 650, lineHeight: 1.4 }}>{action.title}</span>
                    <span style={{ display: "block", color: MUTED, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{action.description}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>

        <footer style={{ borderTop: `1px solid ${BORDER}`, marginTop: 28, paddingTop: 16, color: "#6B7280", fontSize: 11, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          <span>DKTE Placement Management System</span>
          <span>Placement Office Console</span>
        </footer>
      </main>
    </div>
  );
}
